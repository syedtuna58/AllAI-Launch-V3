import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertTriangle, Filter, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import WorkOrderCard from "@/components/cards/work-order-card";
import type { SmartCase, Property, Vendor, Unit } from "@shared/schema";

export default function CasesWidget() {
  const [, setLocation] = useLocation();
  const [filterType, setFilterType] = useState<string>("all");
  const [filterUrgency, setFilterUrgency] = useState<string>("all");
  const [filterProperty, setFilterProperty] = useState<string>("all");
  const [filterContractor, setFilterContractor] = useState<string>("all");
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: smartCases, isLoading: casesLoading } = useQuery<SmartCase[]>({
    queryKey: ["/api/cases"],
    retry: false,
  });

  const { data: properties } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    retry: false,
  });

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    retry: false,
  });

  const { data: units } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    retry: false,
  });

  const updateCaseStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/cases/${id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "Success",
        description: "Case status updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update case status",
        variant: "destructive",
      });
    },
  });

  const deleteCaseMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/cases/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "Success",
        description: "Case deleted",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete case",
        variant: "destructive",
      });
    },
  });

  const filteredCases = smartCases?.filter((c) => {
    if (filterType !== "all" && c.category !== filterType) return false;
    if (filterUrgency !== "all" && c.priority !== filterUrgency) return false;
    if (filterProperty !== "all" && c.propertyId !== filterProperty) return false;
    if (filterContractor !== "all" && c.assignedContractorId !== filterContractor) return false;
    return true;
  }) || [];

  return (
    <Card data-testid="widget-cases" className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-3">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"
            onClick={() => setLocation('/maintenance')}
          >
            <Wrench className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Maintenance</CardTitle>
            <Badge variant="secondary">{filteredCases.length}</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            data-testid="button-manage-all-cases-widget"
          >
            <Filter className="h-3 w-3 mr-1" />
            Filter
          </Button>
        </div>
        
        {/* Filter Controls */}
        <div className="grid grid-cols-2 gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 text-xs" data-testid="select-filter-type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="inspection">Inspection</SelectItem>
              <SelectItem value="complaint">Complaint</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterUrgency} onValueChange={setFilterUrgency}>
            <SelectTrigger className="h-8 text-xs" data-testid="select-filter-urgency">
              <SelectValue placeholder="Urgency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Urgency</SelectItem>
              <SelectItem value="Emergency">Emergency</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterProperty} onValueChange={setFilterProperty}>
            <SelectTrigger className="h-8 text-xs" data-testid="select-filter-property">
              <SelectValue placeholder="Property" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties?.map((prop) => (
                <SelectItem key={prop.id} value={prop.id}>
                  {prop.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterContractor} onValueChange={setFilterContractor}>
            <SelectTrigger className="h-8 text-xs" data-testid="select-filter-contractor">
              <SelectValue placeholder="Contractor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Contractors</SelectItem>
              {vendors?.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 pb-3 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          {casesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">No cases found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCases.map((smartCase, index) => (
                <WorkOrderCard
                  key={smartCase.id}
                  workOrder={smartCase}
                  properties={properties}
                  units={units}
                  userRole={user?.primaryRole}
                  index={index}
                  onStatusChange={(id, status) => updateCaseStatusMutation.mutate({ id, status })}
                  onEdit={() => setLocation('/maintenance')}
                  onReminder={() => setLocation('/maintenance')}
                  onDelete={(id) => {
                    if (window.confirm('Are you sure you want to delete this case?')) {
                      deleteCaseMutation.mutate(id);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
