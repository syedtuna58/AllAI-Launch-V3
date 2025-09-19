import { useState, useEffect } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Wrench, AlertTriangle, Clock, CheckCircle, XCircle, Trash2, Bell, LayoutGrid, CalendarDays, Map, BarChart3, List } from "lucide-react";
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
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderCaseContext, setReminderCaseContext] = useState<{caseId: string; caseTitle: string} | null>(null);
  const [currentView, setCurrentView] = useState<"cards" | "heat-map" | "kanban" | "list">("cards");

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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Smart Cases</h1>
              <p className="text-muted-foreground">Track and manage maintenance requests</p>
            </div>
            
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
              )}

              {/* List View - Coming Soon */}
              {currentView === "list" && (
                <div className="bg-background border rounded-lg p-8 text-center">
                  <List className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">List View</h3>
                  <p className="text-muted-foreground">List view coming soon...</p>
                </div>
              )}

              {/* Heat Map View */}
              {currentView === "heat-map" && (
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
              )}

              {/* Kanban View */}
              {currentView === "kanban" && (
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
                                                await updateCaseMutation.mutateAsync({
                                                  id: smartCase.id,
                                                  status: "In Progress"
                                                });
                                              } catch (error) {
                                                console.error('Error updating case status:', error);
                                              }
                                            }}
                                            disabled={updateCaseMutation.isPending}
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
                                                await updateCaseMutation.mutateAsync({
                                                  id: smartCase.id,
                                                  status: "Resolved"
                                                });
                                              } catch (error) {
                                                console.error('Error updating case status:', error);
                                              }
                                            }}
                                            disabled={updateCaseMutation.isPending}
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
    </div>
  );
}
