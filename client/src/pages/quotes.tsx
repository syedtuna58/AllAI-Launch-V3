import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, DollarSign, Calendar, Send, Copy, Check, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type QuoteStatus = 'draft' | 'sent' | 'awaiting_response' | 'approved' | 'declined' | 'expired';

type Quote = {
  id: string;
  title: string;
  status: QuoteStatus;
  total: string;
  requiredDepositAmount: string;
  expiresAt: string | null;
  createdAt: string;
};

export default function QuotesPage() {
  const [_, setLocation] = useLocation();
  const [filterStatus, setFilterStatus] = useState<'all' | QuoteStatus>('all');
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [approvalLink, setApprovalLink] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState(false);
  const { toast } = useToast();

  const { data: quotes = [], isLoading } = useQuery<Quote[]>({
    queryKey: ['/api/contractor/quotes'],
  });

  const sendMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return await apiRequest('POST', `/api/contractor/quotes/${quoteId}/send`, {
        method: 'link',
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/quotes'] });
      setApprovalLink(data.approvalLink);
      setSendDialogOpen(true);
      toast({
        title: "Quote sent",
        description: "Quote status updated to awaiting response",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send quote",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return await apiRequest('DELETE', `/api/contractor/quotes/${quoteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/quotes'] });
      setDeleteDialogOpen(false);
      toast({
        title: "Quote deleted",
        description: "Quote has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete quote",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: QuoteStatus) => {
    switch (status) {
      case 'draft': return 'bg-gray-500 dark:bg-gray-600';
      case 'sent': return 'bg-blue-500 dark:bg-blue-600';
      case 'awaiting_response': return 'bg-yellow-500 dark:bg-yellow-600';
      case 'approved': return 'bg-green-500 dark:bg-green-600';
      case 'declined': return 'bg-red-500 dark:bg-red-600';
      case 'expired': return 'bg-orange-500 dark:bg-orange-600';
      default: return 'bg-gray-500 dark:bg-gray-600';
    }
  };

  const getStatusLabel = (status: QuoteStatus) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Apply filters
  const filteredQuotes = quotes.filter(quote => {
    if (filterStatus !== 'all' && quote.status !== filterStatus) {
      return false;
    }
    return true;
  });

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(approvalLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      toast({
        title: "Link copied",
        description: "Approval link copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const handleSendQuote = (e: React.MouseEvent, quoteId: string) => {
    e.stopPropagation(); // Prevent card click
    sendMutation.mutate(quoteId);
  };

  const handleDeleteClick = (e: React.MouseEvent, quoteId: string) => {
    e.stopPropagation(); // Prevent card click
    setSelectedQuoteId(quoteId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedQuoteId) {
      deleteMutation.mutate(selectedQuoteId);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Quotes" />
        <main className="flex-1 p-6 overflow-auto">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
                Quotes
              </h1>
              <p className="text-muted-foreground">
                Create and manage quotes for your customers
              </p>
            </div>
            <Button onClick={() => setLocation('/quotes/new')} data-testid="button-create-quote">
              <Plus className="h-4 w-4 mr-2" />
              Create Quote
            </Button>
          </div>

          {/* Filter Controls */}
          {quotes.length > 0 && (
            <div className="mb-6 flex gap-2" data-testid="filter-controls">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('all')}
                data-testid="filter-all"
              >
                All ({quotes.length})
              </Button>
              <Button
                variant={filterStatus === 'draft' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('draft')}
                data-testid="filter-draft"
              >
                Draft ({quotes.filter(q => q.status === 'draft').length})
              </Button>
              <Button
                variant={filterStatus === 'awaiting_response' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('awaiting_response')}
                data-testid="filter-awaiting"
              >
                Awaiting ({quotes.filter(q => q.status === 'awaiting_response').length})
              </Button>
              <Button
                variant={filterStatus === 'approved' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('approved')}
                data-testid="filter-approved"
              >
                Approved ({quotes.filter(q => q.status === 'approved').length})
              </Button>
              <Button
                variant={filterStatus === 'declined' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('declined')}
                data-testid="filter-declined"
              >
                Declined ({quotes.filter(q => q.status === 'declined').length})
              </Button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading quotes...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && quotes.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No quotes yet</h3>
                <p className="text-muted-foreground mb-4 text-center">
                  Start creating quotes for your customers to get paid faster
                </p>
                <Button onClick={() => setLocation('/quotes/new')} data-testid="button-create-first-quote">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Quote
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Quotes Grid */}
          {!isLoading && filteredQuotes.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredQuotes.map((quote) => (
                <Card 
                  key={quote.id} 
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setLocation(`/quotes/${quote.id}`)}
                  data-testid={`card-quote-${quote.id}`}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <CardTitle className="text-lg" data-testid={`text-title-${quote.id}`}>
                        {quote.title}
                      </CardTitle>
                      <Badge className={getStatusColor(quote.status)} data-testid={`badge-status-${quote.id}`}>
                        {getStatusLabel(quote.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          Total
                        </span>
                        <span className="font-semibold" data-testid={`text-total-${quote.id}`}>
                          ${parseFloat(quote.total).toFixed(2)}
                        </span>
                      </div>
                      {parseFloat(quote.requiredDepositAmount) > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Deposit</span>
                          <span className="text-sm" data-testid={`text-deposit-${quote.id}`}>
                            ${parseFloat(quote.requiredDepositAmount).toFixed(2)}
                          </span>
                        </div>
                      )}
                      {quote.expiresAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Expires
                          </span>
                          <span className="text-sm" data-testid={`text-expires-${quote.id}`}>
                            {format(new Date(quote.expiresAt), 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-xs text-muted-foreground">Created</span>
                        <span className="text-xs text-muted-foreground" data-testid={`text-created-${quote.id}`}>
                          {format(new Date(quote.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                      {quote.status === 'draft' && (
                        <div className="pt-3 border-t mt-3 flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={(e) => handleSendQuote(e, quote.id)}
                            disabled={sendMutation.isPending}
                            data-testid={`button-send-${quote.id}`}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Send Quote
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleDeleteClick(e, quote.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${quote.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* No Results After Filtering */}
          {!isLoading && quotes.length > 0 && filteredQuotes.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No quotes found</h3>
                <p className="text-muted-foreground mb-4 text-center">
                  Try adjusting your filters to see more quotes
                </p>
                <Button variant="outline" onClick={() => setFilterStatus('all')} data-testid="button-clear-filters">
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      {/* Approval Link Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent data-testid="dialog-approval-link">
          <DialogHeader>
            <DialogTitle>Quote Sent Successfully!</DialogTitle>
            <DialogDescription>
              Copy the approval link below and share it with your customer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={approvalLink}
                readOnly
                className="flex-1 px-3 py-2 text-sm bg-muted rounded border"
                data-testid="input-approval-link"
              />
              <Button
                size="sm"
                onClick={handleCopyLink}
                data-testid="button-copy-link"
              >
                {linkCopied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Your customer can approve or decline the quote using this link.
              The quote status has been updated to "Awaiting Response".
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setSendDialogOpen(false)} data-testid="button-close-dialog">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-confirmation">
          <DialogHeader>
            <DialogTitle>Delete Quote</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this quote? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
