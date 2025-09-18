import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Calendar } from "@/components/ui/calendar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { Plus, Wrench, AlertTriangle, Clock, CheckCircle, XCircle, Trash2, Bell, Archive, ArchiveRestore, CheckSquare, Square, Search, Grid, List, LayoutGrid, Map, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import ReminderForm from "@/components/forms/reminder-form";
import type { SmartCase, Property, OwnershipEntity, Unit } from "@shared/schema";
import PropertyAssistant from "@/components/ai/property-assistant";

// Predefined maintenance categories
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
  status: z.enum(["New", "In Review", "Scheduled", "In Progress", "On Hold", "Resolved", "Closed"]).default("New"),
  category: z.string().optional(),
  createReminder: z.boolean().default(false),
});

export default function Maintenance() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [editingCase, setEditingCase] = useState<SmartCase | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  
  // View and search state
  const [currentView, setCurrentView] = useState<'list' | 'grid' | 'kanban' | 'heatmap' | 'timeline'>('list');
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderCaseContext, setReminderCaseContext] = useState<{caseId: string; caseTitle: string} | null>(null);
  
  // Bulk operations state
  const [selectedCases, setSelectedCases] = useState<string[]>([]);
  const [showBulkArchiveDialog, setShowBulkArchiveDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  
  // Calendar view state
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

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

  // Mutation for unarchiving single cases
  const unarchiveMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const response = await apiRequest("PATCH", `/api/cases/${caseId}/unarchive`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "Success",
        description: "Case unarchived successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unarchive case",
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

  const deleteCaseMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/cases/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
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

  // Bulk operations mutations
  const bulkArchiveMutation = useMutation({
    mutationFn: async (caseIds: string[]) => {
      const promises = caseIds.map(id => apiRequest("PATCH", `/api/cases/${id}/archive`));
      return Promise.all(promises);
    },
    onSuccess: (_, caseIds) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      setSelectedCases([]);
      toast({
        title: "Success",
        description: `${caseIds.length} case${caseIds.length > 1 ? 's' : ''} archived successfully`,
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
        description: "Failed to archive selected cases",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (caseIds: string[]) => {
      const promises = caseIds.map(id => apiRequest("DELETE", `/api/cases/${id}`));
      return Promise.all(promises);
    },
    onSuccess: (_, caseIds) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      setSelectedCases([]);
      toast({
        title: "Success",
        description: `${caseIds.length} case${caseIds.length > 1 ? 's' : ''} deleted successfully`,
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
        description: "Failed to delete selected cases",
        variant: "destructive",
      });
    },
  });

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

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case "Urgent": return <Badge className="bg-red-100 text-red-800">Urgent</Badge>;
      case "High": return <Badge className="bg-orange-100 text-orange-800">High</Badge>;
      case "Medium": return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      case "Low": return <Badge className="bg-gray-100 text-gray-800">Low</Badge>;
      default: return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  const filteredProperties = properties || [];
  
  // Base filtered cases (without archive filter) for accurate tab counts
  const baseFilteredCases = smartCases?.filter(smartCase => {
    const statusMatch = statusFilter === "all" || smartCase.status === statusFilter;
    const propertyMatch = propertyFilter === "all" || smartCase.propertyId === propertyFilter;
    const categoryMatch = categoryFilter === "all" || smartCase.category === categoryFilter;
    const unitMatch = unitFilter.length === 0 || (smartCase.unitId && unitFilter.includes(smartCase.unitId)) || (unitFilter.includes("common") && !smartCase.unitId);
    
    // Search filter - check title, description, and category
    const searchMatch = searchQuery === "" || 
      smartCase.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      smartCase.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      smartCase.category?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return statusMatch && propertyMatch && categoryMatch && unitMatch && searchMatch;
  }) || [];

  // Final filtered cases including archive filter for display
  const filteredCases = baseFilteredCases?.filter(smartCase => {
    const archiveMatch = archiveFilter === 'all' || 
      (archiveFilter === 'active' && !(smartCase as any).isArchived) ||
      (archiveFilter === 'archived' && (smartCase as any).isArchived);
    return archiveMatch;
  }) || [];

  // Correct tab counts based on baseFilteredCases
  const activeCasesCount = baseFilteredCases.filter(c => !(c as any).isArchived).length;
  const archivedCasesCount = baseFilteredCases.filter(c => (c as any).isArchived).length;
  const allCasesCount = baseFilteredCases.length;

  // Grid Dashboard Data Processing (memoized for performance)
  const processGridData = () => {
    if (!properties || !units || !smartCases) return [];

    // Group units by property
    const propertiesWithUnits = properties.map(property => {
      const propertyUnits = units.filter(unit => unit.propertyId === property.id);
      
      // Calculate issues for property-level cases (not assigned to specific unit)
      const propertyCases = filteredCases.filter(c => 
        c.propertyId === property.id && !c.unitId
      );
      
      // Process each unit
      const unitsWithIssues = propertyUnits.map(unit => {
        const unitCases = filteredCases.filter(c => c.unitId === unit.id);
        
        // Calculate priority score: Urgent=4, High=3, Medium=2, Low=1
        const priorityScore = unitCases.reduce((sum, c) => {
          switch (c.priority) {
            case 'Urgent': return sum + 4;
            case 'High': return sum + 3;
            case 'Medium': return sum + 2;
            case 'Low': return sum + 1;
            default: return sum + 2;
          }
        }, 0);
        
        // Get highest priority for color coding
        const priorities = unitCases.map(c => c.priority || 'Medium');
        const highestPriority = priorities.includes('Urgent') ? 'Urgent' :
          priorities.includes('High') ? 'High' :
          priorities.includes('Medium') ? 'Medium' : 'Low';
        
        return {
          ...unit,
          caseCount: unitCases.length,
          priorityScore,
          highestPriority: unitCases.length > 0 ? highestPriority : null,
          cases: unitCases
        };
      });
      
      // Add property-level unit for property-wide cases if any exist
      const allUnits = [...unitsWithIssues];
      if (propertyCases.length > 0) {
        const propertyPriorityScore = propertyCases.reduce((sum, c) => {
          switch (c.priority) {
            case 'Urgent': return sum + 4;
            case 'High': return sum + 3;
            case 'Medium': return sum + 2;
            case 'Low': return sum + 1;
            default: return sum + 2;
          }
        }, 0);
        
        const propertyPriorities = propertyCases.map(c => c.priority || 'Medium');
        const propertyHighestPriority = propertyPriorities.includes('Urgent') ? 'Urgent' :
          propertyPriorities.includes('High') ? 'High' :
          propertyPriorities.includes('Medium') ? 'Medium' : 'Low';
          
        allUnits.push({
          id: `${property.id}-property`,
          propertyId: property.id,
          label: 'Property Common',
          bedrooms: null,
          bathrooms: null,
          sqft: null,
          floor: null,
          rentAmount: null,
          deposit: null,
          notes: null,
          hvacBrand: null,
          hvacModel: null,
          hvacYear: null,
          hvacLifetime: null,
          hvacReminder: false,
          waterHeaterBrand: null,
          waterHeaterModel: null,
          waterHeaterYear: null,
          waterHeaterLifetime: null,
          waterHeaterReminder: false,
          applianceNotes: null,
          createdAt: new Date().toISOString(),
          caseCount: propertyCases.length,
          priorityScore: propertyPriorityScore,
          highestPriority: propertyHighestPriority,
          cases: propertyCases
        });
      }
      
      return {
        ...property,
        units: allUnits,
        totalCases: propertyCases.length + unitsWithIssues.reduce((sum, u) => sum + u.caseCount, 0)
      };
    });
    
    return propertiesWithUnits.filter(p => p.units.length > 0);
  };

  const gridData = useMemo(() => processGridData(), [properties, units, filteredCases]);
  
  // Color coding helper for units with proper Tailwind classes
  const getUnitColor = (unit: any) => {
    if (unit.caseCount === 0) return 'bg-green-50 border-green-200 hover:bg-green-100';
    
    switch (unit.highestPriority) {
      case 'Urgent': return 'bg-red-100 border-red-300 hover:bg-red-200';
      case 'High': return 'bg-orange-100 border-orange-300 hover:bg-orange-200';
      case 'Medium': return 'bg-yellow-100 border-yellow-300 hover:bg-yellow-200';
      case 'Low': return 'bg-blue-100 border-blue-300 hover:bg-blue-200';
      default: return 'bg-gray-100 border-gray-300 hover:bg-gray-200';
    }
  };
  
  // Handle unit click to filter cases
  const handleUnitClick = (unit: any, property: any) => {
    if (unit.label === 'Property Common') {
      // Filter by property-level cases only (using 'common' special case)
      setPropertyFilter(property.id);
      setUnitFilter(['common']);
      setCurrentView('list');
      toast({
        title: "Filtered Cases",
        description: `Showing property-level maintenance cases for ${property.name}`,
      });
    } else {
      // Filter by specific unit
      setPropertyFilter(property.id);
      setUnitFilter([unit.id]);
      setCurrentView('list');
      toast({
        title: "Filtered Cases",
        description: `Showing maintenance cases for ${property.name} - ${unit.label}`,
      });
    }
  };

  // Bulk operations helper functions
  const handleSelectCase = (caseId: string) => {
    setSelectedCases(prev => 
      prev.includes(caseId) 
        ? prev.filter(id => id !== caseId)
        : [...prev, caseId]
    );
  };

  const handleSelectAll = () => {
    const allCaseIds = filteredCases.map(c => c.id);
    setSelectedCases(selectedCases.length === allCaseIds.length ? [] : allCaseIds);
  };

  const isAllSelected = filteredCases.length > 0 && selectedCases.length === filteredCases.length;
  const isIndeterminate = selectedCases.length > 0 && selectedCases.length < filteredCases.length;

  const selectedCaseTitles = filteredCases
    .filter(c => selectedCases.includes(c.id))
    .map(c => c.title)
    .slice(0, 3); // Show first 3 titles in confirmation

  const handleBulkArchive = () => {
    setShowBulkArchiveDialog(false);
    bulkArchiveMutation.mutate(selectedCases);
  };

  const handleBulkDelete = () => {
    setShowBulkDeleteDialog(false);
    bulkDeleteMutation.mutate(selectedCases);
  };


  const onSubmit = async (data: z.infer<typeof createCaseSchema>) => {
    const { createReminder, ...caseData } = data;
    
    if (editingCase) {
      updateCaseMutation.mutate({ id: editingCase.id, data: { ...caseData, createReminder: false } });
    } else {
      // Create the case first with status included
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Smart Cases</h1>
              <p className="text-muted-foreground">Track and manage maintenance requests</p>
            </div>
          </div>

          {/* Archive Status Tabs */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-1 bg-muted p-1 rounded-lg">
              <button
                onClick={() => setArchiveFilter('active')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  archiveFilter === 'active' 
                    ? 'bg-background text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid="tab-active-cases"
              >
                Active ({activeCasesCount})
              </button>
              <button
                onClick={() => setArchiveFilter('archived')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  archiveFilter === 'archived'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid="tab-archived-cases"
              >
                Archived ({archivedCasesCount})
              </button>
              <button
                onClick={() => setArchiveFilter('all')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  archiveFilter === 'all'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid="tab-all-cases"
              >
                All ({allCasesCount})
              </button>
            </div>

            <div className="flex items-center space-x-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search cases..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                  data-testid="input-search-cases"
                />
              </div>

              {/* View Toggle */}
              <div className="flex items-center space-x-1 bg-muted p-1 rounded-lg">
                <button
                  onClick={() => setCurrentView('list')}
                  className={`p-2 rounded-md transition-colors ${
                    currentView === 'list' 
                      ? 'bg-background text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="List View"
                  data-testid="button-view-list"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentView('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    currentView === 'grid'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Property Grid"
                  data-testid="button-view-grid"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentView('kanban')}
                  className={`p-2 rounded-md transition-colors ${
                    currentView === 'kanban'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Kanban Board"
                  data-testid="button-view-kanban"
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentView('heatmap')}
                  className={`p-2 rounded-md transition-colors ${
                    currentView === 'heatmap'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Priority Heat Map"
                  data-testid="button-view-heatmap"
                >
                  <Map className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
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

          {/* Bulk Operations Toolbar */}
          {filteredCases.length > 0 && (
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleSelectAll}
                        className="flex items-center space-x-2 text-sm font-medium hover:text-blue-600 transition-colors"
                        data-testid="button-select-all"
                      >
                        {isAllSelected ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : isIndeterminate ? (
                          <div className="h-4 w-4 bg-blue-600 rounded-sm flex items-center justify-center">
                            <div className="h-2 w-2 bg-white rounded-sm" />
                          </div>
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                        <span>
                          {isAllSelected ? `Deselect All (${filteredCases.length})` : 
                           isIndeterminate ? `Select All (${selectedCases.length}/${filteredCases.length} selected)` :
                           `Select All (${filteredCases.length})`}
                        </span>
                      </button>
                    </div>
                    {selectedCases.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {selectedCases.length} case{selectedCases.length > 1 ? 's' : ''} selected
                      </div>
                    )}
                  </div>

                  {selectedCases.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowBulkArchiveDialog(true)}
                        disabled={bulkArchiveMutation.isPending}
                        data-testid="button-bulk-archive"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Archive ({selectedCases.length})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowBulkDeleteDialog(true)}
                        disabled={bulkDeleteMutation.isPending}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid="button-bulk-delete"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete ({selectedCases.length})
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mailla AI Assistant */}
          <PropertyAssistant 
            context="maintenance"
            exampleQuestions={[
              "What maintenance is overdue or urgent?",
              "Which property needs the most attention?",
              "Any recurring maintenance patterns I should address?",
              "What repairs are costing me the most?"
            ]}
          />

          {/* Render based on current view */}
          {currentView === 'list' ? (
            casesLoading ? (
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
            <div className="grid grid-cols-1 gap-6">
              {filteredCases.map((smartCase, index) => (
                <Card key={smartCase.id} className={`hover:shadow-md transition-shadow ${selectedCases.includes(smartCase.id) ? 'ring-2 ring-blue-500 bg-blue-50/30' : ''}`} data-testid={`card-case-${index}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleSelectCase(smartCase.id)}
                          className="flex-shrink-0 hover:bg-gray-100 p-1 rounded"
                          data-testid={`checkbox-case-${index}`}
                        >
                          {selectedCases.includes(smartCase.id) ? (
                            <CheckSquare className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Square className="h-5 w-5 text-gray-400" />
                          )}
                        </button>
                        <div className={`w-12 h-12 ${getPriorityCircleColor(smartCase.priority)} rounded-lg flex items-center justify-center`}>
                          {getStatusIcon(smartCase.status)}
                        </div>
                        <div>
                          <CardTitle className="text-lg" data-testid={`text-case-title-${index}`}>{smartCase.title}</CardTitle>
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
                    
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                      <div>
                        <span data-testid={`text-case-created-${index}`}>
                          Created {smartCase.createdAt ? new Date(smartCase.createdAt).toLocaleDateString() : 'Unknown'}
                        </span>
                        {smartCase.propertyId && (
                          <div className="mt-1">
                            <span className="text-blue-600 font-medium">Property:</span>
                            <span className="ml-1" data-testid={`text-case-property-${index}`}>
                              {(() => {
                                const property = properties?.find(p => p.id === smartCase.propertyId);
                                return property ? (property.name || `${property.street}, ${property.city}`) : 'Property';
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                      {smartCase.estimatedCost && (
                        <span data-testid={`text-case-cost-${index}`}>
                          Est. Cost: ${Number(smartCase.estimatedCost).toLocaleString()}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      {/* Status Dropdown */}
                      <Select 
                        value={smartCase.status || "New"} 
                        onValueChange={(newStatus) => updateCaseStatusMutation.mutate({ id: smartCase.id, status: newStatus })}
                      >
                        <SelectTrigger className="w-32" data-testid={`select-case-status-${index}`}>
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
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleEditCase(smartCase)}
                        data-testid={`button-edit-case-${index}`}
                      >
                        Edit
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setReminderCaseContext({
                            caseId: smartCase.id,
                            caseTitle: smartCase.title
                          });
                          setShowReminderForm(true);
                        }}
                        data-testid={`button-remind-case-${index}`}
                      >
                        <Bell className="h-4 w-4" />
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this case? This action cannot be undone.")) {
                            deleteCaseMutation.mutate(smartCase.id);
                          }
                        }}
                        data-testid={`button-delete-case-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
            )
          ) : currentView === 'grid' ? (
            <div className="space-y-8">
              {/* Grid Legend */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Property-Unit Grid Dashboard</h3>
                    <div className="flex items-center space-x-6 text-sm">
                      <div className="flex items-center space-x-2" data-testid="legend-no-issues">
                        <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
                        <span>No Issues</span>
                      </div>
                      <div className="flex items-center space-x-2" data-testid="legend-low">
                        <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
                        <span>Low</span>
                      </div>
                      <div className="flex items-center space-x-2" data-testid="legend-medium">
                        <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
                        <span>Medium</span>
                      </div>
                      <div className="flex items-center space-x-2" data-testid="legend-high">
                        <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
                        <span>High</span>
                      </div>
                      <div className="flex items-center space-x-2" data-testid="legend-urgent">
                        <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
                        <span>Urgent</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Click any unit to filter maintenance cases by that location
                  </p>
                </CardContent>
              </Card>

              {/* Property Grids */}
              {gridData.length > 0 ? (
                gridData.map((property, propertyIndex) => (
                  <Card key={property.id} data-testid={`section-property-${property.id}`}>
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl">{property.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {property.street}, {property.city}, {property.state} {property.zipCode}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-foreground">{property.totalCases}</div>
                          <div className="text-sm text-muted-foreground">Total Issues</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {property.units.map((unit, unitIndex) => (
                          <div
                            key={unit.id}
                            onClick={() => handleUnitClick(unit, property)}
                            className={`
                              ${getUnitColor(unit)}
                              p-4 rounded-lg border-2 cursor-pointer transition-all duration-200
                              hover:shadow-md hover:scale-105
                            `}
                            data-testid={`card-unit-${unit.id}`}
                          >
                            {/* Unit Label */}
                            <div className="text-center mb-2">
                              <div className="font-semibold text-foreground text-lg">
                                {unit.label}
                              </div>
                              {unit.bedrooms && unit.bathrooms && (
                                <div className="text-xs text-muted-foreground">
                                  {unit.bedrooms}BR/{unit.bathrooms}BA
                                </div>
                              )}
                            </div>

                            {/* Issue Count Badge */}
                            <div className="text-center">
                              {unit.caseCount > 0 ? (
                                <div className={`
                                  inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
                                  ${unit.highestPriority === 'Urgent' ? 'bg-red-600 text-white' :
                                    unit.highestPriority === 'High' ? 'bg-orange-600 text-white' :
                                    unit.highestPriority === 'Medium' ? 'bg-yellow-600 text-white' :
                                    'bg-blue-600 text-white'
                                  }
                                `}>
                                  {unit.caseCount}
                                </div>
                              ) : (
                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-600 text-white text-sm font-bold">
                                  ✓
                                </div>
                              )}
                            </div>

                            {/* Priority Indicator */}
                            {unit.caseCount > 0 && (
                              <div className="text-center mt-2">
                                <div className="text-xs font-medium text-gray-700">
                                  {unit.highestPriority} Priority
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {/* Add Unit Button */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedPropertyId(property.id);
                            setShowCaseForm(true);
                          }}
                          className="w-full"
                          data-testid={`button-add-case-${property.id}`}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Maintenance Case for {property.name}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <LayoutGrid className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Properties with Units</h3>
                    <p className="text-muted-foreground mb-4">
                      Create properties and units to see the grid dashboard visualization
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : currentView === 'kanban' ? (
            <div className="space-y-6">
              {/* Kanban Board Header */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Kanban Status Board</h3>
                    <div className="text-sm text-muted-foreground">
                      Drag cases between columns to update status
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Kanban Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 xl:grid-cols-8 gap-4 min-h-[600px] overflow-x-auto">
                {[
                  { status: 'New', title: 'New', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', isArchive: false },
                  { status: 'In Review', title: 'In Review', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', isArchive: false },
                  { status: 'Scheduled', title: 'Scheduled', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200', isArchive: false },
                  { status: 'In Progress', title: 'In Progress', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200', isArchive: false },
                  { status: 'On Hold', title: 'On Hold', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', isArchive: false },
                  { status: 'Resolved', title: 'Resolved', bgColor: 'bg-green-50', borderColor: 'border-green-200', isArchive: false },
                  { status: 'Closed', title: 'Closed', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', isArchive: false },
                  { status: 'Archived', title: 'Archived', bgColor: 'bg-slate-50', borderColor: 'border-slate-300', isArchive: true }
                ].map(column => {
                  const columnCases = filteredCases.filter(c => {
                    if (column.isArchive) {
                      return (c as any).isArchived === true;
                    } else {
                      if (column.status === 'New') return (c.status === 'New' || !c.status) && !(c as any).isArchived;
                      return c.status === column.status && !(c as any).isArchived;
                    }
                  });

                  return (
                    <div
                      key={column.status}
                      className={`${column.bgColor} ${column.borderColor} border-2 rounded-lg p-4 space-y-4`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.add('ring-2', 'ring-blue-400', 'ring-opacity-50');
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove('ring-2', 'ring-blue-400', 'ring-opacity-50');
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('ring-2', 'ring-blue-400', 'ring-opacity-50');
                        
                        const caseId = e.dataTransfer.getData('text/plain');
                        
                        if (caseId) {
                          const draggedCase = filteredCases.find(c => c.id === caseId);
                          
                          if (column.isArchive) {
                            // Archive the case
                            bulkArchiveMutation.mutate([caseId]);
                          } else if (draggedCase && (draggedCase as any).isArchived) {
                            // Case is being moved from archived to active status
                            // First unarchive, then update status
                            unarchiveMutation.mutate(caseId);
                            setTimeout(() => {
                              const targetStatus = column.status === 'New' ? 'New' : column.status;
                              updateCaseStatusMutation.mutate({ id: caseId, status: targetStatus });
                            }, 100); // Small delay to ensure unarchive completes first
                          } else {
                            // Update status for regular columns
                            const targetStatus = column.status === 'New' ? 'New' : column.status;
                            updateCaseStatusMutation.mutate({ id: caseId, status: targetStatus });
                          }
                          // No immediate toast - wait for mutation success/error
                        }
                      }}
                      data-testid={`kanban-column-${column.status.toLowerCase().replace(' ', '-')}`}
                    >
                      {/* Column Header */}
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-foreground">{column.title}</h4>
                        <span className="bg-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">
                          {columnCases.length}
                        </span>
                      </div>

                      {/* Case Cards */}
                      <div className="space-y-3">
                        {columnCases.map((smartCase, index) => (
                          <div
                            key={smartCase.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', smartCase.id);
                              e.currentTarget.classList.add('opacity-50');
                            }}
                            onDragEnd={(e) => {
                              e.currentTarget.classList.remove('opacity-50');
                            }}
                            className="bg-white rounded-lg border border-gray-200 p-4 cursor-move hover:shadow-md transition-shadow"
                            data-testid={`kanban-card-${smartCase.id}`}
                          >
                            {/* Case Priority Badge */}
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h5 className="font-medium text-foreground text-sm line-clamp-2">
                                  {smartCase.title}
                                </h5>
                              </div>
                              {getPriorityBadge(smartCase.priority)}
                            </div>

                            {/* Case Details */}
                            {smartCase.description && (
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                {smartCase.description}
                              </p>
                            )}

                            {/* Property/Unit Info */}
                            <div className="text-xs text-muted-foreground mb-2">
                              {smartCase.propertyId && (
                                <div>
                                  {properties?.find(p => p.id === smartCase.propertyId)?.name}
                                  {smartCase.unitId && (
                                    <span> - {units.find(u => u.id === smartCase.unitId)?.label}</span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Cost and Category */}
                            <div className="flex items-center justify-between text-xs">
                              <div>
                                {smartCase.category && (
                                  <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                                    {smartCase.category.split(' ')[0]}
                                  </span>
                                )}
                              </div>
                              <div className="text-muted-foreground">
                                {smartCase.estimatedCost && (
                                  <span>${Number(smartCase.estimatedCost).toLocaleString()}</span>
                                )}
                              </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex items-center justify-end space-x-1 mt-3 pt-2 border-t border-gray-100">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditCase(smartCase)}
                                className="h-6 w-6 p-0"
                                data-testid={`button-edit-kanban-${smartCase.id}`}
                              >
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="m18.5 2.5 3 3L12 15l-4 1 1-4L18.5 2.5z" />
                                </svg>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setReminderCaseContext({
                                    caseId: smartCase.id,
                                    caseTitle: smartCase.title
                                  });
                                  setShowReminderForm(true);
                                }}
                                className="h-6 w-6 p-0"
                                data-testid={`button-remind-kanban-${smartCase.id}`}
                              >
                                <Bell className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}

                        {/* Add Case to Column */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!column.isArchive) {
                              setShowCaseForm(true);
                              // Pre-select the status for new cases in this column
                              form.setValue('status', column.status === 'New' ? 'New' : column.status as any);
                            }
                          }}
                          disabled={column.isArchive}
                          className="w-full border-dashed"
                          data-testid={`button-add-case-column-${column.status.toLowerCase().replace(' ', '-')}`}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add to {column.title}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Empty State */}
              {filteredCases.length === 0 && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Grid className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Maintenance Cases</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first maintenance case to see the Kanban board
                    </p>
                    <Button onClick={() => setShowCaseForm(true)} data-testid="button-add-first-case-kanban">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Case
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : currentView === 'heatmap' ? (
            <div className="space-y-6">
              {/* Heatmap Header */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center">
                        <Map className="h-5 w-5 mr-2" />
                        Priority Heat Map
                      </CardTitle>
                      <CardDescription>Visual intensity mapping showing maintenance workload across properties</CardDescription>
                    </div>
                    
                    {/* Heat Map Legend */}
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="text-muted-foreground">Workload Intensity:</span>
                        <div className="flex items-center space-x-1">
                          <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
                          <span className="text-xs text-muted-foreground">Low</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-4 h-4 bg-yellow-200 border border-yellow-300 rounded"></div>
                          <span className="text-xs text-muted-foreground">Medium</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-4 h-4 bg-orange-300 border border-orange-400 rounded"></div>
                          <span className="text-xs text-muted-foreground">High</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-4 h-4 bg-red-400 border border-red-500 rounded"></div>
                          <span className="text-xs text-muted-foreground">Critical</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Priority Distribution Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {['Urgent', 'High', 'Medium', 'Low'].map(priority => {
                  const priorityCases = filteredCases.filter(c => c.priority === priority && !(c as any).isArchived);
                  const priorityColor = priority === 'Urgent' ? 'text-red-600' : 
                                      priority === 'High' ? 'text-orange-600' : 
                                      priority === 'Medium' ? 'text-yellow-600' : 'text-green-600';
                  const priorityBg = priority === 'Urgent' ? 'bg-red-50' : 
                                    priority === 'High' ? 'bg-orange-50' : 
                                    priority === 'Medium' ? 'bg-yellow-50' : 'bg-green-50';
                  
                  return (
                    <Card key={priority} className={priorityBg} data-testid={`heatmap-priority-${priority.toLowerCase()}`}>
                      <CardContent className="p-4 text-center">
                        <div className={`text-2xl font-bold ${priorityColor}`}>
                          {priorityCases.length}
                        </div>
                        <div className="text-sm font-medium text-foreground">{priority} Priority</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {priorityCases.length === 0 ? 'No cases' : 
                           priorityCases.length === 1 ? '1 active case' : 
                           `${priorityCases.length} active cases`}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Property Heatmap Grid */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Property Workload Distribution</CardTitle>
                  <CardDescription>Click any property to filter maintenance cases</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {properties?.map(property => {
                      // Calculate workload intensity for this property
                      const propertyCases = filteredCases.filter(c => 
                        c.propertyId === property.id && !(c as any).isArchived
                      );
                      
                      // Calculate intensity score based on priority
                      const intensityScore = propertyCases.reduce((score, c) => {
                        return score + (c.priority === 'Urgent' ? 4 : 
                                      c.priority === 'High' ? 3 : 
                                      c.priority === 'Medium' ? 2 : 1);
                      }, 0);
                      
                      // Determine color intensity based on score - aligned with legend
                      const getIntensityClass = (score: number) => {
                        if (score === 0) return 'bg-gray-50 border-gray-200 hover:bg-gray-100'; // No cases
                        if (score <= 3) return 'bg-green-100 border-green-200 hover:bg-green-200'; // Low intensity - green
                        if (score <= 8) return 'bg-yellow-200 border-yellow-300 hover:bg-yellow-300'; // Medium intensity - yellow
                        if (score <= 15) return 'bg-orange-300 border-orange-400 hover:bg-orange-400'; // High intensity - orange  
                        return 'bg-red-400 border-red-500 hover:bg-red-500'; // Critical intensity - red
                      };

                      const propertyUnits = units.filter(u => u.propertyId === property.id);
                      
                      return (
                        <HoverCard key={property.id}>
                          <HoverCardTrigger asChild>
                            <div
                              className={`${getIntensityClass(intensityScore)} border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 transform hover:scale-105 hover:shadow-lg`}
                              onClick={() => {
                                setPropertyFilter(property.id);
                                setCurrentView('list');
                              }}
                              data-testid={`heatmap-property-${property.id}`}
                            >
                          {/* Property Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-foreground text-sm truncate">
                                {property.name}
                              </h4>
                              <p className="text-xs text-muted-foreground truncate">
                                {property.street}, {property.city}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-foreground">
                                {propertyCases.length}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {propertyCases.length === 1 ? 'case' : 'cases'}
                              </div>
                            </div>
                          </div>

                          {/* Priority Breakdown */}
                          <div className="space-y-2">
                            {['Urgent', 'High', 'Medium', 'Low'].map(priority => {
                              const count = propertyCases.filter(c => c.priority === priority).length;
                              if (count === 0) return null;
                              
                              const priorityDot = priority === 'Urgent' ? 'bg-red-500' : 
                                                priority === 'High' ? 'bg-orange-500' : 
                                                priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500';
                              
                              return (
                                <div key={priority} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center space-x-2">
                                    <div className={`w-2 h-2 rounded-full ${priorityDot}`}></div>
                                    <span className="text-muted-foreground">{priority}</span>
                                  </div>
                                  <span className="font-medium text-foreground">{count}</span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Unit Summary */}
                          {propertyUnits.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200/50">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Units:</span>
                                <span className="text-foreground font-medium">
                                  {propertyUnits.length} total
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {propertyUnits.slice(0, 3).map(unit => {
                                  const unitCases = propertyCases.filter(c => c.unitId === unit.id);
                                  const unitIntensity = unitCases.reduce((score, c) => {
                                    return score + (c.priority === 'Urgent' ? 4 : 
                                                  c.priority === 'High' ? 3 : 
                                                  c.priority === 'Medium' ? 2 : 1);
                                  }, 0);
                                  
                                  // Use consistent color scale aligned with legend
                                  const unitColor = unitIntensity === 0 ? 'bg-gray-300 text-gray-700' :
                                                  unitIntensity <= 2 ? 'bg-green-200 text-green-800' :
                                                  unitIntensity <= 5 ? 'bg-yellow-300 text-yellow-800' :
                                                  unitIntensity <= 8 ? 'bg-orange-400 text-orange-900' : 'bg-red-500 text-red-100';
                                  
                                  return (
                                    <div
                                      key={unit.id}
                                      className={`${unitColor} text-xs px-2 py-1 rounded`}
                                      title={`${unit.label}: ${unitCases.length} cases`}
                                    >
                                      {unit.label}
                                    </div>
                                  );
                                })}
                                {propertyUnits.length > 3 && (
                                  <div className="bg-gray-300 text-gray-700 text-xs px-2 py-1 rounded">
                                    +{propertyUnits.length - 3}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                            </div>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80" data-testid={`heatmap-tooltip-${property.id}`}>
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-semibold text-sm">{property.name}</h4>
                                <p className="text-xs text-muted-foreground">{property.street}, {property.city}, {property.state}</p>
                              </div>
                              
                              <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-sm font-medium">Total Active Cases:</span>
                                <span className="text-lg font-bold">{propertyCases.length}</span>
                              </div>
                              
                              <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-sm font-medium">Intensity Score:</span>
                                <span className="text-lg font-bold text-orange-600">{intensityScore}</span>
                              </div>

                              <div className="space-y-2">
                                <h5 className="text-sm font-medium">Priority Breakdown:</h5>
                                {['Urgent', 'High', 'Medium', 'Low'].map(priority => {
                                  const count = propertyCases.filter(c => c.priority === priority).length;
                                  if (count === 0) return null;
                                  
                                  const priorityColor = priority === 'Urgent' ? 'text-red-600' : 
                                                       priority === 'High' ? 'text-orange-600' : 
                                                       priority === 'Medium' ? 'text-yellow-600' : 'text-green-600';
                                  
                                  return (
                                    <div key={priority} className="flex items-center justify-between text-sm">
                                      <span className={priorityColor}>{priority} Priority</span>
                                      <span className="font-medium">{count}</span>
                                    </div>
                                  );
                                })}
                              </div>

                              {propertyUnits.length > 0 && (
                                <div className="space-y-2">
                                  <h5 className="text-sm font-medium">Units ({propertyUnits.length} total):</h5>
                                  <div className="grid grid-cols-4 gap-2">
                                    {propertyUnits.slice(0, 8).map(unit => {
                                      const unitCases = propertyCases.filter(c => c.unitId === unit.id);
                                      const unitIntensity = unitCases.reduce((score, c) => {
                                        return score + (c.priority === 'Urgent' ? 4 : 
                                                        c.priority === 'High' ? 3 : 
                                                        c.priority === 'Medium' ? 2 : 1);
                                      }, 0);
                                      
                                      const unitTooltipColor = unitIntensity === 0 ? 'bg-gray-100 text-gray-600' :
                                                               unitIntensity <= 2 ? 'bg-green-100 text-green-800' :
                                                               unitIntensity <= 5 ? 'bg-yellow-100 text-yellow-800' :
                                                               unitIntensity <= 8 ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800';
                                      
                                      return (
                                        <div
                                          key={unit.id}
                                          className={`${unitTooltipColor} text-xs px-2 py-1 rounded text-center`}
                                          title={`${unit.label}: ${unitCases.length} cases, intensity ${unitIntensity}`}
                                        >
                                          {unit.label}
                                        </div>
                                      );
                                    })}
                                    {propertyUnits.length > 8 && (
                                      <div className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded text-center">
                                        +{propertyUnits.length - 8}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              <div className="text-xs text-muted-foreground pt-2 border-t">
                                Click to view all cases for this property
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      );
                    })}
                  </div>

                  {/* Empty State */}
                  {(!properties || properties.length === 0) && (
                    <div className="text-center py-12">
                      <Map className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">No Properties Found</h3>
                      <p className="text-muted-foreground">
                        Add properties to see the maintenance workload heat map
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : currentView === 'timeline' ? (
            <div className="space-y-6">
              {/* Timeline Calendar Header */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center">
                        <CalendarIcon className="h-5 w-5 mr-2" />
                        Timeline Calendar
                      </CardTitle>
                      <CardDescription>Schedule view of maintenance cases organized by dates and properties</CardDescription>
                    </div>
                    
                    {/* Calendar View Toggle */}
                    <div className="flex items-center space-x-2">
                      <div className="bg-muted rounded-lg p-1">
                        {['month', 'week', 'day'].map(view => (
                          <Button
                            key={view}
                            variant={calendarView === view ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setCalendarView(view)}
                            className="capitalize"
                            data-testid={`button-calendar-view-${view}`}
                          >
                            {view}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Calendar Navigation */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newDate = new Date(currentDate);
                          if (calendarView === 'month') {
                            newDate.setMonth(newDate.getMonth() - 1);
                          } else if (calendarView === 'week') {
                            newDate.setDate(newDate.getDate() - 7);
                          } else {
                            newDate.setDate(newDate.getDate() - 1);
                          }
                          setCurrentDate(newDate);
                        }}
                        data-testid="button-calendar-previous"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      
                      <h3 className="text-xl font-semibold">
                        {calendarView === 'month' && format(currentDate, 'MMMM yyyy')}
                        {calendarView === 'week' && `Week of ${format(startOfWeek(currentDate), 'MMM d, yyyy')}`}
                        {calendarView === 'day' && format(currentDate, 'EEEE, MMMM d, yyyy')}
                      </h3>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newDate = new Date(currentDate);
                          if (calendarView === 'month') {
                            newDate.setMonth(newDate.getMonth() + 1);
                          } else if (calendarView === 'week') {
                            newDate.setDate(newDate.getDate() + 7);
                          } else {
                            newDate.setDate(newDate.getDate() + 1);
                          }
                          setCurrentDate(newDate);
                        }}
                        data-testid="button-calendar-next"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <Button
                      variant="outline"
                      onClick={() => setCurrentDate(new Date())}
                      data-testid="button-calendar-today"
                    >
                      Today
                    </Button>
                  </div>

                  {/* Calendar Grid */}
                  {calendarView === 'month' && (
                    <div className="space-y-4">
                      {/* Month View - Calendar Grid */}
                      <div className="grid grid-cols-7 gap-2">
                        {/* Day Headers */}
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <div key={day} className="p-3 text-center font-medium text-muted-foreground">
                            {day}
                          </div>
                        ))}
                        
                        {/* Calendar Days */}
                        {(() => {
                          const monthStart = startOfMonth(currentDate);
                          const monthEnd = endOfMonth(currentDate);
                          const startDate = startOfWeek(monthStart);
                          const endDate = endOfWeek(monthEnd);
                          const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
                          
                          return dateRange.map(date => {
                            const dayCases = filteredCases.filter(c => {
                              const caseDate = c.createdAt ? new Date(c.createdAt) : null;
                              return caseDate && isSameDay(caseDate, date) && !(c as any).isArchived;
                            });
                            
                            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                            const isToday = isSameDay(date, new Date());
                            
                            return (
                              <div
                                key={date.toISOString()}
                                className={`min-h-[120px] border rounded-lg p-2 ${
                                  isCurrentMonth ? 'bg-background' : 'bg-muted/30'
                                } ${isToday ? 'ring-2 ring-primary' : ''}`}
                                data-testid={`calendar-day-${format(date, 'yyyy-MM-dd')}`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className={`text-sm font-medium ${
                                    isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                                  }`}>
                                    {date.getDate()}
                                  </span>
                                  {dayCases.length > 0 && (
                                    <span className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                      {dayCases.length}
                                    </span>
                                  )}
                                </div>
                                
                                {/* Cases for this day */}
                                <div className="space-y-1">
                                  {dayCases.slice(0, 3).map(smartCase => (
                                    <HoverCard key={smartCase.id}>
                                      <HoverCardTrigger asChild>
                                        <div
                                          className={`text-xs p-1 rounded cursor-pointer truncate ${
                                            smartCase.priority === 'Urgent' ? 'bg-red-100 text-red-800 border border-red-200' :
                                            smartCase.priority === 'High' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                                            smartCase.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                            'bg-green-100 text-green-800 border border-green-200'
                                          }`}
                                          onClick={() => handleEditCase(smartCase)}
                                          data-testid={`timeline-case-${smartCase.id}`}
                                        >
                                          {smartCase.title}
                                        </div>
                                      </HoverCardTrigger>
                                      <HoverCardContent className="w-80">
                                        <div className="space-y-2">
                                          <div className="flex items-start justify-between">
                                            <h4 className="font-semibold text-sm">{smartCase.title}</h4>
                                            {getPriorityBadge(smartCase.priority)}
                                          </div>
                                          {smartCase.description && (
                                            <p className="text-sm text-muted-foreground">{smartCase.description}</p>
                                          )}
                                          <div className="flex items-center justify-between text-xs">
                                            <span>Status: {smartCase.status || 'New'}</span>
                                            {smartCase.estimatedCost && (
                                              <span>${Number(smartCase.estimatedCost).toLocaleString()}</span>
                                            )}
                                          </div>
                                          {smartCase.propertyId && (
                                            <div className="text-xs text-muted-foreground">
                                              Property: {properties?.find(p => p.id === smartCase.propertyId)?.name}
                                              {smartCase.unitId && (
                                                <span> - Unit: {units.find(u => u.id === smartCase.unitId)?.label}</span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </HoverCardContent>
                                    </HoverCard>
                                  ))}
                                  {dayCases.length > 3 && (
                                    <div className="text-xs text-muted-foreground p-1">
                                      +{dayCases.length - 3} more
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Week View */}
                  {calendarView === 'week' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-8 gap-2">
                        {/* Time column header */}
                        <div className="p-3"></div>
                        {/* Day headers */}
                        {(() => {
                          const weekStart = startOfWeek(currentDate);
                          const weekDays = eachDayOfInterval({ 
                            start: weekStart, 
                            end: endOfWeek(currentDate) 
                          });
                          
                          return weekDays.map(date => (
                            <div key={date.toISOString()} className="p-3 text-center">
                              <div className="font-medium">{format(date, 'EEE')}</div>
                              <div className={`text-2xl ${
                                isSameDay(date, new Date()) ? 'text-primary font-bold' : 'text-muted-foreground'
                              }`}>
                                {date.getDate()}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                      
                      {/* Week grid with cases */}
                      <div className="grid grid-cols-8 gap-2" style={{ minHeight: '400px' }}>
                        {/* Time labels */}
                        <div className="space-y-4">
                          {Array.from({ length: 12 }, (_, i) => i + 6).map(hour => (
                            <div key={hour} className="h-16 flex items-center text-sm text-muted-foreground">
                              {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                            </div>
                          ))}
                        </div>
                        
                        {/* Week days with cases */}
                        {(() => {
                          const weekStart = startOfWeek(currentDate);
                          const weekDays = eachDayOfInterval({ 
                            start: weekStart, 
                            end: endOfWeek(currentDate) 
                          });
                          
                          return weekDays.map(date => {
                            const dayCases = filteredCases.filter(c => {
                              const caseDate = c.createdAt ? new Date(c.createdAt) : null;
                              return caseDate && isSameDay(caseDate, date) && !(c as any).isArchived;
                            });
                            
                            return (
                              <div key={date.toISOString()} className="space-y-1">
                                {Array.from({ length: 12 }, (_, i) => (
                                  <div key={i} className="h-16 border-t border-muted/30 p-1">
                                    {i === 0 && dayCases.slice(0, 4).map((smartCase, index) => (
                                      <div
                                        key={smartCase.id}
                                        className={`text-xs p-1 mb-1 rounded cursor-pointer truncate ${
                                          smartCase.priority === 'Urgent' ? 'bg-red-100 text-red-800' :
                                          smartCase.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                                          smartCase.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-green-100 text-green-800'
                                        }`}
                                        onClick={() => handleEditCase(smartCase)}
                                        data-testid={`week-case-${smartCase.id}`}
                                        style={{ zIndex: 10 + index }}
                                      >
                                        {smartCase.title}
                                      </div>
                                    ))}
                                    {i === 0 && dayCases.length > 4 && (
                                      <div className="text-xs text-muted-foreground">
                                        +{dayCases.length - 4} more
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Day View */}
                  {calendarView === 'day' && (
                    <div className="space-y-4">
                      {(() => {
                        const dayCases = filteredCases.filter(c => {
                          const caseDate = c.createdAt ? new Date(c.createdAt) : null;
                          return caseDate && isSameDay(caseDate, currentDate) && !(c as any).isArchived;
                        });
                        
                        return (
                          <div className="grid grid-cols-2 gap-6">
                            {/* Time slots */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-lg mb-4">
                                Schedule for {format(currentDate, 'EEEE, MMMM d')}
                              </h4>
                              
                              {Array.from({ length: 12 }, (_, i) => i + 6).map(hour => (
                                <div key={hour} className="flex items-start space-x-4 py-4 border-b border-muted/30">
                                  <div className="w-20 text-sm text-muted-foreground flex-shrink-0">
                                    {hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
                                  </div>
                                  <div className="flex-1 min-h-[60px]">
                                    {/* Cases would be positioned here based on scheduled times */}
                                    {hour === 9 && dayCases.slice(0, 2).map(smartCase => (
                                      <div
                                        key={smartCase.id}
                                        className={`p-3 mb-2 rounded-lg cursor-pointer border-l-4 ${
                                          smartCase.priority === 'Urgent' ? 'bg-red-50 border-l-red-500' :
                                          smartCase.priority === 'High' ? 'bg-orange-50 border-l-orange-500' :
                                          smartCase.priority === 'Medium' ? 'bg-yellow-50 border-l-yellow-500' :
                                          'bg-green-50 border-l-green-500'
                                        }`}
                                        onClick={() => handleEditCase(smartCase)}
                                        data-testid={`day-case-${smartCase.id}`}
                                      >
                                        <div className="font-medium text-sm">{smartCase.title}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                          {smartCase.status} • {smartCase.priority} Priority
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* Day Summary */}
                            <div className="space-y-4">
                              <h4 className="font-semibold text-lg">Day Summary</h4>
                              
                              <Card>
                                <CardContent className="p-4">
                                  <div className="text-center">
                                    <div className="text-3xl font-bold text-primary">{dayCases.length}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {dayCases.length === 1 ? 'Case' : 'Cases'} Today
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                              
                              {/* Priority Breakdown */}
                              <Card>
                                <CardContent className="p-4 space-y-3">
                                  <h5 className="font-medium">Priority Distribution</h5>
                                  {['Urgent', 'High', 'Medium', 'Low'].map(priority => {
                                    const count = dayCases.filter(c => c.priority === priority).length;
                                    if (count === 0) return null;
                                    
                                    return (
                                      <div key={priority} className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                          <div className={`w-3 h-3 rounded-full ${
                                            priority === 'Urgent' ? 'bg-red-500' :
                                            priority === 'High' ? 'bg-orange-500' :
                                            priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                                          }`}></div>
                                          <span className="text-sm">{priority}</span>
                                        </div>
                                        <span className="font-medium">{count}</span>
                                      </div>
                                    );
                                  })}
                                </CardContent>
                              </Card>
                              
                              {/* Cases List */}
                              {dayCases.length > 0 && (
                                <Card>
                                  <CardContent className="p-4 space-y-3">
                                    <h5 className="font-medium">All Cases Today</h5>
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                      {dayCases.map(smartCase => (
                                        <div
                                          key={smartCase.id}
                                          className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer"
                                          onClick={() => handleEditCase(smartCase)}
                                        >
                                          <div className="flex-1">
                                            <div className="font-medium text-sm">{smartCase.title}</div>
                                            <div className="text-xs text-muted-foreground">
                                              {smartCase.status} • {properties?.find(p => p.id === smartCase.propertyId)?.name}
                                            </div>
                                          </div>
                                          {getPriorityBadge(smartCase.priority)}
                                        </div>
                                      ))}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Timeline Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {filteredCases.filter(c => !(c as any).isArchived && c.status === 'Scheduled').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Scheduled Cases</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {filteredCases.filter(c => !(c as any).isArchived && ['Urgent', 'High'].includes(c.priority)).length}
                    </div>
                    <div className="text-sm text-muted-foreground">High Priority Cases</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {filteredCases.filter(c => !(c as any).isArchived && c.status === 'Resolved').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Resolved This Period</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
        </main>
      </div>
      
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
      
      {/* Bulk Archive Confirmation Dialog */}
      <Dialog open={showBulkArchiveDialog} onOpenChange={setShowBulkArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Cases</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to archive {selectedCases.length} case{selectedCases.length > 1 ? 's' : ''}?
            </p>
            {selectedCaseTitles.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Cases to archive:</p>
                <ul className="text-sm text-muted-foreground ml-4 list-disc">
                  {selectedCaseTitles.map((title, index) => (
                    <li key={index}>{title}</li>
                  ))}
                  {selectedCases.length > 3 && (
                    <li>...and {selectedCases.length - 3} more</li>
                  )}
                </ul>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Archived cases can be restored later if needed.
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowBulkArchiveDialog(false)}
              disabled={bulkArchiveMutation.isPending}
              data-testid="button-cancel-bulk-archive"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkArchive}
              disabled={bulkArchiveMutation.isPending}
              data-testid="button-confirm-bulk-archive"
            >
              {bulkArchiveMutation.isPending ? "Archiving..." : `Archive ${selectedCases.length} Case${selectedCases.length > 1 ? 's' : ''}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Cases</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to permanently delete {selectedCases.length} case{selectedCases.length > 1 ? 's' : ''}?
            </p>
            {selectedCaseTitles.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Cases to delete:</p>
                <ul className="text-sm text-muted-foreground ml-4 list-disc">
                  {selectedCaseTitles.map((title, index) => (
                    <li key={index}>{title}</li>
                  ))}
                  {selectedCases.length > 3 && (
                    <li>...and {selectedCases.length - 3} more</li>
                  )}
                </ul>
              </div>
            )}
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-sm text-red-800 font-medium">
                ⚠️ This action cannot be undone
              </p>
              <p className="text-sm text-red-700">
                All case data, including descriptions, costs, and related information will be permanently removed.
              </p>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowBulkDeleteDialog(false)}
              disabled={bulkDeleteMutation.isPending}
              data-testid="button-cancel-bulk-delete"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              variant="destructive"
              data-testid="button-confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedCases.length} Case${selectedCases.length > 1 ? 's' : ''}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
