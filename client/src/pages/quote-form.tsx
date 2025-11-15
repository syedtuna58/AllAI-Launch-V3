import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Save, Send, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Customer = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
};

type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';
type DepositType = 'none' | 'percentage' | 'fixed';

type QuoteLineItem = {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  displayOrder: number;
};

type Quote = {
  id: string;
  customerId: string;
  quoteNumber: string;
  status: QuoteStatus;
  subtotal: number;
  discountAmount: number | null;
  taxRate: number | null;
  taxAmount: number | null;
  total: number;
  depositType: DepositType;
  depositAmount: number | null;
  notes: string | null;
  validUntil: string | null;
  customer: Customer;
  lineItems: QuoteLineItem[];
};

const quoteFormSchema = z.object({
  customerId: z.string().min(1, "Please select a customer"),
  discountAmount: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  depositType: z.enum(['none', 'percentage', 'fixed']),
  depositAmount: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
  validUntil: z.string().optional(),
});

type QuoteFormData = z.infer<typeof quoteFormSchema>;

const lineItemFormSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0"),
  rate: z.coerce.number().min(0, "Rate must be 0 or greater"),
});

type LineItemFormData = z.infer<typeof lineItemFormSchema>;

export default function QuoteFormPage() {
  const [_, setLocation] = useLocation();
  const params = useParams();
  const { id: quoteId } = params as { id?: string };
  const isEditMode = !!quoteId;
  const { toast } = useToast();

  const [lineItems, setLineItems] = useState<Array<Omit<QuoteLineItem, 'id'>>>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);

  // Fetch customers
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/contractor/customers'],
  });

  // Fetch quote if editing
  const { data: quoteData, isLoading: isLoadingQuote } = useQuery<{ quote: Quote; lineItems: QuoteLineItem[] }>({
    queryKey: ['/api/contractor/quotes', quoteId],
    enabled: isEditMode,
  });

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      customerId: "",
      discountAmount: 0,
      taxRate: 0,
      depositType: 'none',
      depositAmount: 0,
      notes: "",
      validUntil: "",
    },
  });

  const lineItemForm = useForm<LineItemFormData>({
    resolver: zodResolver(lineItemFormSchema),
    defaultValues: {
      description: "",
      quantity: 1,
      rate: 0,
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (quoteData && isEditMode) {
      form.reset({
        customerId: quoteData.quote.customerId,
        discountAmount: quoteData.quote.discountAmount || 0,
        taxRate: quoteData.quote.taxRate || 0,
        depositType: quoteData.quote.depositType,
        depositAmount: quoteData.quote.depositAmount || 0,
        notes: quoteData.quote.notes || "",
        validUntil: quoteData.quote.validUntil ? format(new Date(quoteData.quote.validUntil), 'yyyy-MM-dd') : "",
      });
      setLineItems(quoteData.lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
        displayOrder: item.displayOrder,
      })));
    }
  }, [quoteData, isEditMode, form]);

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const discountAmount = form.watch('discountAmount') || 0;
  const taxRate = form.watch('taxRate') || 0;
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = (afterDiscount * taxRate) / 100;
  const total = afterDiscount + taxAmount;

  // Calculate deposit
  const depositType = form.watch('depositType');
  const depositAmountInput = form.watch('depositAmount') || 0;
  let depositAmount = 0;
  if (depositType === 'fixed') {
    depositAmount = depositAmountInput;
  } else if (depositType === 'percentage') {
    depositAmount = (total * depositAmountInput) / 100;
  }

  const createMutation = useMutation({
    mutationFn: async (data: QuoteFormData) => {
      // Create quote with calculated totals
      const quote = await apiRequest('POST', '/api/contractor/quotes', {
        ...data,
        subtotal,
        taxAmount,
        total,
        depositAmount: depositType !== 'none' ? depositAmount : null,
        status: 'draft',
      });

      // Add line items
      for (let i = 0; i < lineItems.length; i++) {
        await apiRequest('POST', `/api/contractor/quotes/${quote.id}/line-items`, {
          ...lineItems[i],
          displayOrder: i,
          amount: lineItems[i].quantity * lineItems[i].rate,
        });
      }

      return quote;
    },
    onSuccess: (quote) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/quotes'] });
      toast({
        title: "Quote created",
        description: `Quote ${quote.quoteNumber} has been created successfully.`,
      });
      setLocation('/quotes');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: QuoteFormData) => {
      if (!quoteId) throw new Error("Quote ID is required");

      // Update quote with calculated totals
      await apiRequest('PATCH', `/api/contractor/quotes/${quoteId}`, {
        ...data,
        subtotal,
        taxAmount,
        total,
        depositAmount: depositType !== 'none' ? depositAmount : null,
      });

      // Delete existing line items and recreate them
      // This is simpler than trying to sync individual items
      const existingItems = quoteData?.lineItems || [];
      for (const item of existingItems) {
        await apiRequest('DELETE', `/api/contractor/quotes/${quoteId}/line-items/${item.id}`);
      }

      for (let i = 0; i < lineItems.length; i++) {
        await apiRequest('POST', `/api/contractor/quotes/${quoteId}/line-items`, {
          ...lineItems[i],
          displayOrder: i,
          amount: lineItems[i].quantity * lineItems[i].rate,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/quotes', quoteId] });
      toast({
        title: "Quote updated",
        description: "The quote has been updated successfully.",
      });
      setLocation('/quotes');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: QuoteFormData) => {
    if (lineItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one line item",
        variant: "destructive",
      });
      return;
    }

    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const addLineItem = (data: LineItemFormData) => {
    const newItem = {
      ...data,
      amount: data.quantity * data.rate,
      displayOrder: lineItems.length,
    };
    setLineItems([...lineItems, newItem]);
    lineItemForm.reset();
    setIsAddingItem(false);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const getCustomerDisplayName = (customer: Customer) => {
    if (customer.companyName && !customer.firstName && !customer.lastName) {
      return customer.companyName;
    }
    if (customer.firstName && customer.lastName) {
      return `${customer.lastName}, ${customer.firstName}`;
    }
    if (customer.lastName) return customer.lastName;
    if (customer.firstName) return customer.firstName;
    if (customer.companyName) return customer.companyName;
    return "Unknown Customer";
  };

  if (isLoadingQuote && isEditMode) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading quote...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={isEditMode ? "Edit Quote" : "Create Quote"} />
        <main className="flex-1 p-6 overflow-auto">
          <div className="mb-4">
            <Button
              variant="ghost"
              onClick={() => setLocation('/quotes')}
              className="mb-4"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Quotes
            </Button>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
              {isEditMode ? "Edit Quote" : "Create New Quote"}
            </h1>
            <p className="text-muted-foreground">
              {isEditMode ? "Update quote details and line items" : "Build a professional quote for your customer"}
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Customer Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle>Customer</CardTitle>
                    <CardDescription>Select the customer for this quote</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="customerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-customer">
                                <SelectValue placeholder="Select a customer" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {customers.map((customer) => (
                                <SelectItem key={customer.id} value={customer.id}>
                                  {getCustomerDisplayName(customer)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Quote Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quote Details</CardTitle>
                    <CardDescription>Set validity period and add notes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="validUntil"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valid Until (Optional)</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-valid-until" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Additional notes for the customer..." {...field} data-testid="input-notes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Line Items */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Line Items</CardTitle>
                      <CardDescription>Add items and services to this quote</CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddingItem(true)}
                      data-testid="button-add-line-item"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {lineItems.length === 0 && !isAddingItem && (
                    <div className="text-center py-8 text-muted-foreground">
                      No items added yet. Click "Add Item" to get started.
                    </div>
                  )}

                  {lineItems.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.map((item, index) => (
                          <TableRow key={index} data-testid={`line-item-${index}`}>
                            <TableCell>{item.description}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">${item.rate.toFixed(2)}</TableCell>
                            <TableCell className="text-right">${item.amount.toFixed(2)}</TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeLineItem(index)}
                                data-testid={`button-remove-${index}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {isAddingItem && (
                    <Form {...lineItemForm}>
                      <form onSubmit={lineItemForm.handleSubmit(addLineItem)} className="mt-4 p-4 border rounded-lg space-y-4">
                        <FormField
                          control={lineItemForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Input placeholder="Item or service description" {...field} data-testid="input-line-description" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={lineItemForm.control}
                            name="quantity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Quantity</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.01" {...field} data-testid="input-line-quantity" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={lineItemForm.control}
                            name="rate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Rate ($)</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.01" {...field} data-testid="input-line-rate" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button type="submit" size="sm" data-testid="button-save-line-item">
                            Add
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsAddingItem(false);
                              lineItemForm.reset();
                            }}
                            data-testid="button-cancel-line-item"
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </Form>
                  )}
                </CardContent>
              </Card>

              {/* Pricing */}
              <Card>
                <CardHeader>
                  <CardTitle>Pricing</CardTitle>
                  <CardDescription>Set discounts, tax, and deposit requirements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="discountAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} data-testid="input-discount" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="taxRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax Rate (%)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} data-testid="input-tax-rate" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span data-testid="text-subtotal">${subtotal.toFixed(2)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Discount:</span>
                        <span data-testid="text-discount">-${discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {taxAmount > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Tax ({taxRate}%):</span>
                        <span data-testid="text-tax">${taxAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                      <span>Total:</span>
                      <span data-testid="text-total">${total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <FormField
                      control={form.control}
                      name="depositType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deposit Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-deposit-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No Deposit</SelectItem>
                              <SelectItem value="percentage">Percentage</SelectItem>
                              <SelectItem value="fixed">Fixed Amount</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {depositType !== 'none' && (
                      <FormField
                        control={form.control}
                        name="depositAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {depositType === 'percentage' ? 'Deposit Percentage' : 'Deposit Amount ($)'}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder={depositType === 'percentage' ? 'e.g., 25' : 'e.g., 500'}
                                {...field}
                                data-testid="input-deposit-amount"
                              />
                            </FormControl>
                            {depositAmount > 0 && (
                              <FormDescription data-testid="text-deposit-calculated">
                                Deposit: ${depositAmount.toFixed(2)}
                              </FormDescription>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation('/quotes')}
                  data-testid="button-cancel-quote"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-quote"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : isEditMode ? 'Update Quote' : 'Create Quote'}
                </Button>
              </div>
            </form>
          </Form>
        </main>
      </div>
    </div>
  );
}
