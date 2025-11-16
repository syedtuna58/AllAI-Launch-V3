import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, Users, Search, Mail, Phone } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ContractorUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  primaryRole: string;
  isFavorite: boolean;
};

export default function FavoriteContractorsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: contractors = [], isLoading } = useQuery<ContractorUser[]>({
    queryKey: ['/api/marketplace/contractors'],
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ contractorUserId, isFavorite }: { contractorUserId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        return await apiRequest('DELETE', `/api/favorites/${contractorUserId}`);
      } else {
        return await apiRequest('POST', '/api/favorites', { contractorUserId });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/contractors'] });
      toast({
        title: variables.isFavorite ? "Removed from favorites" : "Added to favorites",
        description: variables.isFavorite 
          ? "This contractor has been removed from your favorites" 
          : "This contractor has been added to your favorites",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update favorite status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredContractors = contractors.filter(contractor => {
    if (!searchTerm) return true;
    const fullName = `${contractor.firstName || ''} ${contractor.lastName || ''}`.toLowerCase();
    const email = (contractor.email || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || email.includes(search);
  });

  const favoriteContractors = filteredContractors.filter(c => c.isFavorite);
  const otherContractors = filteredContractors.filter(c => !c.isFavorite);

  const getContractorDisplayName = (contractor: ContractorUser) => {
    if (contractor.firstName || contractor.lastName) {
      return `${contractor.firstName || ''} ${contractor.lastName || ''}`.trim();
    }
    return contractor.email;
  };

  return (
    <div className="flex h-screen bg-background" data-testid="page-favorite-contractors">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Favorite Contractors" />
        
        <main className="flex-1 overflow-auto p-6 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground mb-2" data-testid="text-page-title">
                Favorite Contractors
              </h1>
              <p className="text-muted-foreground">
                Mark contractors as favorites to send them priority job offers from the marketplace
              </p>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contractors by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-contractors"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading contractors...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Favorites Section */}
                {favoriteContractors.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      Favorites ({favoriteContractors.length})
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {favoriteContractors.map((contractor) => (
                        <Card key={contractor.id} className="border-l-4 border-l-yellow-400" data-testid={`card-contractor-${contractor.id}`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-base" data-testid={`text-contractor-name-${contractor.id}`}>
                                  {getContractorDisplayName(contractor)}
                                </CardTitle>
                                {contractor.email && (
                                  <CardDescription className="flex items-center gap-1 mt-1">
                                    <Mail className="h-3 w-3" />
                                    <span className="text-xs">{contractor.email}</span>
                                  </CardDescription>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleFavoriteMutation.mutate({ 
                                  contractorUserId: contractor.id, 
                                  isFavorite: true 
                                })}
                                disabled={toggleFavoriteMutation.isPending}
                                data-testid={`button-unfavorite-${contractor.id}`}
                              >
                                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                              </Button>
                            </div>
                          </CardHeader>
                          {contractor.phone && (
                            <CardContent className="pt-0">
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>{contractor.phone}</span>
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* All Contractors Section */}
                <div>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    All Contractors ({otherContractors.length})
                  </h2>
                  {otherContractors.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No contractors found</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {otherContractors.map((contractor) => (
                        <Card key={contractor.id} data-testid={`card-contractor-${contractor.id}`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-base" data-testid={`text-contractor-name-${contractor.id}`}>
                                  {getContractorDisplayName(contractor)}
                                </CardTitle>
                                {contractor.email && (
                                  <CardDescription className="flex items-center gap-1 mt-1">
                                    <Mail className="h-3 w-3" />
                                    <span className="text-xs">{contractor.email}</span>
                                  </CardDescription>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleFavoriteMutation.mutate({ 
                                  contractorUserId: contractor.id, 
                                  isFavorite: false 
                                })}
                                disabled={toggleFavoriteMutation.isPending}
                                data-testid={`button-favorite-${contractor.id}`}
                              >
                                <Star className="h-5 w-5 text-muted-foreground" />
                              </Button>
                            </div>
                          </CardHeader>
                          {contractor.phone && (
                            <CardContent className="pt-0">
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>{contractor.phone}</span>
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
