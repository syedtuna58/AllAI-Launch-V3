import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Home, Users, Wrench, DollarSign, LogOut, Plus } from 'lucide-react';

export default function LandlordDashboard() {
  // Fetch landlord's properties
  const { data: properties, isLoading: propertiesLoading } = useQuery<any[]>({
    queryKey: ['/api/landlord/properties'],
  });

  // Fetch landlord's cases
  const { data: cases } = useQuery<any[]>({
    queryKey: ['/api/landlord/cases'],
  });

  // Fetch landlord's tenants
  const { data: tenants } = useQuery<any[]>({
    queryKey: ['/api/landlord/tenants'],
  });

  const handleLogout = async () => {
    try {
      // Call logout endpoint to destroy session
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear localStorage
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('sessionId');
      localStorage.removeItem('user');
      // Redirect to landing page
      window.location.href = '/';
    }
  };

  const activeCases = cases?.filter(c => c.status !== 'completed' && c.status !== 'cancelled') || [];
  const urgentCases = activeCases.filter(c => c.isUrgent) || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Landlord Dashboard</h1>
            <p className="text-muted-foreground">Manage your properties and tenants</p>
          </div>
          <Button variant="outline" onClick={handleLogout} data-testid="button-logout">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Home className="h-4 w-4" />
                Properties
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-property-count">
                {properties?.length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-tenant-count">
                {tenants?.length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Active Cases
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-cases">
                {activeCases.length}
              </div>
              {urgentCases.length > 0 && (
                <p className="text-xs text-destructive mt-1">
                  {urgentCases.length} urgent
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Revenue (MTD)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$0</div>
            </CardContent>
          </Card>
        </div>

        {/* Properties List */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Properties</CardTitle>
                <CardDescription>Your managed properties</CardDescription>
              </div>
              <Button data-testid="button-add-property">
                <Plus className="mr-2 h-4 w-4" />
                Add Property
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {propertiesLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : properties && properties.length > 0 ? (
              <div className="space-y-4">
                {properties.map((property) => (
                  <Card key={property.id} data-testid={`card-property-${property.id}`}>
                    <CardHeader>
                      <CardTitle className="text-lg">{property.name || property.street}</CardTitle>
                      <CardDescription>
                        {property.street}, {property.city}, {property.state} {property.zip}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Badge>{property.propertyType}</Badge>
                        <Badge variant="outline">Units: {property._count?.units || 0}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Home className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No properties yet</p>
                <Button className="mt-4" data-testid="button-add-first-property">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Property
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Cases */}
        {activeCases.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Active Maintenance Cases</CardTitle>
              <CardDescription>Cases requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeCases.slice(0, 5).map((caseItem) => (
                  <div
                    key={caseItem.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`card-case-${caseItem.id}`}
                  >
                    <div>
                      <div className="font-medium">{caseItem.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {caseItem.property?.name || 'Unknown Property'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge>{caseItem.status}</Badge>
                      {caseItem.isUrgent && <Badge variant="destructive">Urgent</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
