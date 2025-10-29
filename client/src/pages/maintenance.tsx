import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Component, ErrorInfo, ReactNode } from "react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Wrench, AlertTriangle, Clock, CheckCircle, XCircle, Trash2, Bell, LayoutGrid, CalendarDays, Map, BarChart3, List, MapPin, Home, Tag, Eye, Play, Calendar as CalendarIcon, MessageSquare, Mail, Phone, TrendingUp, Target, DollarSign, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReminderForm from "@/components/forms/reminder-form";
import type { SmartCase, Property, OwnershipEntity, Unit, PredictiveInsight } from "@shared/schema";
import { format } from "date-fns";
import PropertyAssistant from "@/components/ai/property-assistant";
import { useRole } from "@/contexts/RoleContext";
import { TimePicker15Min } from "@/components/ui/time-picker-15min";
import EquipmentManagementModal from "@/components/modals/equipment-management-modal";
import AvailabilityCalendar from "@/components/contractor/availability-calendar";

// Predefined maintenance categories
// Error Boundary for Visualization Components
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class VisualizationErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Visualization Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Card data-testid="error-boundary-fallback">
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Visualization Error</h3>
            <p className="text-muted-foreground mb-4">
              There was an issue loading this view. Please try refreshing the page or switching to a different view.
            </p>
            <Button 
              onClick={() => this.setState({ hasError: false })}
              variant="outline"
              data-testid="button-retry-visualization"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

const MAINTENANCE_CATEGORIES = [
  "HVAC / Heating & Cooling",
  "Plumbing (Water, Drains, Sewer)",
  "Electrical & Lighting",
  "Appliances (Kitchen, Laundry, etc.)",
  "Roof / Structure / Exterior",
  "Pest & Odor Issues",
  "Safety & Security (locks, alarms, smoke detectors, windows/doors)",
  "General Interior (walls, ceilings, flooring, paint, cabinets)",
  "Outdoor / Landscaping (yard, snow removal, fencing, gutters)",
  "Other / Miscellaneous"
];

const createCaseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).default("Medium"),
  category: z.string().optional(),
  createReminder: z.boolean().default(false),
});

const proposeThreeSlotsSchema = z.object({
  slot1Date: z.date({
    required_error: "Please select a date for option 1",
  }),
  slot1Time: z.string().min(1, "Please select a time for option 1"),
  slot2Date: z.date({
    required_error: "Please select a date for option 2",
  }),
  slot2Time: z.string().min(1, "Please select a time for option 2"),
  slot3Date: z.date({
    required_error: "Please select a date for option 3",
  }),
  slot3Time: z.string().min(1, "Please select a time for option 3"),
  notes: z.string().optional(),
});

export default function Maintenance() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const { currentRole: role } = useRole();
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [editingCase, setEditingCase] = useState<SmartCase | null>(null);
  const [selectedCase, setSelectedCase] = useState<SmartCase | null>(null);
  const [showCaseDialog, setShowCaseDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderCaseContext, setReminderCaseContext] = useState<{caseId: string; caseTitle: string} | null>(null);
  const [currentView, setCurrentView] = useState<"cards" | "heat-map" | "kanban" | "list" | "insights">("cards");
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [acceptingCase, setAcceptingCase] = useState<SmartCase | null>(null);
  const [predictivePropertyFilter, setPredictivePropertyFilter] = useState<string>("all");
  const [predictiveEquipmentTypeFilter, setPredictiveEquipmentTypeFilter] = useState<string>("all");
  const [predictiveEntityFilter, setPredictiveEntityFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"maintenance" | "predictive">("maintenance");
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showAvailabilityCalendar, setShowAvailabilityCalendar] = useState(false);
  const [viewingProposalsCase, setViewingProposalsCase] = useState<SmartCase | null>(null);
  const [showProposalsDialog, setShowProposalsDialog] = useState(false);

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

  const { data: smartCases, isLoading: casesLoading, error } = useQuery<SmartCase[]>({
    queryKey: ["/api/cases"],
    retry: false,
  });

  const { data: predictiveInsights, isLoading: insightsLoading } = useQuery<PredictiveInsight[]>({
    queryKey: ["/api/predictive-insights"],
    retry: false,
  });

  const { data: properties } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    retry: false,
  });

  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    retry: false,
  });

  const { data: entities = [] } = useQuery<OwnershipEntity[]>({
    queryKey: ["/api/entities"],
    retry: false,
  });

  const { data: contractors = [] } = useQuery<any[]>({
    queryKey: ["/api/contractors"],
    retry: false,
  });

  // Fetch contractor's own profile if they're a contractor
  const { data: contractorProfile } = useQuery<any>({
    queryKey: ["/api/contractors/me"],
    enabled: role === "contractor",
    retry: false,
  });

  // Fetch predictive insights
  const { data: insights = [] } = useQuery<PredictiveInsight[]>({
    queryKey: ['/api/predictive-insights'],
    retry: false,
  });

  const selectedProperty = properties?.find(p => p.id === selectedPropertyId);
  const selectedPropertyUnits = units.filter(unit => unit.propertyId === selectedPropertyId);
  const isBuilding = selectedProperty?.type === "Commercial Building" || selectedProperty?.type === "Residential Building";
  const isMultiUnit = selectedPropertyUnits.length > 1;
  
  // Update selectedPropertyId when editing a case
  useEffect(() => {
    if (editingCase?.propertyId) {
      setSelectedPropertyId(editingCase.propertyId);
    } else {
      setSelectedPropertyId("");
    }
  }, [editingCase]);

  // Mutation for creating reminders
  const createReminderMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/reminders", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      setShowReminderForm(false);
      setReminderCaseContext(null);
      toast({
        title: "Success",
        description: "Reminder created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create reminder",
        variant: "destructive",
      });
    },
  });

  // Handle reminder form submission
  const handleReminderSubmit = (data: any) => {
    const reminderData = {
      ...data,
      type: "maintenance",
      scope: "asset", 
      scopeId: reminderCaseContext?.caseId,
      payloadJson: {
        caseId: reminderCaseContext?.caseId,
        caseTitle: reminderCaseContext?.caseTitle
      }
    };
    createReminderMutation.mutate(reminderData);
  };

  const form = useForm<z.infer<typeof createCaseSchema>>({
    resolver: zodResolver(createCaseSchema),
    defaultValues: editingCase ? {
      title: editingCase.title || "",
      description: editingCase.description || "",
      propertyId: editingCase.propertyId || "",
      unitId: editingCase.unitId || "",
      priority: editingCase.priority || "Medium",
      category: editingCase.category || "",
      createReminder: false,
    } : {
      title: "",
      description: "",
      priority: "Medium",
      createReminder: false,
    },
  });

  const createCaseMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createCaseSchema>) => {
      const response = await apiRequest("POST", "/api/cases", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      setShowCaseForm(false);
      setEditingCase(null);
      form.reset();
      toast({
        title: "Success",
        description: "Maintenance case created successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
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
      toast({
        title: "Error",
        description: "Failed to create maintenance case",
        variant: "destructive",
      });
    },
  });

  const updateCaseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof createCaseSchema> }) => {
      const response = await apiRequest("PATCH", `/api/cases/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      setShowCaseForm(false);
      setEditingCase(null);
      form.reset();
      toast({
        title: "Success",
        description: "Maintenance case updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
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
      toast({
        title: "Error",
        description: "Failed to update maintenance case",
        variant: "destructive",
      });
    },
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
        description: "Case status updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
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
      toast({
        title: "Error",
        description: "Failed to update case status",
        variant: "destructive",
      });
    },
  });

  const aiTriageMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const response = await apiRequest("POST", `/api/cases/${caseId}/ai-triage`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "AI Triage Complete",
        description: "Case has been analyzed and categorized",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to run AI triage",
        variant: "destructive",
      });
    },
  });

  const assignContractorMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const response = await apiRequest("POST", `/api/cases/${caseId}/assign-contractor`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "Contractor Assigned",
        description: "Best contractor has been assigned to this case",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign contractor",
        variant: "destructive",
      });
    },
  });

  const acceptCaseMutation = useMutation({
    mutationFn: async ({ caseId, appointmentData }: { caseId: string, appointmentData: any }) => {
      const response = await apiRequest("POST", `/api/contractor/cases/${caseId}/accept`, appointmentData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      setShowAcceptDialog(false);
      setAcceptingCase(null);
      toast({
        title: "Case Accepted",
        description: "Appointment has been scheduled. Tenant will be notified for approval.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to accept case",
        variant: "destructive",
      });
    },
  });

  const deleteCaseMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/cases/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      setShowCaseDialog(false);
      setSelectedCase(null);
      toast({
        title: "Success", 
        description: "Case deleted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
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
      toast({
        title: "Error",
        description: "Failed to delete case",
        variant: "destructive",
      });
    },
  });

  const handleDeleteCase = (id: string) => {
    deleteCaseMutation.mutate(id);
  };

  if (isLoading || !isAuthenticated) {
    return null;
  }

  if (error && isUnauthorizedError(error as Error)) {
    return null;
  }

  const getStatusIcon = (status: string | null) => {
    // Keep icon color neutral and visible
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

  const getStatusVariant = (status: string | null) => {
    switch (status) {
      case "New": return "destructive";
      case "In Review": return "secondary";
      case "Scheduled": return "outline";
      case "In Progress": return "default";
      case "On Hold": return "secondary";
      case "Resolved": return "default";
      case "Closed": return "outline";
      default: return "secondary";
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

  const getPriorityVariant = (priority: string | null): "default" | "destructive" | "outline" | "secondary" => {
    switch (priority) {
      case "Urgent": return "destructive";
      case "High": return "destructive";
      case "Medium": return "default";
      case "Low": return "secondary";
      default: return "secondary";
    }
  };

  const getPriorityBorderClass = (priority: string | null) => {
    switch (priority) {
      case "Urgent": return "[border-left-color:#ef4444] hover:[border-left-color:#dc2626]";
      case "High": return "[border-left-color:#f97316] hover:[border-left-color:#ea580c]";
      case "Medium": return "[border-left-color:#eab308] hover:[border-left-color:#ca8a04]";
      case "Low": return "[border-left-color:#6b7280] hover:[border-left-color:#4b5563]";
      default: return "[border-left-color:#d1d5db] hover:[border-left-color:#3b82f6]";
    }
  };

  const filteredProperties = properties || [];
  
  const filteredCases = smartCases?.filter(smartCase => {
    const statusMatch = statusFilter === "all" || smartCase.status === statusFilter;
    const propertyMatch = propertyFilter === "all" || smartCase.propertyId === propertyFilter;
    const categoryMatch = categoryFilter === "all" || smartCase.category === categoryFilter;
    const unitMatch = unitFilter.length === 0 || (smartCase.unitId && unitFilter.includes(smartCase.unitId)) || (unitFilter.includes("common") && !smartCase.unitId);
    // Note: SmartCase doesn't have entityId directly, but we can filter by property's entity relationship if needed
    return statusMatch && propertyMatch && categoryMatch && unitMatch;
  }) || [];

  const filteredInsights = predictiveInsights?.filter(insight => {
    const propertyMatch = predictivePropertyFilter === "all" || insight.propertyId === predictivePropertyFilter;
    const equipmentTypeMatch = predictiveEquipmentTypeFilter === "all" || insight.equipmentType === predictiveEquipmentTypeFilter;
    
    // Filter by entity - check property's ownerships
    let entityMatch = true;
    if (predictiveEntityFilter !== "all") {
      const property = properties?.find(p => p.id === insight.propertyId);
      if (property && property.ownerships) {
        entityMatch = property.ownerships.some(ownership => ownership.entityId === predictiveEntityFilter);
      } else {
        entityMatch = false;
      }
    }
    
    return propertyMatch && equipmentTypeMatch && entityMatch;
  }) || [];

  const onSubmit = async (data: z.infer<typeof createCaseSchema>) => {
    const { createReminder, ...caseData } = data;
    
    if (editingCase) {
      updateCaseMutation.mutate({ id: editingCase.id, data: { ...caseData, createReminder: false } });
    } else {
      // Create the case first
      const response = await apiRequest("POST", "/api/cases", caseData);
      const newCase = await response.json();
      
      // If reminder checkbox is checked, open reminder dialog
      if (createReminder) {
        setReminderCaseContext({
          caseId: newCase.id,
          caseTitle: caseData.title
        });
        setShowReminderForm(true);
      }
      
      // Update UI
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      setShowCaseForm(false);
      setEditingCase(null);
      form.reset();
      toast({
        title: "Success",
        description: "Maintenance case created successfully",
      });
    }
  };

  const handleEditCase = (smartCase: SmartCase) => {
    setEditingCase(smartCase);
    form.reset({
      title: smartCase.title || "",
      description: smartCase.description || "",
      propertyId: smartCase.propertyId || "",
      unitId: smartCase.unitId || "",
      priority: smartCase.priority || "Medium",
      category: smartCase.category || "",
      createReminder: false,
    });
    setShowCaseForm(true);
  };

  const handleCloseForm = () => {
    setShowCaseForm(false);
    setEditingCase(null);
    form.reset();
  };

  const handleDialogChange = (open: boolean) => {
    setShowCaseForm(open);
    if (!open) {
      setEditingCase(null);
      form.reset();
    }
  };

  return (
    <div className="flex h-screen bg-background" data-testid="page-maintenance">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Maintenance" />
        
        <main className="flex-1 overflow-auto p-6 bg-muted/30">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "maintenance" | "predictive")} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
              <TabsTrigger value="maintenance" data-testid="tab-maintenance">
                <Wrench className="h-4 w-4 mr-2" />
                Maintenance
              </TabsTrigger>
              <TabsTrigger value="predictive" data-testid="tab-predictive">
                <TrendingUp className="h-4 w-4 mr-2" />
                Predictive Maintenance
              </TabsTrigger>
            </TabsList>

            <TabsContent value="maintenance" className="mt-0">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Smart Cases</h1>
                  <p className="text-muted-foreground">Track and manage maintenance requests</p>
                </div>
            
            <div className="flex items-center space-x-3">
              {/* Contractor Availability Button */}
              {role === "contractor" && contractorProfile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAvailabilityCalendar(true)}
                  className="flex items-center gap-2"
                  data-testid="button-open-availability"
                >
                  <CalendarIcon className="h-4 w-4" />
                  My Availability
                </Button>
              )}
              
              {/* Entity Filter */}
              <Select value={entityFilter} onValueChange={(value) => {
                setEntityFilter(value);
                if (value !== "all") {
                  setPropertyFilter("all");
                }
              }}>
                <SelectTrigger className="w-44" data-testid="select-entity-filter">
                  <SelectValue placeholder="All Entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  {entities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>{entity.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Property Filter */}
              <Select value={propertyFilter} onValueChange={(value) => {
                setPropertyFilter(value);
                setUnitFilter([]); // Reset unit filter when property changes
              }}>
                <SelectTrigger className="w-52" data-testid="select-property-filter">
                  <SelectValue placeholder="All Properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {filteredProperties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name || `${property.street}, ${property.city}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Unit Selection - only show for buildings with multiple units */}
              {propertyFilter !== "all" && (() => {
                const selectedProperty = properties?.find(p => p.id === propertyFilter);
                const propertyUnits = units.filter(unit => unit.propertyId === propertyFilter);
                const isBuilding = propertyUnits.length > 1;
                
                if (!isBuilding) return null;

                const handleUnitToggle = (unitId: string) => {
                  const newFilter = [...unitFilter];
                  if (newFilter.includes(unitId)) {
                    setUnitFilter(newFilter.filter(id => id !== unitId));
                  } else {
                    setUnitFilter([...newFilter, unitId]);
                  }
                };
                
                return (
                  <div className="flex flex-col space-y-2 p-3 border rounded-md bg-muted/30">
                    <span className="text-sm font-medium">Units (Optional - leave empty to apply to entire building)</span>
                    <div className="grid grid-cols-2 gap-2 max-h-24 overflow-y-auto">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={unitFilter.includes("common")}
                          onChange={() => handleUnitToggle("common")}
                          className="rounded border-gray-300"
                          data-testid="checkbox-common-area"
                        />
                        <span className="text-sm">Common Area</span>
                      </label>
                      {propertyUnits.map((unit) => (
                        <label key={unit.id} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={unitFilter.includes(unit.id)}
                            onChange={() => handleUnitToggle(unit.id)}
                            className="rounded border-gray-300"
                            data-testid={`checkbox-unit-${unit.id}`}
                          />
                          <span className="text-sm">{unit.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-44" data-testid="select-category-filter">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {MAINTENANCE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="In Review">In Review</SelectItem>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              <Dialog open={showCaseForm} onOpenChange={handleDialogChange}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-case">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Case
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingCase ? "Edit Maintenance Case" : "Create Maintenance Case"}</DialogTitle>
                  </DialogHeader>
                  
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Describe the issue" 
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                name={field.name}
                                data-testid="input-case-title" 
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
                                placeholder="Provide additional details..." 
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                name={field.name}
                                data-testid="textarea-case-description" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="propertyId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Property</FormLabel>
                            <Select 
                              onValueChange={(value) => {
                                field.onChange(value);
                                setSelectedPropertyId(value);
                                form.setValue("unitId", "");
                              }} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-case-property">
                                  <SelectValue placeholder="Select a property" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {properties?.map((property) => (
                                  <SelectItem key={property.id} value={property.id}>
                                    {property.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Unit Selection - only show if property is selected and is a building with multiple units */}
                      {(() => {
                        const selectedPropertyForForm = properties?.find(p => p.id === selectedPropertyId);
                        const selectedPropertyUnitsForForm = units.filter(unit => unit.propertyId === selectedPropertyId);
                        const isBuildingForm = selectedPropertyId && selectedPropertyUnitsForForm.length > 1;
                        
                        return isBuildingForm && (
                        <FormField
                          control={form.control}
                          name="unitId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unit (Optional - leave empty to apply to entire building)</FormLabel>
                              <div className="grid grid-cols-2 gap-2 max-h-24 overflow-y-auto border rounded p-2">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="caseUnit"
                                    checked={field.value === "common"}
                                    onChange={() => field.onChange("common")}
                                    className="rounded border-gray-300"
                                    data-testid="radio-case-common"
                                  />
                                  <span className="text-sm">Common Area</span>
                                </label>
                                {selectedPropertyUnitsForForm.map((unit) => (
                                  <label key={unit.id} className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="caseUnit"
                                      checked={field.value === unit.id}
                                      onChange={() => field.onChange(unit.id)}
                                      className="rounded border-gray-300"
                                      data-testid={`radio-case-unit-${unit.id}`}
                                    />
                                    <span className="text-sm">{unit.label}</span>
                                  </label>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        );
                      })()}

                      <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-case-priority">
                                  <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Low">Low</SelectItem>
                                <SelectItem value="Medium">Medium</SelectItem>
                                <SelectItem value="High">High</SelectItem>
                                <SelectItem value="Urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-case-category">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {MAINTENANCE_CATEGORIES.map((category) => (
                                  <SelectItem key={category} value={category}>{category}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Create Reminder Checkbox - only show when creating new cases */}
                      {!editingCase && (
                        <FormField
                          control={form.control}
                          name="createReminder"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <input
                                  type="checkbox"
                                  checked={field.value}
                                  onChange={field.onChange}
                                  className="mt-1"
                                  data-testid="checkbox-create-reminder"
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm font-normal">
                                  Create a reminder for this case
                                </FormLabel>
                                <p className="text-xs text-muted-foreground">
                                  Opens reminder dialog after case creation
                                </p>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={handleCloseForm} data-testid="button-cancel-case">
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createCaseMutation.isPending || updateCaseMutation.isPending} data-testid="button-submit-case">
                          {(createCaseMutation.isPending || updateCaseMutation.isPending) 
                            ? (editingCase ? "Updating..." : "Creating...") 
                            : (editingCase ? "Update Case" : "Create Case")
                          }
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
            </TabsContent>

            <TabsContent value="predictive" className="mt-0">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Predictive Maintenance</h1>
                  <p className="text-muted-foreground">Equipment replacement predictions and insights</p>
                </div>
                <Button onClick={() => setShowEquipmentModal(true)} data-testid="button-manage-equipment">
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Equipment
                </Button>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3 mb-6">
                <Select value={predictivePropertyFilter} onValueChange={setPredictivePropertyFilter}>
                  <SelectTrigger className="w-52" data-testid="select-predictive-property-filter">
                    <SelectValue placeholder="All Properties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {properties?.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name || `${property.street}, ${property.city}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={predictiveEquipmentTypeFilter} onValueChange={setPredictiveEquipmentTypeFilter}>
                  <SelectTrigger className="w-52" data-testid="select-equipment-type-filter">
                    <SelectValue placeholder="All Equipment Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Equipment Types</SelectItem>
                    <SelectItem value="hvac">HVAC</SelectItem>
                    <SelectItem value="water_heater">Water Heater</SelectItem>
                    <SelectItem value="boiler">Boiler</SelectItem>
                    <SelectItem value="roof">Roof</SelectItem>
                    <SelectItem value="appliance">Appliance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={predictiveEntityFilter} onValueChange={setPredictiveEntityFilter}>
                  <SelectTrigger className="w-44" data-testid="select-predictive-entity-filter">
                    <SelectValue placeholder="All Entities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entities</SelectItem>
                    {entities?.map((entity) => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Predictive Insights Cards */}
              {insightsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading predictions...</p>
                </div>
              ) : filteredInsights.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Predictions Available</h3>
                    <p className="text-muted-foreground mb-4">
                      Add equipment to your properties to start generating predictive maintenance insights
                    </p>
                    <Button onClick={() => setShowEquipmentModal(true)} data-testid="button-add-equipment">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Equipment
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredInsights.map((insight) => {
                    const property = properties?.find(p => p.id === insight.propertyId);
                    const unit = units?.find(u => u.id === insight.unitId);
                    const daysUntil = insight.predictedDate 
                      ? Math.ceil((new Date(insight.predictedDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                      : null;
                    
                    const urgencyColor = daysUntil !== null && daysUntil < 90 
                      ? 'text-red-600 border-red-600 bg-red-50 dark:bg-red-950' 
                      : daysUntil !== null && daysUntil < 180 
                      ? 'text-orange-600 border-orange-600 bg-orange-50 dark:bg-orange-950'
                      : 'text-blue-600 border-blue-600 bg-blue-50 dark:bg-blue-950';

                    return (
                      <Card key={insight.id} className="hover:shadow-lg transition-shadow" data-testid={`card-insight-${insight.id}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className={urgencyColor}>
                                  {insight.equipmentType?.replace(/_/g, ' ').toUpperCase()}
                                </Badge>
                                {insight.confidence && (
                                  <Badge variant="outline" className="text-muted-foreground">
                                    {Math.round(Number(insight.confidence) * 100)}% confidence
                                  </Badge>
                                )}
                              </div>
                              <CardTitle className="text-base">{insight.prediction}</CardTitle>
                              <CardDescription className="mt-1">
                                {property?.name || `${property?.street}, ${property?.city}`}
                                {unit && ` • ${unit.unitNumber}`}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {insight.predictedDate && (
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                Expected: {format(new Date(insight.predictedDate), 'MMM d, yyyy')}
                                {daysUntil !== null && ` (${daysUntil} days)`}
                              </span>
                            </div>
                          )}
                          {insight.estimatedCost && (
                            <div className="flex items-center gap-2 text-sm">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold">
                                ${Number(insight.estimatedCost).toLocaleString()}
                              </span>
                              <span className="text-muted-foreground">estimated cost</span>
                            </div>
                          )}
                          {insight.basedOnDataPoints && (
                            <div className="text-xs text-muted-foreground">
                              Based on {insight.basedOnDataPoints} data point{insight.basedOnDataPoints !== 1 ? 's' : ''}
                            </div>
                          )}
                          <div className="pt-2 border-t">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full"
                              onClick={() => {
                                setSelectedPropertyId(insight.propertyId || '');
                                setShowEquipmentModal(true);
                              }}
                              data-testid={`button-manage-equipment-${insight.id}`}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Manage Equipment
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Maya AI Assistant */}
          <PropertyAssistant 
            context={activeTab === "predictive" ? "predictive-maintenance" : "maintenance"}
            exampleQuestions={activeTab === "predictive" ? [
              "Which equipment is most likely to fail soon?",
              "What's the total cost of upcoming replacements?",
              "Which property has the highest equipment risk?",
              "What equipment should I budget for this year?"
            ] : [
              "What maintenance is overdue or urgent?",
              "Which property needs the most attention?",
              "Any recurring maintenance patterns I should address?",
              "What repairs are costing me the most?"
            ]}
            onCreateCase={(caseData) => {
              // Validate case data
              if (!caseData?.property || !caseData?.unit) {
                toast({
                  title: "Incomplete Information",
                  description: "Maya needs property and unit information to create the case. Please provide these details.",
                  variant: "destructive",
                });
                return;
              }

              // Fuzzy matching helper function
              const fuzzyMatch = (search: string, target: string): number => {
                const searchLower = search.toLowerCase().trim();
                const targetLower = target.toLowerCase().trim();
                
                // Empty search string = no match (prevents accidental matches)
                if (!searchLower || searchLower.length === 0) return 0;
                if (!targetLower || targetLower.length === 0) return 0;
                
                // Exact match = 100%
                if (searchLower === targetLower) return 100;
                
                // Contains match = 80%
                if (targetLower.includes(searchLower) || searchLower.includes(targetLower)) return 80;
                
                // Word overlap
                const searchWords = searchLower.split(/\s+/).filter(w => w.length > 0);
                const targetWords = targetLower.split(/\s+/).filter(w => w.length > 0);
                const overlap = searchWords.filter(w => targetWords.includes(w)).length;
                if (overlap > 0) return Math.min(60 + (overlap * 10), 75);
                
                return 0;
              };

              // Require non-empty property/unit names before matching
              const normalizedPropertyName = caseData.property?.trim() || '';
              if (!normalizedPropertyName) {
                toast({
                  title: "Missing Property",
                  description: "Please specify which property this maintenance issue is for.",
                  variant: "destructive",
                });
                return;
              }

              // Find best property match using fuzzy matching
              const propertyMatches = (properties || []).map(p => ({
                property: p,
                score: fuzzyMatch(normalizedPropertyName, p.name || '')
              })).filter(m => m.score >= 60).sort((a, b) => b.score - a.score);
              
              const bestPropertyMatch = propertyMatches[0];
              
              // If no good property match found, can't proceed
              if (!bestPropertyMatch || bestPropertyMatch.score < 60) {
                toast({
                  title: "Could Not Find Property",
                  description: `Could not match "${caseData.property}" to your properties. Please create the case manually.`,
                  variant: "destructive",
                });
                
                // Pre-fill the form and open it for manual entry
                form.reset({
                  title: caseData.title || "",
                  description: caseData.description || "",
                  priority: (caseData.priority as "Low" | "Medium" | "High" | "Urgent") || "Medium",
                  category: caseData.category || "",
                  createReminder: false
                });
                setShowCaseForm(true);
                return;
              }

              const property = bestPropertyMatch.property;

              // Require non-empty unit name before matching
              const normalizedUnitName = caseData.unit?.trim() || '';
              if (!normalizedUnitName) {
                toast({
                  title: "Missing Unit",
                  description: "Please specify which unit this maintenance issue is for.",
                  variant: "destructive",
                });
                return;
              }

              // Find best unit match using fuzzy matching within the property
              const propertyUnits = (units || []).filter(u => u.propertyId === property.id);
              const unitMatches = propertyUnits.map(u => ({
                unit: u,
                score: fuzzyMatch(normalizedUnitName, u.label || '')
              })).filter(m => m.score >= 60).sort((a, b) => b.score - a.score);

              const bestUnitMatch = unitMatches[0];

              // Validate we found matching unit in the property
              if (!bestUnitMatch || bestUnitMatch.score < 60) {
                toast({
                  title: "Could Not Find Unit",
                  description: `Could not match "${caseData.unit}" to units in ${property.name}. Please create the case manually.`,
                  variant: "destructive",
                });
                
                // Pre-fill the form and open it for manual entry
                form.reset({
                  title: caseData.title || "",
                  description: caseData.description || "",
                  priority: (caseData.priority as "Low" | "Medium" | "High" | "Urgent") || "Medium",
                  category: caseData.category || "",
                  createReminder: false
                });
                setShowCaseForm(true);
                return;
              }

              const unit = bestUnitMatch.unit;

              // Create the case with validated IDs
              const newCaseData = {
                title: caseData.title || "Maintenance Request",
                description: caseData.description || "",
                propertyId: property.id,
                unitId: unit.id,
                priority: (caseData.priority as "Low" | "Medium" | "High" | "Urgent") || "Medium",
                category: caseData.category || "",
                createReminder: false
              };

              createCaseMutation.mutate(newCaseData);
              
              // Show match confidence if not 100%
              const isExactMatch = bestPropertyMatch.score === 100 && bestUnitMatch.score === 100;
              const matchMessage = isExactMatch 
                ? `Creating maintenance request for ${property.name}, ${unit.label}...`
                : `Matched to ${property.name}, ${unit.label}. Creating request...`;
              
              toast({
                title: "Creating Case",
                description: matchMessage,
              });
            }}
          />

          {/* Predictive Insights Banner */}
          {insights.length > 0 && (
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 mb-6" data-testid="card-insights-banner">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    <CardTitle>Predictive Maintenance Insights</CardTitle>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setCurrentView('insights')}
                    data-testid="button-view-all-insights-banner"
                  >
                    View All Insights
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[...insights]
                    .sort((a, b) => parseFloat(b.confidence || '0') - parseFloat(a.confidence || '0'))
                    .slice(0, 3)
                    .map((insight) => (
                      <div 
                        key={insight.id} 
                        className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg"
                        data-testid={`insight-banner-${insight.id}`}
                      >
                        <Target className="h-4 w-4 mt-1 text-blue-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-2">{insight.prediction}</p>
                          {insight.predictedDate && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Expected: {format(new Date(insight.predictedDate), 'MMM d, yyyy')}
                            </p>
                          )}
                          <Badge variant="outline" className="text-xs mt-2">
                            {Math.round(parseFloat(insight.confidence ?? '0') * 100)}% confidence
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Bar and View Toggle */}
          <div className="bg-background border rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              {filteredCases.length > 0 ? (
                <div className="flex items-center space-x-6">
                  <div className="text-sm">
                    <span className="font-semibold text-foreground" data-testid="text-total-cases">{filteredCases.length}</span>
                    <span className="text-muted-foreground ml-1">Total Cases</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold text-red-600" data-testid="text-urgent-cases">
                      {filteredCases.filter(c => c.priority === "Urgent").length}
                    </span>
                    <span className="text-muted-foreground ml-1">Urgent</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold text-orange-600" data-testid="text-high-cases">
                      {filteredCases.filter(c => c.priority === "High").length}
                    </span>
                    <span className="text-muted-foreground ml-1">High</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold text-yellow-600" data-testid="text-medium-cases">
                      {filteredCases.filter(c => c.priority === "Medium").length}
                    </span>
                    <span className="text-muted-foreground ml-1">Medium</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold text-green-600" data-testid="text-open-cases">
                      {filteredCases.filter(c => c.status === "New" || c.status === "In Progress" || c.status === "Scheduled").length}
                    </span>
                    <span className="text-muted-foreground ml-1">Active</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Ready to track maintenance cases
                </div>
              )}
              
              {/* View Toggle Buttons - Always Visible */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground mr-2">View:</span>
                <Button
                  variant={currentView === "cards" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentView("cards")}
                  data-testid="button-view-cards"
                >
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  Cards
                </Button>
                <Button
                  variant={currentView === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentView("list")}
                  data-testid="button-view-list"
                >
                  <List className="h-4 w-4 mr-1" />
                  List
                </Button>
                <Button
                  variant={currentView === "heat-map" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentView("heat-map")}
                  data-testid="button-view-heat-map"
                >
                  <Map className="h-4 w-4 mr-1" />
                  Heat Map
                </Button>
                <Button
                  variant={currentView === "kanban" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentView("kanban")}
                  data-testid="button-view-kanban"
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Kanban
                </Button>
                <Button
                  variant={currentView === "insights" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentView("insights")}
                  data-testid="button-view-insights"
                >
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Insights
                </Button>
              </div>
            </div>
          </div>

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
          ) : filteredCases.length > 0 ? (
            <>
              {/* Render different views based on currentView state */}
              {currentView === "cards" && (
                <VisualizationErrorBoundary>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredCases.map((smartCase, index) => (
                <Card key={smartCase.id} className={`group hover:shadow-lg transition-all duration-200 border border-transparent border-l-4 ${getPriorityBorderClass(smartCase.priority)}`} data-testid={`card-case-${index}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className={`w-10 h-10 ${getPriorityCircleColor(smartCase.priority)} rounded-full flex items-center justify-center flex-shrink-0`}>
                          {getStatusIcon(smartCase.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base font-semibold leading-tight mb-1" data-testid={`text-case-title-${index}`}>
                            {smartCase.title}
                          </CardTitle>
                          {smartCase.category && (
                            <p className="text-xs text-muted-foreground truncate" data-testid={`text-case-category-${index}`}>
                              {smartCase.category}
                            </p>
                          )}
                          {smartCase.propertyId && (
                            <p className="text-xs text-blue-600 font-medium mt-1 truncate">
                              {(() => {
                                const property = properties?.find(p => p.id === smartCase.propertyId);
                                return property ? (property.name || `${property.street}, ${property.city}`) : 'Property';
                              })()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-1 flex-shrink-0">
                        {getPriorityBadge(smartCase.priority)}
                        {getStatusBadge(smartCase.status)}
                        <div className="text-xs text-muted-foreground">
                          {smartCase.createdAt ? new Date(smartCase.createdAt).toLocaleDateString() : 'Unknown'}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    {/* Appointment Details - Show when status is Scheduled */}
                    {smartCase.status === 'Scheduled' && (
                      <AppointmentInfo caseId={smartCase.id} />
                    )}
                    
                    {/* Description with progressive disclosure */}
                    {smartCase.description && (
                      <div className="mb-3">
                        <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-case-description-${index}`}>
                          {smartCase.description}
                        </p>
                      </div>
                    )}
                    
                    {/* Status Badge and Cost - Prominent Display */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(smartCase.status)}
                        {smartCase.unitId && (
                          <span className="text-xs bg-muted px-2 py-1 rounded">
                            Unit {units.find(u => u.id === smartCase.unitId)?.label || 'N/A'}
                          </span>
                        )}
                      </div>
                      {smartCase.estimatedCost && (
                        <div className="text-right">
                          <span className="text-sm font-semibold text-foreground" data-testid={`text-case-cost-${index}`}>
                            ${Number(smartCase.estimatedCost).toLocaleString()}
                          </span>
                          <p className="text-xs text-muted-foreground">Est. Cost</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Quick Actions Row */}
                    <div className="flex items-center space-x-2">
                      {/* Status Dropdown - Compact */}
                      <Select 
                        value={smartCase.status || "New"} 
                        onValueChange={(newStatus) => updateCaseStatusMutation.mutate({ id: smartCase.id, status: newStatus })}
                      >
                        <SelectTrigger className="h-8 text-xs flex-1" data-testid={`select-case-status-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="New">New</SelectItem>
                          <SelectItem value="In Review">In Review</SelectItem>
                          <SelectItem value="Scheduled">Scheduled</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="On Hold">On Hold</SelectItem>
                          <SelectItem value="Resolved">Resolved</SelectItem>
                          <SelectItem value="Closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {/* Action Buttons - Icon Only for Compact Design */}
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleEditCase(smartCase)}
                        data-testid={`button-edit-case-${index}`}
                        title="Edit Case"
                      >
                        <Wrench className="h-3 w-3" />
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setReminderCaseContext({
                            caseId: smartCase.id,
                            caseTitle: smartCase.title
                          });
                          setShowReminderForm(true);
                        }}
                        data-testid={`button-remind-case-${index}`}
                        title="Add Reminder"
                      >
                        <Bell className="h-3 w-3" />
                      </Button>
                      
                      {/* Accept Case Button (Contractor Only) */}
                      {role === 'contractor' && smartCase.status === 'New' && (
                        <Button 
                          variant="default" 
                          size="sm"
                          className="h-8 px-3"
                          onClick={() => {
                            setAcceptingCase(smartCase);
                            setShowAcceptDialog(true);
                          }}
                          data-testid={`button-accept-case-${index}`}
                          title="Accept Case"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Accept
                        </Button>
                      )}
                      
                      {/* View Proposals/Appointment Button - Show when status indicates proposals or scheduled */}
                      {smartCase.status === 'In Review' && role !== 'contractor' && (
                        <Button 
                          variant="default" 
                          size="sm"
                          className="h-8 px-3"
                          onClick={() => {
                            setViewingProposalsCase(smartCase);
                            setShowProposalsDialog(true);
                          }}
                          data-testid={`button-view-proposals-${index}`}
                          title="View Proposals"
                        >
                          <CalendarDays className="h-3 w-3 mr-1" />
                          Proposals
                        </Button>
                      )}
                      
                      {smartCase.status === 'Scheduled' && role !== 'contractor' && (
                        <Button 
                          variant="default" 
                          size="sm"
                          className="h-8 px-3"
                          onClick={() => {
                            setViewingProposalsCase(smartCase);
                            setShowProposalsDialog(true);
                          }}
                          data-testid={`button-view-appointment-${index}`}
                          title="View Appointment"
                        >
                          <CalendarDays className="h-3 w-3 mr-1" />
                          View Appointment
                        </Button>
                      )}
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this case? This action cannot be undone.")) {
                            deleteCaseMutation.mutate(smartCase.id);
                          }
                        }}
                        data-testid={`button-delete-case-${index}`}
                        title="Delete Case"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                  ))}
                </div>
                </VisualizationErrorBoundary>
              )}

              {/* List View */}
              {currentView === "list" && (
                <VisualizationErrorBoundary>
                <div className="space-y-4">
                  {/* List Header */}
                  <div className="bg-background border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Maintenance Cases</h3>
                      <Badge variant="outline" data-testid="list-total-count">
                        {filteredCases.length} cases
                      </Badge>
                    </div>
                  </div>

                  {/* List Items */}
                  <div className="space-y-2">
                    {filteredCases.map((smartCase, index) => {
                      const property = properties?.find(p => p.id === smartCase.propertyId);
                      const unit = units.find(u => u.id === smartCase.unitId);
                      
                      return (
                        <Card key={smartCase.id} className="hover:shadow-md transition-all duration-200" data-testid={`list-case-${index}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4 flex-1">
                                {/* Priority Indicator */}
                                <div className={`w-3 h-3 ${getPriorityCircleColor(smartCase.priority)} rounded-full flex-shrink-0`}></div>
                                
                                {/* Case Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <h4 className="font-medium text-sm truncate">{smartCase.title}</h4>
                                    {getPriorityBadge(smartCase.priority)}
                                  </div>
                                  <div className="text-xs text-muted-foreground space-y-1">
                                    <div className="flex items-center space-x-4">
                                      <div className="flex items-center">
                                        <MapPin className="h-3 w-3 mr-1" />
                                        <span className="truncate">
                                          {property?.name || `${property?.street}, ${property?.city}` || "Unknown Property"}
                                        </span>
                                      </div>
                                      {unit && (
                                        <div className="flex items-center">
                                          <Home className="h-3 w-3 mr-1" />
                                          <span>Unit {unit.label}</span>
                                        </div>
                                      )}
                                      <div className="flex items-center">
                                        <Tag className="h-3 w-3 mr-1" />
                                        <span>{smartCase.category || "General"}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Status and Actions */}
                              <div className="flex items-center space-x-3">
                                <Badge variant={getStatusVariant(smartCase.status)} className="text-xs">
                                  {smartCase.status || "New"}
                                </Badge>
                                {smartCase.createdAt && (
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(smartCase.createdAt), "MMM d, yyyy")}
                                  </span>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedCase(smartCase);
                                    setShowCaseDialog(true);
                                  }}
                                  data-testid={`button-view-list-case-${smartCase.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
                </VisualizationErrorBoundary>
              )}

              {/* Heat Map View */}
              {currentView === "heat-map" && (
                <VisualizationErrorBoundary>
                <div className="space-y-6">
                  {/* Heat Map Legend */}
                  <div className="bg-background border rounded-lg p-4" data-testid="heat-map-legend">
                    <h3 className="text-sm font-semibold mb-3">Heat Map Legend</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div className="flex items-center space-x-2" data-testid="legend-urgent">
                        <div className="w-4 h-4 bg-red-500 rounded border"></div>
                        <span>Urgent Cases</span>
                      </div>
                      <div className="flex items-center space-x-2" data-testid="legend-high">
                        <div className="w-4 h-4 bg-orange-500 rounded border"></div>
                        <span>High Priority</span>
                      </div>
                      <div className="flex items-center space-x-2" data-testid="legend-medium">
                        <div className="w-4 h-4 bg-yellow-500 rounded border"></div>
                        <span>Medium Priority</span>
                      </div>
                      <div className="flex items-center space-x-2" data-testid="legend-low">
                        <div className="w-4 h-4 bg-gray-300 rounded border"></div>
                        <span>Low/No Issues</span>
                      </div>
                      <div className="flex items-center space-x-2" data-testid="legend-resolved">
                        <div className="w-4 h-4 bg-green-500 rounded border"></div>
                        <span>Resolved</span>
                      </div>
                      <div className="flex items-center space-x-2" data-testid="legend-closed">
                        <div className="w-4 h-4 bg-gray-600 rounded border"></div>
                        <span>Closed</span>
                      </div>
                      <div className="flex items-center space-x-2" data-testid="legend-in-progress">
                        <div className="w-4 h-4 bg-blue-500 rounded border"></div>
                        <span>In Progress</span>
                      </div>
                      <div className="flex items-center space-x-2" data-testid="legend-on-hold">
                        <div className="w-4 h-4 bg-purple-500 rounded border"></div>
                        <span>On Hold</span>
                      </div>
                    </div>
                  </div>

                  {/* Properties Heat Map */}
                  {properties && properties.length > 0 ? (
                    <div className="space-y-6">
                      {properties
                        .filter(property => propertyFilter === "all" || property.id === propertyFilter)
                        .map((property) => {
                          const propertyUnits = units.filter(unit => unit.propertyId === property.id);
                          const propertyCases = filteredCases.filter(case_ => case_.propertyId === property.id);
                          
                          return (
                            <div key={property.id} className="bg-background border rounded-lg p-4" data-testid={`heat-map-property-${property.id}`}>
                              <div className="flex items-center justify-between mb-4">
                                <div>
                                  <h3 className="font-semibold text-lg">
                                    {property.name || `${property.street}, ${property.city}`}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    {propertyUnits.length} units • {propertyCases.length} active cases
                                  </p>
                                </div>
                                <div className="text-right text-sm">
                                  <span className="text-red-600 font-medium">
                                    {propertyCases.filter(c => c.priority === "Urgent").length} Urgent
                                  </span>
                                  <span className="text-orange-600 font-medium ml-3">
                                    {propertyCases.filter(c => c.priority === "High").length} High
                                  </span>
                                </div>
                              </div>
                              
                              {propertyUnits.length > 0 ? (
                                <div className="grid grid-cols-8 md:grid-cols-12 lg:grid-cols-16 xl:grid-cols-20 gap-2">
                                  {propertyUnits.map((unit) => {
                                    const unitCases = propertyCases.filter(case_ => case_.unitId === unit.id);
                                    const hasUrgent = unitCases.some(c => c.priority === "Urgent");
                                    const hasHigh = unitCases.some(c => c.priority === "High");
                                    const hasMedium = unitCases.some(c => c.priority === "Medium");
                                    const hasResolved = unitCases.some(c => c.status === "Resolved");
                                    const hasClosed = unitCases.some(c => c.status === "Closed");
                                    const hasInProgress = unitCases.some(c => c.status === "In Progress");
                                    const hasOnHold = unitCases.some(c => c.status === "On Hold");
                                    
                                    const getUnitColor = () => {
                                      if (hasUrgent) return "bg-red-500 hover:bg-red-600";
                                      if (hasHigh) return "bg-orange-500 hover:bg-orange-600";
                                      if (hasMedium) return "bg-yellow-500 hover:bg-yellow-600";
                                      if (hasInProgress) return "bg-blue-500 hover:bg-blue-600";
                                      if (hasOnHold) return "bg-purple-500 hover:bg-purple-600";
                                      if (hasResolved) return "bg-green-500 hover:bg-green-600";
                                      if (hasClosed) return "bg-gray-600 hover:bg-gray-700";
                                      return "bg-gray-300 hover:bg-gray-400";
                                    };
                                    
                                    return (
                                      <div
                                        key={unit.id}
                                        className={`w-8 h-8 ${getUnitColor()} rounded border border-white cursor-pointer transition-all duration-200 flex items-center justify-center text-white text-xs font-medium shadow-sm hover:shadow-md`}
                                        title={`Unit ${unit.label}: ${unitCases.length} cases`}
                                        data-testid={`heat-map-unit-${unit.id}`}
                                      >
                                        {unit.label}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                  <div className="mb-2">No units defined for this property</div>
                                  {propertyCases.length > 0 && (
                                    <div className="text-sm">
                                      {propertyCases.length} cases assigned to property level
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="bg-background border rounded-lg p-8 text-center">
                      <Map className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Properties Found</h3>
                      <p className="text-muted-foreground">Add properties to see heat map visualization</p>
                    </div>
                  )}
                </div>
                </VisualizationErrorBoundary>
              )}

              {/* Kanban View */}
              {currentView === "kanban" && (
                <VisualizationErrorBoundary>
                <div className="space-y-4">
                  {/* Kanban Board */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 min-h-[600px]">
                    {["New", "In Review", "Scheduled", "In Progress", "On Hold", "Resolved", "Closed"].map((status) => {
                      const statusCases = filteredCases.filter(case_ => case_.status === status);
                      const getStatusColor = (status: string) => {
                        switch (status) {
                          case "New": return "border-t-red-500 bg-red-50 dark:bg-red-950/20";
                          case "In Review": return "border-t-orange-500 bg-orange-50 dark:bg-orange-950/20";
                          case "Scheduled": return "border-t-yellow-500 bg-yellow-50 dark:bg-yellow-950/20";
                          case "In Progress": return "border-t-blue-500 bg-blue-50 dark:bg-blue-950/20";
                          case "On Hold": return "border-t-purple-500 bg-purple-50 dark:bg-purple-950/20";
                          case "Resolved": return "border-t-green-500 bg-green-50 dark:bg-green-950/20";
                          case "Closed": return "border-t-gray-500 bg-gray-50 dark:bg-gray-950/20";
                          default: return "border-t-gray-300 bg-gray-50 dark:bg-gray-950/20";
                        }
                      };

                      const handleDragOver = (e: React.DragEvent) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      };

                      const handleDrop = async (e: React.DragEvent) => {
                        e.preventDefault();
                        const dragData = e.dataTransfer.getData("text/plain");
                        if (dragData) {
                          const { caseId, fromStatus } = JSON.parse(dragData);
                          if (fromStatus !== status) {
                            try {
                              await updateCaseStatusMutation.mutateAsync({
                                id: caseId,
                                status: status
                              });
                            } catch (error) {
                              console.error('Error updating case status:', error);
                            }
                          }
                        }
                      };

                      return (
                        <div 
                          key={status} 
                          className={`${getStatusColor(status)} border border-t-4 rounded-lg p-4 h-fit min-h-[400px]`}
                          data-testid={`kanban-column-${status.toLowerCase().replace(' ', '-')}`}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                        >
                          {/* Column Header */}
                          <div className="flex items-center justify-between mb-4 pb-2 border-b">
                            <h3 className="font-semibold text-lg">{status}</h3>
                            <Badge variant="outline" className="text-xs" data-testid={`kanban-count-${status.toLowerCase().replace(' ', '-')}`}>
                              {statusCases.length}
                            </Badge>
                          </div>

                          {/* Cases in Column */}
                          <div className="space-y-3">
                            {statusCases.length > 0 ? (
                              statusCases.map((smartCase, index) => {
                                const property = properties?.find(p => p.id === smartCase.propertyId);
                                const unit = units.find(u => u.id === smartCase.unitId);
                                
                                return (
                                  <Card 
                                    key={smartCase.id} 
                                    className="group hover:shadow-md transition-all duration-200 cursor-move border border-gray-200 dark:border-gray-700"
                                    data-testid={`kanban-card-${smartCase.id}`}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData("text/plain", JSON.stringify({
                                        caseId: smartCase.id,
                                        fromStatus: smartCase.status
                                      }));
                                      e.dataTransfer.effectAllowed = "move";
                                    }}
                                  >
                                    <CardContent className="p-3">
                                      {/* Priority Badge */}
                                      <div className="flex items-start justify-between mb-2">
                                        <div className={`w-3 h-3 ${getPriorityCircleColor(smartCase.priority)} rounded-full flex-shrink-0 mt-1`}></div>
                                        {getPriorityBadge(smartCase.priority)}
                                      </div>
                                      
                                      {/* Case Title */}
                                      <h4 className="font-medium text-sm mb-2 line-clamp-2 group-hover:text-primary">
                                        {smartCase.title}
                                      </h4>
                                      
                                      {/* Property & Unit Info */}
                                      <div className="text-xs text-muted-foreground mb-2 space-y-1">
                                        <div className="flex items-center">
                                          <MapPin className="h-3 w-3 mr-1" />
                                          <span className="truncate">
                                            {property?.name || `${property?.street}, ${property?.city}` || "Unknown Property"}
                                          </span>
                                        </div>
                                        {unit && (
                                          <div className="flex items-center">
                                            <Home className="h-3 w-3 mr-1" />
                                            <span>Unit {unit.label}</span>
                                          </div>
                                        )}
                                      </div>
                                      
                                      {/* Category & Date */}
                                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                                          {smartCase.category || "General"}
                                        </span>
                                        {smartCase.createdAt && (
                                          <span>
                                            {format(new Date(smartCase.createdAt), "MMM d")}
                                          </span>
                                        )}
                                      </div>
                                      
                                      {/* Quick Actions */}
                                      <div className="flex items-center space-x-1 mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 px-2 text-xs"
                                          onClick={() => {
                                            setSelectedCase(smartCase);
                                            setShowCaseDialog(true);
                                          }}
                                          data-testid={`button-view-case-${smartCase.id}`}
                                        >
                                          <Eye className="h-3 w-3 mr-1" />
                                          View
                                        </Button>
                                        
                                        {/* Status Change Buttons */}
                                        {status !== "In Progress" && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700"
                                            onClick={async () => {
                                              try {
                                                await updateCaseStatusMutation.mutateAsync({
                                                  id: smartCase.id,
                                                  status: "In Progress"
                                                });
                                              } catch (error) {
                                                console.error('Error updating case status:', error);
                                              }
                                            }}
                                            disabled={updateCaseStatusMutation.isPending}
                                            data-testid={`button-start-case-${smartCase.id}`}
                                          >
                                            <Play className="h-3 w-3 mr-1" />
                                            Start
                                          </Button>
                                        )}
                                        
                                        {status !== "Resolved" && status !== "Closed" && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 px-2 text-xs text-green-600 hover:text-green-700"
                                            onClick={async () => {
                                              try {
                                                await updateCaseStatusMutation.mutateAsync({
                                                  id: smartCase.id,
                                                  status: "Resolved"
                                                });
                                              } catch (error) {
                                                console.error('Error updating case status:', error);
                                              }
                                            }}
                                            disabled={updateCaseStatusMutation.isPending}
                                            data-testid={`button-resolve-case-${smartCase.id}`}
                                          >
                                            <CheckCircle className="h-3 w-3 mr-1" />
                                            Resolve
                                          </Button>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })
                            ) : (
                              <div className="text-center py-8 text-muted-foreground">
                                <div className="text-sm">No {status.toLowerCase()} cases</div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                </VisualizationErrorBoundary>
              )}

              {/* Insights View */}
              {currentView === "insights" && (
                <div className="space-y-6">
                  {insights.length > 0 ? (
                    <>
                      {/* Equipment Failure Predictions */}
                      {insights.filter(i => i.insightType === 'equipment_failure').length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-red-600" />
                            Equipment Failure Predictions
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {insights
                              .filter(i => i.insightType === 'equipment_failure')
                              .map((insight) => (
                                <Card key={insight.id} className="hover:shadow-md transition-shadow" data-testid={`insight-card-${insight.id}`}>
                                  <CardHeader>
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-start gap-3 flex-1">
                                        <Wrench className="h-5 w-5 text-red-600 mt-1" />
                                        <div className="flex-1">
                                          <CardTitle className="text-base">{insight.prediction}</CardTitle>
                                          {insight.reasoning && (
                                            <p className="text-sm text-muted-foreground mt-1">{insight.reasoning}</p>
                                          )}
                                        </div>
                                      </div>
                                      <Badge variant={parseFloat(insight.confidence ?? '0') >= 0.8 ? "default" : "secondary"}>
                                        {Math.round(parseFloat(insight.confidence ?? '0') * 100)}%
                                      </Badge>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-3">
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                      {insight.predictedDate && (
                                        <div className="flex items-center gap-2">
                                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                          <div>
                                            <p className="text-xs text-muted-foreground">Predicted Date</p>
                                            <p className="font-medium">{format(new Date(insight.predictedDate), 'MMM d, yyyy')}</p>
                                          </div>
                                        </div>
                                      )}
                                      {insight.estimatedCost && (
                                        <div className="flex items-center gap-2">
                                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                                          <div>
                                            <p className="text-xs text-muted-foreground">Estimated Cost</p>
                                            <p className="font-medium">${Math.round(parseFloat(insight.estimatedCost))}</p>
                                          </div>
                                        </div>
                                      )}
                                      {insight.basedOnDataPoints && (
                                        <div className="flex items-center gap-2">
                                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                          <div>
                                            <p className="text-xs text-muted-foreground">Based On</p>
                                            <p className="font-medium">{insight.basedOnDataPoints} data points</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    {insight.recommendations && insight.recommendations.length > 0 && (
                                      <div className="pt-3 border-t">
                                        <p className="text-sm font-medium mb-2">Recommendations:</p>
                                        <ul className="list-disc list-inside space-y-1">
                                          {insight.recommendations.map((rec: string, idx: number) => (
                                            <li key={idx} className="text-sm text-muted-foreground">{rec}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* High Maintenance Units */}
                      {insights.filter(i => i.insightType === 'high_maintenance_unit').length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-orange-600" />
                            High Maintenance Units
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {insights
                              .filter(i => i.insightType === 'high_maintenance_unit')
                              .map((insight) => (
                                <Card key={insight.id} className="hover:shadow-md transition-shadow">
                                  <CardHeader>
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-start gap-3 flex-1">
                                        <AlertTriangle className="h-5 w-5 text-orange-600 mt-1" />
                                        <div className="flex-1">
                                          <CardTitle className="text-base">{insight.prediction}</CardTitle>
                                          {insight.reasoning && (
                                            <p className="text-sm text-muted-foreground mt-1">{insight.reasoning}</p>
                                          )}
                                        </div>
                                      </div>
                                      <Badge variant="secondary">
                                        {Math.round(parseFloat(insight.confidence ?? '0') * 100)}%
                                      </Badge>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-3">
                                    {insight.recommendations && insight.recommendations.length > 0 && (
                                      <div>
                                        <p className="text-sm font-medium mb-2">Recommendations:</p>
                                        <ul className="list-disc list-inside space-y-1">
                                          {insight.recommendations.map((rec: string, idx: number) => (
                                            <li key={idx} className="text-sm text-muted-foreground">{rec}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Problematic Contractors */}
                      {insights.filter(i => i.insightType === 'problematic_contractor').length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                            Contractor Performance Insights
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {insights
                              .filter(i => i.insightType === 'problematic_contractor')
                              .map((insight) => (
                                <Card key={insight.id} className="hover:shadow-md transition-shadow">
                                  <CardHeader>
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-start gap-3 flex-1">
                                        <TrendingUp className="h-5 w-5 text-blue-600 mt-1" />
                                        <div className="flex-1">
                                          <CardTitle className="text-base">{insight.prediction}</CardTitle>
                                          {insight.reasoning && (
                                            <p className="text-sm text-muted-foreground mt-1">{insight.reasoning}</p>
                                          )}
                                        </div>
                                      </div>
                                      <Badge variant="outline">
                                        {Math.round(parseFloat(insight.confidence ?? '0') * 100)}%
                                      </Badge>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-3">
                                    {insight.recommendations && insight.recommendations.length > 0 && (
                                      <div>
                                        <p className="text-sm font-medium mb-2">Recommendations:</p>
                                        <ul className="list-disc list-inside space-y-1">
                                          {insight.recommendations.map((rec: string, idx: number) => (
                                            <li key={idx} className="text-sm text-muted-foreground">{rec}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Other Insights */}
                      {insights.filter(i => !['equipment_failure', 'high_maintenance_unit', 'problematic_contractor'].includes(i.insightType)).length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Target className="h-5 w-5 text-purple-600" />
                            Other Insights
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {insights
                              .filter(i => !['equipment_failure', 'high_maintenance_unit', 'problematic_contractor'].includes(i.insightType))
                              .map((insight) => (
                                <Card key={insight.id} className="hover:shadow-md transition-shadow">
                                  <CardHeader>
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-start gap-3 flex-1">
                                        <Target className="h-5 w-5 text-purple-600 mt-1" />
                                        <div className="flex-1">
                                          <CardTitle className="text-base">{insight.prediction}</CardTitle>
                                          {insight.reasoning && (
                                            <p className="text-sm text-muted-foreground mt-1">{insight.reasoning}</p>
                                          )}
                                        </div>
                                      </div>
                                      <Badge variant="outline">
                                        {Math.round(parseFloat(insight.confidence ?? '0') * 100)}%
                                      </Badge>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-3">
                                    {insight.recommendations && insight.recommendations.length > 0 && (
                                      <div>
                                        <p className="text-sm font-medium mb-2">Recommendations:</p>
                                        <ul className="list-disc list-inside space-y-1">
                                          {insight.recommendations.map((rec: string, idx: number) => (
                                            <li key={idx} className="text-sm text-muted-foreground">{rec}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <Card className="border-2 border-dashed">
                      <CardContent className="p-12 text-center">
                        <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Get Started with Predictive Insights</h3>
                        <p className="text-muted-foreground mb-6">
                          Track equipment at your properties to receive intelligent replacement predictions based on industry data and climate.
                        </p>
                        {selectedProperty && (
                          <Button onClick={() => setShowEquipmentModal(true)} data-testid="button-setup-equipment">
                            <Wrench className="h-4 w-4 mr-2" />
                            Add Equipment to {selectedProperty.name}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2" data-testid="text-no-cases">No Maintenance Cases</h3>
                <p className="text-muted-foreground mb-4">Create your first maintenance case to start tracking issues and repairs.</p>
                <Button onClick={() => setShowCaseForm(true)} data-testid="button-add-first-case">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Case
                </Button>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
      
      {/* Case Detail Dialog */}
      <Dialog open={showCaseDialog} onOpenChange={setShowCaseDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Case Details</DialogTitle>
          </DialogHeader>
          {selectedCase && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details" data-testid="tab-case-details">
                  <Wrench className="h-4 w-4 mr-2" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="communications" data-testid="tab-case-communications">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Communications
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="mt-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold">{selectedCase.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{selectedCase.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium">Status:</span>
                  <Badge variant={getStatusVariant(selectedCase.status)} className="ml-2">
                    {selectedCase.status || "New"}
                  </Badge>
                </div>
                <div>
                  <span className="text-sm font-medium">Priority:</span>
                  <Badge variant={getPriorityVariant(selectedCase.priority)} className="ml-2">
                    {selectedCase.priority || "Medium"}
                  </Badge>
                </div>
                <div>
                  <span className="text-sm font-medium">Category:</span>
                  <span className="ml-2 text-sm">{selectedCase.category || "N/A"}</span>
                </div>
                <div>
                  <span className="text-sm font-medium">Estimated Duration:</span>
                  <span className="ml-2 text-sm">{selectedCase.estimatedDuration || "N/A"}</span>
                </div>
              </div>

              {selectedCase.aiTriageJson ? (
                <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950">
                  <h4 className="font-semibold mb-2 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    AI Triage Analysis
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Urgency:</span>
                      <span className="ml-2">{String((selectedCase.aiTriageJson as any)?.urgency || "N/A")}</span>
                    </div>
                    <div>
                      <span className="font-medium">Safety Risk:</span>
                      <span className="ml-2">{String((selectedCase.aiTriageJson as any)?.safetyRisk || "N/A")}</span>
                    </div>
                    {(selectedCase.aiTriageJson as any)?.reasoning && (
                      <div>
                        <span className="font-medium">Reasoning:</span>
                        <p className="ml-2 text-muted-foreground">{String((selectedCase.aiTriageJson as any).reasoning)}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {selectedCase.assignedContractorId && (
                <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950">
                  <h4 className="font-semibold mb-2 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Assigned Contractor
                  </h4>
                  <div className="text-sm">
                    {(() => {
                      const contractor = contractors.find(c => c.id === selectedCase.assignedContractorId);
                      return contractor ? (
                        <div className="space-y-1">
                          <div><span className="font-medium">Name:</span> {contractor.name}</div>
                          <div><span className="font-medium">Category:</span> {contractor.category || "N/A"}</div>
                          {contractor.rating && (
                            <div><span className="font-medium">Rating:</span> {contractor.rating}/5</div>
                          )}
                        </div>
                      ) : (
                        <span>Contractor information not available</span>
                      );
                    })()}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">AI Actions</h4>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => aiTriageMutation.mutate(selectedCase.id)}
                    disabled={aiTriageMutation.isPending}
                    data-testid="button-ai-triage"
                  >
                    {aiTriageMutation.isPending ? "Analyzing..." : "Run AI Triage"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => assignContractorMutation.mutate(selectedCase.id)}
                    disabled={assignContractorMutation.isPending}
                    data-testid="button-assign-contractor"
                  >
                    {assignContractorMutation.isPending ? "Assigning..." : "Assign Best Contractor"}
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Case Actions</h4>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => {
                      setShowCaseDialog(false);
                      setEditingCase(selectedCase);
                      setShowCaseForm(true);
                    }}
                    data-testid="button-edit-case"
                  >
                    Edit Case
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDeleteCase(selectedCase.id)}
                    disabled={deleteCaseMutation.isPending}
                    data-testid="button-delete-case"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
              </TabsContent>
              
              <TabsContent value="communications" className="mt-6">
                <CaseCommunications caseId={selectedCase.id} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Reminder Dialog */}
      <Dialog open={showReminderForm} onOpenChange={setShowReminderForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {reminderCaseContext ? `Create Reminder for: ${reminderCaseContext.caseTitle}` : 'Create New Reminder'}
            </DialogTitle>
          </DialogHeader>
          <ReminderForm 
            properties={properties || []}
            entities={entities || []}
            units={units || []}
            defaultType="maintenance"
            onSubmit={handleReminderSubmit}
            onCancel={() => {
              setShowReminderForm(false);
              setReminderCaseContext(null);
            }}
            isLoading={createReminderMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Proposals Dialog */}
      {viewingProposalsCase && (
        <ProposalsDialog
          isOpen={showProposalsDialog}
          onClose={() => {
            setShowProposalsDialog(false);
            setViewingProposalsCase(null);
          }}
          case_={viewingProposalsCase}
        />
      )}

      {/* Accept Case Dialog */}
      <AcceptCaseDialog
        isOpen={showAcceptDialog}
        onClose={() => {
          setShowAcceptDialog(false);
          setAcceptingCase(null);
        }}
        case_={acceptingCase}
        onAccept={(appointmentData) => {
          if (acceptingCase) {
            acceptCaseMutation.mutate({
              caseId: acceptingCase.id,
              appointmentData
            });
          }
        }}
        isPending={acceptCaseMutation.isPending}
      />

      {/* Contractor Availability Calendar Dialog */}
      {role === "contractor" && contractorProfile && (
        <Dialog open={showAvailabilityCalendar} onOpenChange={setShowAvailabilityCalendar}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-availability-calendar">
            <DialogHeader>
              <DialogTitle>Manage My Availability</DialogTitle>
            </DialogHeader>
            <AvailabilityCalendar contractorId={contractorProfile.id} />
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}

// Accept Case Dialog Component - Propose 3 Time Slots
function AcceptCaseDialog({
  isOpen,
  onClose,
  case_,
  onAccept,
  isPending
}: {
  isOpen: boolean;
  onClose: () => void;
  case_: SmartCase | null;
  onAccept: (data: any) => void;
  isPending: boolean;
}) {
  const [aiGuidance, setAiGuidance] = useState<any>(null);
  const [loadingGuidance, setLoadingGuidance] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState(120);

  const form = useForm<z.infer<typeof proposeThreeSlotsSchema>>({
    resolver: zodResolver(proposeThreeSlotsSchema),
    defaultValues: {
      slot1Date: undefined,
      slot1Time: "",
      slot2Date: undefined,
      slot2Time: "",
      slot3Date: undefined,
      slot3Time: "",
      notes: ""
    }
  });

  // Fetch AI guidance when dialog opens
  useEffect(() => {
    if (isOpen && case_) {
      setLoadingGuidance(true);
      fetch(`/api/cases/${case_.id}/ai-guidance`, {
        credentials: 'include'
      })
        .then(res => res.ok ? res.json() : null)
        .then(guidance => {
          if (guidance) {
            setAiGuidance(guidance);
            setEstimatedDuration(guidance.duration.estimatedMinutes);
            if (guidance.cost.estimatedCostAverage) {
              setEstimatedCost(guidance.cost.estimatedCostAverage.toString());
            }
          }
        })
        .catch(err => console.error("Failed to fetch AI guidance:", err))
        .finally(() => setLoadingGuidance(false));
    } else {
      setAiGuidance(null);
      setEstimatedCost("");
      setEstimatedDuration(120);
    }
  }, [isOpen, case_]);

  // Pre-fill form with Maya's AI-suggested time when dialog opens
  useEffect(() => {
    if (isOpen && case_) {
      // Start with AI suggested time or default to tomorrow 10am
      let baseDate: Date;
      let slot1Time: string;
      
      if (case_.aiSuggestedTime) {
        baseDate = new Date(case_.aiSuggestedTime);
        slot1Time = `${baseDate.getHours().toString().padStart(2, '0')}:${baseDate.getMinutes().toString().padStart(2, '0')}`;
      } else {
        baseDate = new Date();
        baseDate.setDate(baseDate.getDate() + 1);
        baseDate.setHours(10, 0, 0, 0);
        slot1Time = "10:00";
      }
      
      // Slot 2: Later same day if morning/early afternoon, otherwise next day
      const slot2Date = new Date(baseDate);
      let slot2Time = "14:00"; // Default 2pm
      
      if (baseDate.getHours() >= 14) {
        // If base time is afternoon/evening, move slot 2 to next day morning
        slot2Date.setDate(slot2Date.getDate() + 1);
        slot2Date.setHours(10, 0, 0, 0);
        slot2Time = "10:00";
      } else {
        // Same day, later time (afternoon)
        slot2Date.setHours(14, 0, 0, 0);
      }
      
      // Slot 3: Next day from slot 2
      const slot3Date = new Date(slot2Date);
      slot3Date.setDate(slot3Date.getDate() + 1);
      slot3Date.setHours(10, 0, 0, 0);
      const slot3Time = "10:00";

      form.reset({
        slot1Date: baseDate,
        slot1Time: slot1Time,
        slot2Date: slot2Date,
        slot2Time: slot2Time,
        slot3Date: slot3Date,
        slot3Time: slot3Time,
        notes: case_.aiReasoningNotes || ""
      });
    }
  }, [isOpen, case_, form]);

  const onSubmit = (data: z.infer<typeof proposeThreeSlotsSchema>) => {
    onAccept({
      ...data,
      estimatedCost,
      estimatedDuration
    });
  };

  if (!case_) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Accept Case & Propose 3 Time Options</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Propose 3 different time slots for the tenant to choose from. They'll select their preferred option.
          </p>
        </DialogHeader>
        
        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <h4 className="font-semibold text-sm mb-1">{case_.title}</h4>
          <p className="text-sm text-muted-foreground">{case_.description}</p>
        </div>

        {loadingGuidance ? (
          <div className="bg-muted/50 p-4 rounded-lg border mb-6">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span className="text-sm text-muted-foreground">Getting AI guidance...</span>
            </div>
          </div>
        ) : aiGuidance ? (
          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 mb-6">
            <div className="flex items-start gap-2 mb-3">
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-sm font-semibold">AI</span>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm mb-1">AI Recommendations</h4>
                <p className="text-xs text-muted-foreground mb-3">Based on job analysis and market data</p>
                
                <div className="space-y-2">
                  <div>
                    <div className="text-xs font-medium text-blue-700 dark:text-blue-300">Duration</div>
                    <div className="text-sm">{aiGuidance.duration.estimatedMinutes} minutes</div>
                    <div className="text-xs text-muted-foreground italic mt-0.5">{aiGuidance.duration.reasoning}</div>
                  </div>
                  
                  <div>
                    <div className="text-xs font-medium text-blue-700 dark:text-blue-300">Estimated Cost</div>
                    <div className="text-sm">
                      ${aiGuidance.cost.estimatedCostLow} - ${aiGuidance.cost.estimatedCostHigh} 
                      <span className="text-muted-foreground ml-2">(avg: ${aiGuidance.cost.estimatedCostAverage})</span>
                    </div>
                    <div className="text-xs text-muted-foreground italic mt-0.5">{aiGuidance.cost.reasoning}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="grid gap-2">
            <label htmlFor="estimated-cost" className="text-sm font-medium">Estimated Cost ($)</label>
            <input
              id="estimated-cost"
              type="number"
              placeholder="150.00"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="input-accept-cost"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="estimated-duration" className="text-sm font-medium">Duration (minutes)</label>
            <input
              id="estimated-duration"
              type="number"
              value={estimatedDuration}
              onChange={(e) => setEstimatedDuration(Number(e.target.value))}
              min={15}
              step={15}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="input-accept-duration"
            />
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Time Slot 1 */}
            <div className="space-y-3 p-4 border rounded-lg bg-primary/5">
              <h5 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">1</span>
                Option 1 {case_.aiSuggestedTime && <span className="text-xs text-muted-foreground">(AI Suggested)</span>}
              </h5>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="slot1Date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className="w-full pl-3 text-left font-normal" data-testid="button-slot1-date">
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slot1Time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <FormControl>
                        <TimePicker15Min value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Time Slot 2 */}
            <div className="space-y-3 p-4 border rounded-lg">
              <h5 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-secondary-foreground text-xs">2</span>
                Option 2
              </h5>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="slot2Date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className="w-full pl-3 text-left font-normal" data-testid="button-slot2-date">
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slot2Time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <FormControl>
                        <TimePicker15Min value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Time Slot 3 */}
            <div className="space-y-3 p-4 border rounded-lg">
              <h5 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-secondary-foreground text-xs">3</span>
                Option 3
              </h5>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="slot3Date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className="w-full pl-3 text-left font-normal" data-testid="button-slot3-date">
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slot3Time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <FormControl>
                        <TimePicker15Min value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any notes about the appointment or special instructions..."
                      className="resize-none"
                      {...field}
                      data-testid="input-appointment-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending} data-testid="button-cancel-accept">
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit-accept">
                {isPending ? "Proposing..." : "Accept & Propose Times"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Proposals Dialog Component
function ProposalsDialog({
  isOpen,
  onClose,
  case_
}: {
  isOpen: boolean;
  onClose: () => void;
  case_: SmartCase;
}) {
  const { toast } = useToast();
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);

  // Reset reschedule state when dialog opens/closes or case changes
  useEffect(() => {
    if (!isOpen) {
      setShowReschedule(false);
      setSelectedSlotId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setShowReschedule(false);
    setSelectedSlotId(null);
  }, [case_.id]);

  // Fetch proposals for this case
  const { data: proposals = [], isLoading: proposalsLoading } = useQuery<any[]>({
    queryKey: [`/api/cases/${case_.id}/proposals`],
    enabled: isOpen && !!case_.id,
  });

  // Fetch appointments for scheduled cases
  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery<any[]>({
    queryKey: [`/api/cases/${case_.id}/appointments`],
    enabled: isOpen && case_.status === 'Scheduled',
  });

  // Mutation to select a slot
  const selectSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      return await apiRequest("POST", `/api/proposals/slots/${slotId}/select`, {});
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment time selected successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${case_.id}/proposals`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${case_.id}/appointments`] });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to select appointment time",
        variant: "destructive",
      });
    },
  });

  const handleSelectSlot = () => {
    if (selectedSlotId) {
      selectSlotMutation.mutate(selectedSlotId);
    }
  };

  // Show appointment details if case is scheduled
  if (case_.status === 'Scheduled') {
    const appointment = appointments[0];
    
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl" data-testid="dialog-view-appointment">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          <div className="mb-4">
            <h4 className="font-semibold text-sm mb-1">{case_.title}</h4>
            <p className="text-sm text-muted-foreground">{case_.description}</p>
          </div>

          {appointmentsLoading ? (
            <div className="h-32 bg-muted animate-pulse rounded" />
          ) : appointment ? (
            <>
              {!showReschedule ? (
                <div className="space-y-4">
                  <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2">
                            <CalendarDays className="h-5 w-5 text-green-600 dark:text-green-400" />
                            <div>
                              <p className="font-semibold text-green-900 dark:text-green-100">
                                {new Date(appointment.scheduledStartAt).toLocaleDateString('en-US', { 
                                  weekday: 'long', 
                                  month: 'long', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </p>
                              <p className="text-sm text-green-700 dark:text-green-300">
                                {new Date(appointment.scheduledStartAt).toLocaleTimeString('en-US', { 
                                  hour: 'numeric', 
                                  minute: '2-digit' 
                                })} - {new Date(appointment.scheduledEndAt).toLocaleTimeString('en-US', { 
                                  hour: 'numeric', 
                                  minute: '2-digit' 
                                })}
                              </p>
                            </div>
                          </div>
                          <Badge className="bg-green-600 text-white">Confirmed</Badge>
                        </div>
                        
                        {appointment.contractor && (
                          <div className="pt-3 border-t border-green-200 dark:border-green-800">
                            <p className="text-sm font-medium text-green-900 dark:text-green-100">Contractor</p>
                            <p className="text-sm text-green-700 dark:text-green-300">{appointment.contractor.name}</p>
                            {appointment.contractor.phone && (
                              <p className="text-xs text-green-600 dark:text-green-400">{appointment.contractor.phone}</p>
                            )}
                          </div>
                        )}

                        {appointment.notes && (
                          <div className="pt-3 border-t border-green-200 dark:border-green-800">
                            <p className="text-sm font-medium text-green-900 dark:text-green-100">Notes</p>
                            <p className="text-sm text-green-700 dark:text-green-300">{appointment.notes}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setShowReschedule(true)}
                    data-testid="button-request-reschedule"
                  >
                    Request Change
                  </Button>
                </div>
              ) : (
                // Show reschedule options (proposals)
                <>
                  <div className="mb-4">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowReschedule(false)}
                      data-testid="button-back-to-appointment"
                    >
                      ← Back to Appointment
                    </Button>
                  </div>
                  {proposalsLoading ? (
                    <div className="space-y-4">
                      <div className="h-24 bg-muted animate-pulse rounded" />
                      <div className="h-24 bg-muted animate-pulse rounded" />
                    </div>
                  ) : proposals.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No alternative time slots available. Please contact your contractor directly.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {proposals.map((proposal, proposalIndex) => (
                        <ProposalCard
                          key={proposal.id}
                          proposal={proposal}
                          proposalIndex={proposalIndex}
                          selectedSlotId={selectedSlotId}
                          onSelectSlot={setSelectedSlotId}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No appointment details found.
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (showReschedule) {
                  setShowReschedule(false);
                  setSelectedSlotId(null);
                } else {
                  onClose();
                }
              }}
              data-testid={showReschedule ? "button-back-to-appointment-footer" : "button-close-appointment"}
            >
              {showReschedule ? "Back to Appointment" : "Close"}
            </Button>
            {showReschedule && (
              <Button
                onClick={handleSelectSlot}
                disabled={!selectedSlotId || selectSlotMutation.isPending}
                data-testid="button-confirm-reschedule"
              >
                {selectSlotMutation.isPending ? "Rescheduling..." : "Confirm New Time"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Show proposals dialog for non-scheduled cases
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-view-proposals">
        <DialogHeader>
          <DialogTitle>Contractor Proposals</DialogTitle>
        </DialogHeader>
        <div className="mb-4">
          <h4 className="font-semibold text-sm mb-1">{case_.title}</h4>
          <p className="text-sm text-muted-foreground">{case_.description}</p>
        </div>

        {proposalsLoading ? (
          <div className="space-y-4">
            <div className="h-24 bg-muted animate-pulse rounded" />
            <div className="h-24 bg-muted animate-pulse rounded" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No proposals yet. Your contractor will send appointment options soon.
          </div>
        ) : (
          <div className="space-y-6">
            {proposals.map((proposal, proposalIndex) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                proposalIndex={proposalIndex}
                selectedSlotId={selectedSlotId}
                onSelectSlot={setSelectedSlotId}
              />
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="button-cancel-proposals"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSelectSlot}
            disabled={!selectedSlotId || selectSlotMutation.isPending}
            data-testid="button-confirm-slot"
          >
            {selectSlotMutation.isPending ? "Confirming..." : "Confirm Selection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Proposal Card Component
function ProposalCard({
  proposal,
  proposalIndex,
  selectedSlotId,
  onSelectSlot
}: {
  proposal: any;
  proposalIndex: number;
  selectedSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
}) {
  const { data: slots = [], isLoading: slotsLoading } = useQuery<any[]>({
    queryKey: [`/api/proposals/${proposal.id}/slots`],
  });

  const durationMinutes = slots.length > 0 && slots[0].startTime && slots[0].endTime
    ? Math.round((new Date(slots[0].endTime).getTime() - new Date(slots[0].startTime).getTime()) / (1000 * 60))
    : (proposal.estimatedDurationMinutes || 0);

  return (
    <Card data-testid={`card-proposal-${proposalIndex}`}>
      <CardHeader>
        <CardTitle className="text-base">
          Proposal from Contractor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Estimated Cost:</span>
            <p className="font-semibold">${Number(proposal.estimatedCost || 0).toFixed(2)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Duration:</span>
            <p className="font-semibold">{durationMinutes} minutes</p>
          </div>
        </div>

        {proposal.notes && (
          <div className="text-sm">
            <span className="text-muted-foreground">Notes:</span>
            <p className="mt-1">{proposal.notes}</p>
          </div>
        )}

        <div className="border-t pt-4">
          <h4 className="font-semibold text-sm mb-3">Select a Time Slot:</h4>
          {slotsLoading ? (
            <div className="space-y-2">
              <div className="h-16 bg-muted animate-pulse rounded" />
              <div className="h-16 bg-muted animate-pulse rounded" />
              <div className="h-16 bg-muted animate-pulse rounded" />
            </div>
          ) : (
            <div className="space-y-2">
              {slots.map((slot, slotIndex) => (
                <button
                  key={slot.id}
                  onClick={() => onSelectSlot(slot.id)}
                  className={`w-full text-left p-3 border rounded-lg transition-all ${
                    selectedSlotId === slot.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  data-testid={`button-slot-${proposalIndex}-${slotIndex}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        Option {slot.slotNumber}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(slot.startTime).toLocaleDateString()} at{' '}
                        {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedSlotId === slot.id ? 'border-primary' : 'border-border'
                    }`}>
                      {selectedSlotId === slot.id && (
                        <div className="w-3 h-3 rounded-full bg-primary" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Appointment Info Component
function AppointmentInfo({ caseId }: { caseId: string }) {
  const { data: appointments = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/cases/${caseId}/appointments`],
  });

  if (isLoading) {
    return (
      <div className="mb-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
        <div className="h-12 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  const appointment = appointments[0];
  if (!appointment) return null;

  return (
    <div className="mb-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg" data-testid="appointment-info">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <CalendarDays className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-semibold text-green-800 dark:text-green-200">Scheduled Appointment</span>
          </div>
          <div className="text-sm text-green-700 dark:text-green-300">
            <p className="font-medium" data-testid="appointment-datetime">
              {new Date(appointment.scheduledStartAt).toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })} at {new Date(appointment.scheduledStartAt).toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit' 
              })}
            </p>
            {appointment.contractor && (
              <p className="text-xs mt-1" data-testid="appointment-contractor">
                with {appointment.contractor.name}
              </p>
            )}
          </div>
        </div>
        <Badge className="bg-green-600 text-white text-xs">Confirmed</Badge>
      </div>
    </div>
  );
}

// Case Communications Component - Shows omnichannel messages related to a case
function CaseCommunications({ caseId }: { caseId: string }) {
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['/api/inbox', { caseId }],
    enabled: !!caseId,
  });

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'voice': return <Phone className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
        <h3 className="font-medium text-muted-foreground">No Communications Yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Messages from tenants and contractors will appear here
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-4">
        {messages.map((message: any) => (
          <div key={message.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors" data-testid={`communication-${message.id}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {getChannelIcon(message.channelType)}
                <span className="font-medium text-sm">
                  {message.channelType.toUpperCase()} Message
                </span>
                <Badge variant="outline" className="text-xs">
                  {message.direction === 'inbound' ? 'Received' : 'Sent'}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {message.createdAt && format(new Date(message.createdAt), 'MMM d, h:mm a')}
              </span>
            </div>
            
            {message.subject && (
              <p className="font-medium text-sm mb-1">{message.subject}</p>
            )}
            
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {message.body}
            </p>
            
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {message.aiSentiment && (
                <Badge variant="secondary" className="text-xs">
                  {message.aiSentiment}
                </Badge>
              )}
              {message.aiUrgencyScore && (
                <Badge variant="outline" className="text-xs">
                  Urgency: {message.aiUrgencyScore}/10
                </Badge>
              )}
              {message.mayaResponseSent && (
                <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Maya Responded
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
