import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Customer = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
};

type LineItem = {
  id?: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  displayOrder: number;
};

export default function QuoteFormPage() {
  const [_, setLocation] = useLocation();
  const params = useParams();
  const { id: quoteId } = params as { id?: string };
  const isEditMode = !!quoteId && quoteId !== 'new';
  const { toast } = useToast();

  // Form state
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [clientMessage, setClientMessage] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [depositType, setDepositType] = useState<'none' | 'percent' | 'fixed'>('none');
  const [depositValue, setDepositValue] = useState(0);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Removed separate form state - editing happens directly in the table

  // Fetch customers
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/contractor/customers'],
  });

  // Fetch existing quote when in edit mode
  const { data: existingQuoteData, isLoading: isLoadingQuote } = useQuery({
    queryKey: ['/api/contractor/quotes', quoteId],
    enabled: isEditMode,
  });

  // Populate form when editing existing quote
  useEffect(() => {
    if (isEditMode && existingQuoteData) {
      const { quote, lineItems: existingLineItems } = existingQuoteData;
      
      setCustomerId(quote.customerId);
      setTitle(quote.title || "");
      setExpiresAt(quote.expiresAt ? format(new Date(quote.expiresAt), 'yyyy-MM-dd') : "");
      setClientMessage(quote.clientMessage || "");
      setInternalNotes(quote.internalNotes || "");
      setDiscountAmount(parseFloat(quote.discountAmount) || 0);
      setTaxPercent(parseFloat(quote.taxPercent) || 0);
      setDepositType(quote.depositType || 'none');
      // Handle depositValue safely (may be null, string, or number)
      const depositVal = quote.depositValue;
      setDepositValue(depositVal != null ? parseFloat(String(depositVal)) || 0 : 0);
      
      // Map line items to local state
      const mappedLineItems: LineItem[] = existingLineItems.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description || "",
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        total: parseFloat(item.total),
        displayOrder: item.displayOrder,
      }));
      
      setLineItems(mappedLineItems);
    }
  }, [isEditMode, existingQuoteData]);

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = (afterDiscount * taxPercent) / 100;
  const total = afterDiscount + taxAmount;
  
  let requiredDepositAmount = 0;
  if (depositType === 'fixed') {
    requiredDepositAmount = depositValue;
  } else if (depositType === 'percent') {
    requiredDepositAmount = (total * depositValue) / 100;
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        customerId,
        title: title || `Quote for ${customers.find(c => c.id === customerId)?.companyName || customers.find(c => c.id === customerId)?.lastName || 'Customer'}`,
        status: 'draft',
        subtotal: subtotal.toString(),
        discountAmount: discountAmount.toString(),
        taxPercent: taxPercent.toString(),
        taxAmount: taxAmount.toString(),
        total: total.toString(),
        depositType,
        depositValue: depositType !== 'none' ? depositValue.toString() : null,
        requiredDepositAmount: depositType !== 'none' ? requiredDepositAmount.toString() : '0',
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        clientMessage: clientMessage || null,
        internalNotes: internalNotes || null,
        lineItems: lineItems.map((item, index) => ({
          name: item.name,
          description: item.description || null,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          total: item.total.toString(),
          displayOrder: index,
        })),
      };

      if (isEditMode) {
        // Use atomic update endpoint that handles quote + line items in one transaction
        return await apiRequest('PATCH', `/api/contractor/quotes/${quoteId}`, payload);
      } else {
        // Create new quote with line items
        return await apiRequest('POST', '/api/contractor/quotes', payload);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/quotes'] });
      toast({
        title: isEditMode ? "Quote updated" : "Quote created",
        description: isEditMode ? "Quote has been updated successfully." : "Quote has been created successfully.",
      });
      setLocation('/quotes');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditMode ? 'update' : 'create'} quote. Please try again.`,
        variant: "destructive",
      });
    },
  });

  const addLineItem = () => {
    const newItem: LineItem = {
      name: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      total: 0,
      displayOrder: lineItems.length,
    };
    setLineItems([...lineItems, newItem]);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };
    
    // Recalculate total when quantity or price changes
    if (field === 'quantity' || field === 'unitPrice') {
      updatedItems[index].total = updatedItems[index].quantity * updatedItems[index].unitPrice;
    }
    
    setLineItems(updatedItems);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerId) {
      toast({
        title: "Error",
        description: "Please select a customer",
        variant: "destructive",
      });
      return;
    }

    if (lineItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one line item",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate();
  };

  if (isEditMode && isLoadingQuote) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Edit Quote" />
          <main className="flex-1 p-6 overflow-auto flex items-center justify-center">
            <p className="text-muted-foreground">Loading quote...</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={isEditMode ? "Edit Quote" : "New Quote"} />
        <main className="flex-1 p-6 overflow-auto">
          <Button
            variant="ghost"
            onClick={() => setLocation('/quotes')}
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Quotes
          </Button>

          <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="bg-card border rounded-lg p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Customer *</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger data-testid="select-customer">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {getCustomerDisplayName(customer)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quote Title (Optional)</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Auto-generated if empty"
                    data-testid="input-title"
                  />
                </div>
                <div>
                  <Label>Valid Until (Optional)</Label>
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    data-testid="input-expires-at"
                  />
                </div>
              </div>
            </div>

            {/* Line Items Section */}
            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Line Items</h3>
              
              <Table className="mb-4">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Product / Service</TableHead>
                    <TableHead className="text-right w-[100px]">Qty.</TableHead>
                    <TableHead className="text-right w-[120px]">Unit Price</TableHead>
                    <TableHead className="text-right w-[120px]">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item, index) => (
                    <TableRow key={index} data-testid={`line-item-${index}`}>
                      <TableCell>
                        <div className="space-y-2">
                          <Input
                            value={item.name}
                            onChange={(e) => updateLineItem(index, 'name', e.target.value)}
                            placeholder="Item name"
                            className="font-medium"
                            data-testid={`input-name-${index}`}
                          />
                          <Input
                            value={item.description}
                            onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                            placeholder="Description (optional)"
                            className="text-sm"
                            data-testid={`input-description-${index}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          onFocus={(e) => { try { e.target.select(); } catch {} }}
                          className="text-right w-20"
                          data-testid={`input-qty-${index}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          onFocus={(e) => { try { e.target.select(); } catch {} }}
                          className="text-right w-24"
                          data-testid={`input-price-${index}`}
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium" data-testid={`text-total-${index}`}>
                        ${item.total.toFixed(2)}
                      </TableCell>
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

              {/* Add Line Item Button */}
              <Button
                type="button"
                variant="outline"
                onClick={addLineItem}
                data-testid="button-add-item"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Line Item
              </Button>
            </div>

            {/* Bottom Section: Messages & Totals */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Left: Messages */}
              <div className="space-y-4">
                <div className="bg-card border rounded-lg p-4">
                  <Label className="mb-2 block">Client Message</Label>
                  <Textarea
                    placeholder="Message that the customer will see..."
                    value={clientMessage}
                    onChange={(e) => setClientMessage(e.target.value)}
                    rows={4}
                    data-testid="input-client-message"
                  />
                </div>
                <div className="bg-card border rounded-lg p-4">
                  <Label className="mb-2 block">Internal Notes</Label>
                  <p className="text-sm text-muted-foreground mb-2">Only visible to your team</p>
                  <Textarea
                    placeholder="Internal notes for your team..."
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    rows={3}
                    data-testid="input-internal-notes"
                  />
                </div>
              </div>

              {/* Right: Totals */}
              <div className="bg-card border rounded-lg p-6">
                <div className="space-y-4">
                  <div className="flex justify-between text-lg">
                    <span>Subtotal:</span>
                    <span className="font-semibold" data-testid="text-subtotal">${subtotal.toFixed(2)}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="discount-amount" className="flex-1">Discount:</Label>
                      <Input
                        id="discount-amount"
                        type="number"
                        step="0.01"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                        onFocus={(e) => { try { e.target.select(); } catch {} }}
                        className="w-32 text-right"
                        data-testid="input-discount"
                      />
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span></span>
                        <span>-${discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="tax-percent" className="flex-1">Tax (%):</Label>
                      <Input
                        id="tax-percent"
                        type="number"
                        step="0.01"
                        value={taxPercent}
                        onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                        onFocus={(e) => { try { e.target.select(); } catch {} }}
                        className="w-32 text-right"
                        data-testid="input-tax-percent"
                      />
                    </div>
                    {taxPercent > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span></span>
                        <span data-testid="text-tax-amount">${taxAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between text-xl font-bold">
                      <span>Total:</span>
                      <span data-testid="text-total">${total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <Label htmlFor="deposit-type">Required Deposit</Label>
                    <div className="flex items-center gap-2">
                      <Select value={depositType} onValueChange={(value: any) => setDepositType(value)}>
                        <SelectTrigger id="deposit-type" data-testid="select-deposit-type" className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Deposit</SelectItem>
                          <SelectItem value="percent">Percentage (%)</SelectItem>
                          <SelectItem value="fixed">Fixed ($)</SelectItem>
                        </SelectContent>
                      </Select>
                      {depositType !== 'none' && (
                        <Input
                          id="deposit-value"
                          type="number"
                          step="0.01"
                          placeholder={depositType === 'percent' ? '25' : '500'}
                          value={depositValue}
                          onChange={(e) => setDepositValue(parseFloat(e.target.value) || 0)}
                          onFocus={(e) => { try { e.target.select(); } catch {} }}
                          className="w-32"
                          data-testid="input-deposit-value"
                        />
                      )}
                    </div>
                    {depositType !== 'none' && requiredDepositAmount > 0 && (
                      <p className="text-sm text-muted-foreground" data-testid="text-deposit-calculated">
                        Deposit Amount: ${requiredDepositAmount.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation('/quotes')}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                data-testid="button-save"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : isEditMode ? 'Update Quote' : 'Save Quote'}
              </Button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
