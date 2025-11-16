import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Briefcase, Check, AlertCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ContractorMarketplaceDashboard() {
  const { toast } = useToast();

  // Fetch marketplace cases
  const { data: marketplaceCases, isLoading: isLoadingMarketplace } = useQuery<any[]>({
    queryKey: ['/api/marketplace/cases'],
  });

  // Fetch assigned cases
  const { data: assignedCases, isLoading: isLoadingAssigned } = useQuery<any[]>({
    queryKey: ['/api/contractor/cases'],
  });

  // Accept case mutation
  const acceptMutation = useMutation({
    mutationFn: async (caseId: string) => {
      return await apiRequest("POST", `/api/marketplace/cases/${caseId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/cases'] });
      toast({
        title: 'Success!',
        description: 'Job accepted! Visit Job Hub to propose time slots.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept job',
        variant: 'destructive',
      });
    },
  });

  const isLoading = isLoadingMarketplace || isLoadingAssigned;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Marketplace</h1>
          <p className="text-muted-foreground">
            Browse and accept available maintenance jobs from landlords
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Available Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{marketplaceCases?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Ready to accept</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Your Active Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assignedCases?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Currently assigned</p>
            </CardContent>
          </Card>
        </div>

        {/* Marketplace Jobs */}
        <Card>
          <CardHeader>
            <CardTitle>Available Jobs</CardTitle>
            <CardDescription>Accept jobs that match your expertise</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingMarketplace ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-marketplace" />
              </div>
            ) : marketplaceCases && marketplaceCases.length > 0 ? (
              <div className="space-y-4">
                {marketplaceCases.map((job: any) => (
                  <Card key={job.id} className="border-2">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg" data-testid={`job-title-${job.id}`}>
                            {job.title}
                          </CardTitle>
                          <CardDescription>
                            {job.property?.street && job.property?.city 
                              ? `${job.property.street}, ${job.property.city}` 
                              : job.property?.name || 'Unknown Property'}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {job.isUrgent && (
                            <Badge variant="destructive" data-testid={`badge-urgent-${job.id}`}>
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Urgent
                            </Badge>
                          )}
                          {job.priority && job.priority !== 'Normal' && (
                            <Badge data-testid={`badge-priority-${job.id}`}>
                              {job.priority}
                            </Badge>
                          )}
                          {job.restrictToFavorites && !job.isUrgent && (
                            <Badge variant="secondary" data-testid={`badge-favorite-${job.id}`}>
                              Favorite
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4" data-testid={`job-description-${job.id}`}>
                        {job.description || 'No description provided'}
                      </p>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Posted: {job.postedAt ? new Date(job.postedAt).toLocaleDateString() : 'Recently'}
                          </div>
                          {job.category && (
                            <Badge variant="outline">{job.category}</Badge>
                          )}
                        </div>
                        <Button
                          onClick={() => acceptMutation.mutate(job.id)}
                          disabled={acceptMutation.isPending}
                          className="bg-purple-600 hover:bg-purple-700"
                          data-testid={`button-accept-${job.id}`}
                        >
                          {acceptMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Accepting...
                            </>
                          ) : (
                            <>
                              <Check className="mr-2 h-4 w-4" />
                              Accept Job
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No jobs available at the moment</p>
                <p className="text-sm mt-1">Check back later for new opportunities</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
