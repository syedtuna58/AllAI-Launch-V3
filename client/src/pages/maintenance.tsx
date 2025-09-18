import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Wrench, AlertTriangle, Clock, CheckCircle, XCircle, Search } from "lucide-react";
import type { SmartCase, Property } from "@shared/schema";

export default function Maintenance() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  
  // Basic state
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Auth guard
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Data queries
  const { data: smartCases = [], isLoading: casesLoading } = useQuery<SmartCase[]>({
    queryKey: ["/api/cases"],
    retry: false,
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    retry: false,
  });

  // Helper functions
  const getStatusIcon = (status: string | null) => {
    const iconColor = "text-gray-700";
    switch (status) {
      case "New": return <AlertTriangle className={`h-4 w-4 ${iconColor}`} />;
      case "In Review": return <Clock className={`h-4 w-4 ${iconColor}`} />;
      case "Scheduled": return <Clock className={`h-4 w-4 ${iconColor}`} />;
      case "In Progress": return <Wrench className={`h-4 w-4 ${iconColor}`} />;
      case "On Hold": return <XCircle className={`h-4 w-4 ${iconColor}`} />;
      case "Resolved": return <CheckCircle className={`h-4 w-4 ${iconColor}`} />;
      case "Closed": return <CheckCircle className={`h-4 w-4 ${iconColor}`} />;
      default: return <Clock className={`h-4 w-4 ${iconColor}`} />;
    }
  };

  const getPriorityCircleColor = (priority: string | null) => {
    switch (priority) {
      case "Urgent": return "bg-red-100";
      case "High": return "bg-orange-100";
      case "Medium": return "bg-yellow-100";
      case "Low": return "bg-gray-100";
      default: return "bg-gray-50";
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "New": return <Badge className="bg-blue-100 text-blue-800">New</Badge>;
      case "In Progress": return <Badge className="bg-yellow-100 text-yellow-800">In Progress</Badge>;
      case "Resolved": return <Badge className="bg-green-100 text-green-800">Resolved</Badge>;
      case "Closed": return <Badge className="bg-green-100 text-green-800">Closed</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case "Urgent": return <Badge className="bg-red-100 text-red-800">Urgent</Badge>;
      case "High": return <Badge className="bg-orange-100 text-orange-800">High</Badge>;
      case "Medium": return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      case "Low": return <Badge className="bg-gray-100 text-gray-800">Low</Badge>;
      default: return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  // Filter logic
  const filteredCases = smartCases.filter(smartCase => {
    const statusMatch = statusFilter === "all" || smartCase.status === statusFilter;
    const propertyMatch = propertyFilter === "all" || smartCase.propertyId === propertyFilter;
    const searchMatch = searchQuery === "" || 
      smartCase.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      smartCase.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return statusMatch && propertyMatch && searchMatch;
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background" data-testid="page-maintenance">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Maintenance" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">
                  Maintenance Cases
                </h1>
                <p className="text-muted-foreground mt-1">
                  Manage and track maintenance issues across your properties
                </p>
              </div>
              <Button data-testid="button-add-case">
                <Plus className="h-4 w-4 mr-2" />
                New Case
              </Button>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-64">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Search cases..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                        data-testid="input-search-cases"
                      />
                    </div>
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48" data-testid="select-status-filter">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Resolved">Resolved</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                    <SelectTrigger className="w-48" data-testid="select-property-filter">
                      <SelectValue placeholder="Filter by property" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Properties</SelectItem>
                      {properties.map(property => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Cases List */}
            {casesLoading ? (
              <div className="grid grid-cols-1 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} data-testid={`skeleton-case-${i}`}>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="h-6 bg-muted animate-pulse rounded" />
                        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                        <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredCases.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2" data-testid="text-no-cases">
                    No Maintenance Cases
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery || statusFilter !== "all" || propertyFilter !== "all" 
                      ? "No cases match your current filters." 
                      : "Create your first maintenance case to start tracking issues and repairs."}
                  </p>
                  <Button data-testid="button-create-first-case">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Case
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {filteredCases.map((smartCase, index) => (
                  <Card key={smartCase.id} className="hover:shadow-md transition-shadow" data-testid={`card-case-${index}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-12 h-12 ${getPriorityCircleColor(smartCase.priority)} rounded-lg flex items-center justify-center`}>
                            {getStatusIcon(smartCase.status)}
                          </div>
                          <div>
                            <CardTitle className="text-lg" data-testid={`text-case-title-${index}`}>
                              {smartCase.title}
                            </CardTitle>
                            {smartCase.category && (
                              <p className="text-sm text-muted-foreground" data-testid={`text-case-category-${index}`}>
                                {smartCase.category}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getPriorityBadge(smartCase.priority)}
                          {getStatusBadge(smartCase.status)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {smartCase.description && (
                        <p className="text-sm text-muted-foreground mb-4" data-testid={`text-case-description-${index}`}>
                          {smartCase.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div>
                          <span data-testid={`text-case-created-${index}`}>
                            Created {smartCase.createdAt ? new Date(smartCase.createdAt).toLocaleDateString() : 'Unknown'}
                          </span>
                          {smartCase.propertyId && (
                            <div className="mt-1">
                              <span className="text-blue-600 font-medium">Property:</span>
                              <span className="ml-1" data-testid={`text-case-property-${index}`}>
                                {properties.find(p => p.id === smartCase.propertyId)?.name || 'Unknown Property'}
                              </span>
                            </div>
                          )}
                        </div>
                        {(smartCase.estimatedCost || smartCase.actualCost) && (
                          <div className="text-right">
                            {smartCase.actualCost && (
                              <div className="text-red-600 font-semibold" data-testid={`text-case-actual-cost-${index}`}>
                                Actual: ${Number(smartCase.actualCost).toLocaleString()}
                              </div>
                            )}
                            {smartCase.estimatedCost && (
                              <div className="text-muted-foreground" data-testid={`text-case-estimated-cost-${index}`}>
                                Est: ${Number(smartCase.estimatedCost).toLocaleString()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}