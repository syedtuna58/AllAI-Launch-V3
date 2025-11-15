import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, DollarSign, Calendar, User } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";

type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';
type DepositType = 'none' | 'percentage' | 'fixed';

type Quote = {
  id: string;
  contractorId: string;
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
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    email: string | null;
    phone: string | null;
  };
};

export default function QuotesPage() {
  const [_, setLocation] = useLocation();
  const [filterStatus, setFilterStatus] = useState<'all' | QuoteStatus>('all');

  const { data: quotes = [], isLoading } = useQuery<Quote[]>({
    queryKey: ['/api/contractor/quotes'],
  });

  const getCustomerDisplayName = (customer: Quote['customer']) => {
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

  const getStatusColor = (status: QuoteStatus) => {
    switch (status) {
      case 'draft': return 'bg-gray-500 dark:bg-gray-600';
      case 'sent': return 'bg-blue-500 dark:bg-blue-600';
      case 'approved': return 'bg-green-500 dark:bg-green-600';
      case 'rejected': return 'bg-red-500 dark:bg-red-600';
      case 'expired': return 'bg-orange-500 dark:bg-orange-600';
      default: return 'bg-gray-500 dark:bg-gray-600';
    }
  };

  const getStatusLabel = (status: QuoteStatus) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Apply filters
  const filteredQuotes = quotes.filter(quote => {
    if (filterStatus !== 'all' && quote.status !== filterStatus) {
      return false;
    }
    return true;
  });

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
                variant={filterStatus === 'sent' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('sent')}
                data-testid="filter-sent"
              >
                Sent ({quotes.filter(q => q.status === 'sent').length})
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
                variant={filterStatus === 'rejected' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('rejected')}
                data-testid="filter-rejected"
              >
                Rejected ({quotes.filter(q => q.status === 'rejected').length})
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
                      <CardTitle className="text-lg" data-testid={`text-quote-number-${quote.id}`}>
                        {quote.quoteNumber}
                      </CardTitle>
                      <Badge className={getStatusColor(quote.status)} data-testid={`badge-status-${quote.id}`}>
                        {getStatusLabel(quote.status)}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-2" data-testid={`text-customer-${quote.id}`}>
                      <User className="h-4 w-4" />
                      {getCustomerDisplayName(quote.customer)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          Total
                        </span>
                        <span className="font-semibold" data-testid={`text-total-${quote.id}`}>
                          ${quote.total.toFixed(2)}
                        </span>
                      </div>
                      {quote.depositAmount && quote.depositAmount > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Deposit</span>
                          <span className="text-sm" data-testid={`text-deposit-${quote.id}`}>
                            ${quote.depositAmount.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {quote.validUntil && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Valid Until
                          </span>
                          <span className="text-sm" data-testid={`text-valid-until-${quote.id}`}>
                            {format(new Date(quote.validUntil), 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-xs text-muted-foreground">Created</span>
                        <span className="text-xs text-muted-foreground" data-testid={`text-created-${quote.id}`}>
                          {format(new Date(quote.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
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
    </div>
  );
}
