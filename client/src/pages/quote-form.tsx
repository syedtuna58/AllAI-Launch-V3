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

  // New line item form
  const [newItemName, setNewItemName] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState(0);

  // Fetch customers
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/contractor/customers'],
  });

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

  const createMutation = useMutation({
    mutationFn: async () => {
      const quoteData = {
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

      return await apiRequest('POST', '/api/contractor/quotes', quoteData);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/quotes'] });
      toast({
        title: "Quote created",
        description: `Quote has been created successfully.`,
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

  const addLineItem = () => {
    if (!newItemName) {
      toast({
        title: "Error",
        description: "Item name is required",
        variant: "destructive",
      });
      return;
    }

    const newItem: LineItem = {
      name: newItemName,
      description: newItemDescription,
      quantity: newItemQty,
      unitPrice: newItemPrice,
      total: newItemQty * newItemPrice,
      displayOrder: lineItems.length,
    };

    setLineItems([...lineItems, newItem]);
    
    // Reset form
    setNewItemName("");
    setNewItemDescription("");
    setNewItemQty(1);
    setNewItemPrice(0);
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

    createMutation.mutate();
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="New Quote" />
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
              
              {lineItems.length > 0 && (
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
                          <div>
                            <div className="font-medium">{item.name}</div>
                            {item.description && (
                              <div className="text-sm text-muted-foreground">{item.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">${item.total.toFixed(2)}</TableCell>
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

              {/* Add Line Item Form */}
              <div className="grid gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <Input
                      placeholder="Item name (e.g., Stump Grinding)"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      data-testid="input-item-name"
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Qty"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(parseFloat(e.target.value) || 0)}
                      data-testid="input-item-qty"
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Unit Price"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(parseFloat(e.target.value) || 0)}
                      data-testid="input-item-price"
                    />
                  </div>
                </div>
                <div>
                  <Textarea
                    placeholder="Description (optional)"
                    value={newItemDescription}
                    onChange={(e) => setNewItemDescription(e.target.value)}
                    rows={2}
                    data-testid="input-item-description"
                  />
                </div>
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addLineItem}
                    data-testid="button-add-item"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Line Item
                  </Button>
                </div>
              </div>
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
                      <Label className="flex-1">Discount:</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
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
                      <Label className="flex-1">Tax (%):</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={taxPercent}
                        onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
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
                    <div>
                      <Label>Required Deposit</Label>
                      <Select value={depositType} onValueChange={(value: any) => setDepositType(value)}>
                        <SelectTrigger data-testid="select-deposit-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Deposit</SelectItem>
                          <SelectItem value="percent">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {depositType !== 'none' && (
                      <div>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={depositType === 'percent' ? 'e.g., 25' : 'e.g., 500'}
                          value={depositValue}
                          onChange={(e) => setDepositValue(parseFloat(e.target.value) || 0)}
                          data-testid="input-deposit-value"
                        />
                        {requiredDepositAmount > 0 && (
                          <p className="text-sm text-muted-foreground mt-1" data-testid="text-deposit-calculated">
                            Deposit: ${requiredDepositAmount.toFixed(2)}
                          </p>
                        )}
                      </div>
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
                disabled={createMutation.isPending}
                data-testid="button-save"
              >
                <Save className="h-4 w-4 mr-2" />
                {createMutation.isPending ? 'Saving...' : 'Save Quote'}
              </Button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
