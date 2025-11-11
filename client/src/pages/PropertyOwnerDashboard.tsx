import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, Wrench, Star, Plus, LogOut } from 'lucide-react';
import { useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';

export default function PropertyOwnerDashboard() {
  const [, setLocation] = useLocation();

  const { data: properties, isLoading: propertiesLoading } = useQuery({
    queryKey: ['/api/property-owner/properties'],
  });

  const { data: cases, isLoading: casesLoading } = useQuery({
    queryKey: ['/api/property-owner/cases'],
  });

  const { data: favorites, isLoading: favoritesLoading } = useQuery({
    queryKey: ['/api/property-owner/favorites'],
  });

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', 'POST', {});
      localStorage.removeItem('sessionId');
      localStorage.removeItem('refreshToken');
      queryClient.clear();
      setLocation('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Properties
          </h1>
          <Button
            variant="outline"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card data-testid="card-properties">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                My Properties
              </CardTitle>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-property-count">
                {propertiesLoading ? '...' : properties?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Properties you own
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-cases">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Maintenance Cases
              </CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-case-count">
                {casesLoading ? '...' : cases?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Active and completed cases
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-favorites">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Favorite Contractors
              </CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-favorite-count">
                {favoritesLoading ? '...' : favorites?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Your trusted contractors
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Properties</span>
                <Button size="sm" data-testid="button-add-property">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Property
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {propertiesLoading ? (
                <p className="text-gray-500">Loading...</p>
              ) : properties && properties.length > 0 ? (
                <div className="space-y-4">
                  {properties.map((property: any) => (
                    <div
                      key={property.id}
                      className="border rounded-lg p-4"
                      data-testid={`card-property-${property.id}`}
                    >
                      <h3 className="font-semibold">{property.name || property.street}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {property.street}, {property.city}, {property.state} {property.zip}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Home className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500 mb-4">No properties yet</p>
                  <Button data-testid="button-add-first-property">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Property
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Recent Maintenance Cases</span>
                <Button size="sm" data-testid="button-create-case">
                  <Plus className="h-4 w-4 mr-2" />
                  New Request
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {casesLoading ? (
                <p className="text-gray-500">Loading...</p>
              ) : cases && cases.length > 0 ? (
                <div className="space-y-4">
                  {cases.slice(0, 5).map((case_: any) => (
                    <div
                      key={case_.id}
                      className="border rounded-lg p-4"
                      data-testid={`card-case-${case_.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{case_.title}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {case_.property?.name || case_.property?.street}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            case_.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : case_.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {case_.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Wrench className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500 mb-4">No maintenance requests</p>
                  <Button data-testid="button-create-first-case">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Request
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Contractor Marketplace</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Browse and hire qualified contractors for your property maintenance needs.
            </p>
            <Button data-testid="button-browse-contractors">
              <Star className="h-4 w-4 mr-2" />
              Browse Contractors
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
