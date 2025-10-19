import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertTriangle, Filter, Building, User, Flame, Wrench } from "lucide-react";
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
import type { SmartCase, Property, Vendor } from "@shared/schema";

export default function CasesWidget() {
  const [, setLocation] = useLocation();
  const [filterType, setFilterType] = useState<string>("all");
  const [filterUrgency, setFilterUrgency] = useState<string>("all");
  const [filterProperty, setFilterProperty] = useState<string>("all");
  const [filterContractor, setFilterContractor] = useState<string>("all");

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

  const getStatusBadge = (status: string) => {
    const shortStatus = (s: string) => {
      const statusMap: { [key: string]: string } = {
        "New": "New",
        "In Review": "Review",
        "In Progress": "Active",
        "Scheduled": "Sched",
        "Resolved": "Done",
        "On Hold": "Hold",
        "Closed": "Closed"
      };
      return statusMap[s] || s;
    };
    
    const displayText = shortStatus(status);
    
    switch (status) {
      case "New": return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 shrink-0" data-testid={`badge-status-new`}>{displayText}</Badge>;
      case "In Progress": return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 shrink-0" data-testid={`badge-status-progress`}>{displayText}</Badge>;
      case "Resolved": return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 shrink-0" data-testid={`badge-status-resolved`}>{displayText}</Badge>;
      case "Scheduled": return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 shrink-0" data-testid={`badge-status-scheduled`}>{displayText}</Badge>;
      case "In Review": return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100 shrink-0" data-testid={`badge-status-review`}>{displayText}</Badge>;
      default: return <Badge variant="secondary" className="shrink-0" data-testid={`badge-status-default`}>{displayText}</Badge>;
    }
  };

  const getUrgencyBadge = (urgency?: string) => {
    switch (urgency) {
      case "Emergency": return <Flame className="h-4 w-4 text-red-600" />;
      case "High": return <Flame className="h-4 w-4 text-orange-600" />;
      case "Medium": return <Flame className="h-4 w-4 text-yellow-600" />;
      case "Low": return <Flame className="h-4 w-4 text-blue-600" />;
      default: return <Flame className="h-4 w-4 text-gray-400" />;
    }
  };

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
            <div className="space-y-2">
              {filteredCases.map((smartCase) => (
                <div
                  key={smartCase.id}
                  className="p-3 border border-border rounded-lg hover:bg-accent hover:border-accent-foreground/20 transition-all cursor-pointer active:scale-[0.98]"
                  data-testid={`case-widget-${smartCase.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setLocation('/maintenance');
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {getUrgencyBadge(smartCase.priority || undefined)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {smartCase.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {smartCase.category || 'General'}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(smartCase.status || "New")}
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {smartCase.propertyId && (
                      <div className="flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        <span className="truncate">Property</span>
                      </div>
                    )}
                    {smartCase.assignedContractorId && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span className="truncate">Assigned</span>
                      </div>
                    )}
                    {smartCase.createdAt && (
                      <span className="ml-auto">
                        {new Date(smartCase.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
