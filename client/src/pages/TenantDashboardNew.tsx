import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Home, Wrench, LogOut, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

const caseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(10, 'Please provide more details'),
});

export default function TenantDashboardNew() {
  const { toast } = useToast();
  const [showCaseForm, setShowCaseForm] = useState(false);

  // Fetch tenant's unit
  const { data: unit } = useQuery<any>({
    queryKey: ['/api/tenant/unit'],
  });

  // Fetch tenant's cases
  const { data: cases, isLoading: casesLoading } = useQuery<any[]>({
    queryKey: ['/api/tenant/cases'],
  });

  const form = useForm({
    resolver: zodResolver(caseSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  });

  const createCaseMutation = useMutation({
    mutationFn: async (data: z.infer<typeof caseSchema>) => {
      return await apiRequest('/api/tenant/cases', {
        method: 'POST',
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/cases'] });
      form.reset();
      setShowCaseForm(false);
      toast({
        title: 'Case submitted',
        description: 'Your maintenance request has been submitted.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to submit case. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleLogout = () => {
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('sessionId');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  const activeCases = cases?.filter(c => c.status !== 'completed' && c.status !== 'cancelled') || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Tenant Dashboard</h1>
            <p className="text-muted-foreground">Manage your unit and maintenance requests</p>
          </div>
          <Button variant="outline" onClick={handleLogout} data-testid="button-logout">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        {/* Unit Info */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Your Unit
            </CardTitle>
          </CardHeader>
          <CardContent>
            {unit ? (
              <div>
                <div className="text-lg font-medium">
                  {unit.unitNumber && `Unit ${unit.unitNumber}`}
                </div>
                <div className="text-muted-foreground">
                  {unit.property?.name || unit.property?.street || 'Unknown Property'}
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  {unit.property?.street}, {unit.property?.city}, {unit.property?.state} {unit.property?.zip}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No unit information available</p>
            )}
          </CardContent>
        </Card>

        {/* Maintenance Requests */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Maintenance Requests
                </CardTitle>
                <CardDescription>Your submitted maintenance cases</CardDescription>
              </div>
              {!showCaseForm && (
                <Button onClick={() => setShowCaseForm(true)} data-testid="button-new-case">
                  <Plus className="mr-2 h-4 w-4" />
                  New Request
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {showCaseForm && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Submit Maintenance Request</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit((data) => createCaseMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Issue Title</FormLabel>
                            <FormControl>
                              <input
                                {...field}
                                className="w-full px-3 py-2 border rounded-md"
                                placeholder="e.g., Leaky faucet in bathroom"
                                data-testid="input-title"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Please describe the issue in detail..."
                                rows={4}
                                data-testid="input-description"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex gap-2">
                        <Button type="submit" disabled={createCaseMutation.isPending} data-testid="button-submit">
                          {createCaseMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            'Submit Request'
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowCaseForm(false);
                            form.reset();
                          }}
                          data-testid="button-cancel"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {casesLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : cases && cases.length > 0 ? (
              <div className="space-y-3">
                {cases.map((caseItem) => (
                  <Card key={caseItem.id} data-testid={`card-case-${caseItem.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{caseItem.title}</CardTitle>
                          <CardDescription>{caseItem.description}</CardDescription>
                        </div>
                        <Badge>{caseItem.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        Submitted: {new Date(caseItem.createdAt).toLocaleDateString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No maintenance requests yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
