import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Briefcase, Check, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ContractorMarketplaceDashboard() {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user:', error);
      }
    }
  }, []);

  // Fetch marketplace cases
  const { data: cases, isLoading } = useQuery<any[]>({
    queryKey: ['/api/contractor/marketplace'],
    enabled: !!user,
  });

  // Fetch assigned cases
  const { data: assignedCases } = useQuery<any[]>({
    queryKey: ['/api/contractor/assigned-cases'],
    enabled: !!user,
  });

  // Accept case mutation
  const acceptMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const token = localStorage.getItem('refreshToken');
      const res = await fetch('/api/contractor/accept-case', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ caseId }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to accept case');
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/assigned-cases'] });
      toast({
        title: 'Success!',
        description: 'Case accepted. You can now schedule an appointment.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Contractor Dashboard</h1>
            {user && (
              <p className="text-muted-foreground">
                Welcome back, {user.firstName} {user.lastName}
              </p>
            )}
          </div>
          <Button variant="outline" onClick={handleLogout} data-testid="button-logout">
            Logout
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Available Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cases?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Assigned Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assignedCases?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Earnings (This Month)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$0</div>
            </CardContent>
          </Card>
        </div>

        {/* Marketplace */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Job Marketplace</CardTitle>
            <CardDescription>Available maintenance jobs matching your specialties</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : cases && cases.length > 0 ? (
              <div className="space-y-4">
                {cases.map((job) => (
                  <Card key={job.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{job.title}</CardTitle>
                          <CardDescription>
                            {job.property?.name || job.property?.street || 'Unknown Property'}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {job.isUrgent && (
                            <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Urgent
                            </Badge>
                          )}
                          <Badge>{job.priority || 'Normal'}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">{job.description}</p>
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-muted-foreground">
                          Posted: {job.postedAt ? new Date(job.postedAt).toLocaleDateString() : 'Recently'}
                        </div>
                        <Button
                          onClick={() => acceptMutation.mutate(job.id)}
                          disabled={acceptMutation.isPending}
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
                <p>No jobs available at the moment</p>
                <p className="text-sm">Check back later for new opportunities</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assigned Cases */}
        {assignedCases && assignedCases.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Active Jobs</CardTitle>
              <CardDescription>Jobs you've accepted</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {assignedCases.map((job) => (
                  <Card key={job.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{job.title}</CardTitle>
                      <CardDescription>
                        {job.property?.name || job.property?.street || 'Unknown Property'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">{job.description}</p>
                      <Badge>{job.status}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
