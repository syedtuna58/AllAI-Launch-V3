import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, FileText, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

type QuoteLineItem = {
  id: string;
  name: string;
  description: string | null;
  quantity: string;
  unitPrice: string;
  total: string;
};

type Quote = {
  id: string;
  title: string;
  status: string;
  subtotal: string;
  discountAmount: string;
  taxPercent: string;
  taxAmount: string;
  total: string;
  depositType: string;
  depositValue: string | null;
  requiredDepositAmount: string;
  expiresAt: string | null;
  clientMessage: string | null;
  createdAt: string;
  lineItems: QuoteLineItem[];
};

export default function QuoteApprovalPage() {
  const params = useParams();
  const { id, token } = params as { id: string; token: string };
  const [actionTaken, setActionTaken] = useState<'approved' | 'declined' | null>(null);

  // Fetch quote data using public endpoint
  const { data: quote, isLoading, error } = useQuery<Quote>({
    queryKey: [`/api/public/quotes/${id}/${token}`],
    retry: false,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/public/quotes/${id}/${token}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to approve quote');
      }
      return res.json();
    },
    onSuccess: () => {
      setActionTaken('approved');
    },
  });

  // Decline mutation
  const declineMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/public/quotes/${id}/${token}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to decline quote');
      }
      return res.json();
    },
    onSuccess: () => {
      setActionTaken('declined');
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading quote...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Quote Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This quote could not be found or the link may have expired.
              Please contact the contractor for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state after approval/decline
  if (actionTaken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              {actionTaken === 'approved' ? (
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              ) : (
                <XCircle className="h-6 w-6 text-red-500" />
              )}
              <CardTitle>
                {actionTaken === 'approved' ? 'Quote Approved!' : 'Quote Declined'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {actionTaken === 'approved'
                ? 'Thank you for approving this quote. The contractor will be notified and will reach out to you soon to schedule the work.'
                : 'You have declined this quote. The contractor has been notified.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if quote is already approved/declined
  if (quote.status === 'approved' || quote.status === 'declined') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Quote Already {quote.status === 'approved' ? 'Approved' : 'Declined'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This quote has already been {quote.status}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if expired
  const isExpired = quote.expiresAt && new Date(quote.expiresAt) < new Date();

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-quote-title">
            {quote.title}
          </h1>
          <p className="text-muted-foreground">
            Please review this quote and approve or decline below
          </p>
        </div>

        {/* Expiry Warning */}
        {isExpired && (
          <Card className="mb-6 border-destructive">
            <CardContent className="py-4">
              <p className="text-destructive font-medium">
                This quote expired on {format(new Date(quote.expiresAt!), 'MMMM d, yyyy')}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Quote Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quote Details</CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Created {format(new Date(quote.createdAt), 'MMM d, yyyy')}</span>
              </div>
              {quote.expiresAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Expires {format(new Date(quote.expiresAt), 'MMM d, yyyy')}</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Line Items */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.lineItems.map((item) => (
                  <TableRow key={item.id} data-testid={`line-item-${item.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.name}</div>
                        {item.description && (
                          <div className="text-sm text-muted-foreground mt-1">{item.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{parseFloat(item.quantity)}</TableCell>
                    <TableCell className="text-right">${parseFloat(item.unitPrice).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">${parseFloat(item.total).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Separator className="my-6" />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-base">
                <span>Subtotal:</span>
                <span data-testid="text-subtotal">${parseFloat(quote.subtotal).toFixed(2)}</span>
              </div>
              {parseFloat(quote.discountAmount) > 0 && (
                <div className="flex justify-between text-base text-muted-foreground">
                  <span>Discount:</span>
                  <span>-${parseFloat(quote.discountAmount).toFixed(2)}</span>
                </div>
              )}
              {parseFloat(quote.taxPercent) > 0 && (
                <div className="flex justify-between text-base text-muted-foreground">
                  <span>Tax ({parseFloat(quote.taxPercent)}%):</span>
                  <span data-testid="text-tax">${parseFloat(quote.taxAmount).toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-xl font-bold">
                <span>Total:</span>
                <span data-testid="text-total">${parseFloat(quote.total).toFixed(2)}</span>
              </div>
              {parseFloat(quote.requiredDepositAmount) > 0 && (
                <div className="flex justify-between text-base text-muted-foreground pt-2 border-t">
                  <span>Required Deposit:</span>
                  <span className="font-semibold text-foreground" data-testid="text-deposit">
                    ${parseFloat(quote.requiredDepositAmount).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Client Message */}
        {quote.clientMessage && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Message from Contractor</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap" data-testid="text-client-message">
                {quote.clientMessage}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {!isExpired && (
          <div className="flex gap-4 justify-center">
            <Button
              size="lg"
              variant="outline"
              onClick={() => declineMutation.mutate()}
              disabled={declineMutation.isPending || approveMutation.isPending}
              data-testid="button-decline"
            >
              <XCircle className="h-5 w-5 mr-2" />
              {declineMutation.isPending ? 'Declining...' : 'Decline Quote'}
            </Button>
            <Button
              size="lg"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending || declineMutation.isPending}
              data-testid="button-approve"
            >
              <CheckCircle2 className="h-5 w-5 mr-2" />
              {approveMutation.isPending ? 'Approving...' : 'Approve Quote'}
            </Button>
          </div>
        )}

        {isExpired && (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-muted-foreground">
                This quote has expired. Please contact the contractor for an updated quote.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Error Messages */}
        {(approveMutation.error || declineMutation.error) && (
          <Card className="mt-4 border-destructive">
            <CardContent className="py-4">
              <p className="text-destructive">
                {approveMutation.error?.message || declineMutation.error?.message}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
