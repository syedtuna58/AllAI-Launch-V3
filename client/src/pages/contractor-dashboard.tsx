import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Clock, AlertTriangle, CheckCircle2, MapPin, Wrench, DollarSign, Info } from "lucide-react";
import { format } from "date-fns";
import type { SmartCase } from "@shared/schema";

interface Appointment {
  id: string;
  caseId: string;
  contractorId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  status: string;
  smartCase?: SmartCase;
}

export default function ContractorDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCase, setSelectedCase] = useState<SmartCase | null>(null);
  const [showCaseDetail, setShowCaseDetail] = useState(false);

  const { data: contractor, isLoading: loadingContractor, isError: contractorError } = useQuery<any>({
    queryKey: ['/api/contractors/me'],
  });

  const contractorId = contractor?.id;

  const { data: appointments = [], isLoading: loadingAppointments } = useQuery<Appointment[]>({
    queryKey: ['/api/contractors', contractorId, 'appointments'],
    enabled: !!contractorId,
  });

  const { data: allCases = [] } = useQuery<SmartCase[]>({
    queryKey: ['/api/cases'],
  });

  const assignedCases = allCases.filter(c => 
    c.assignedContractorId === contractorId || appointments.some(a => a.caseId === c.id)
  );

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PATCH', `/api/appointments/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractors', contractorId, 'appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      toast({
        title: "Appointment updated",
        description: "The appointment has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    },
  });

  const updateCaseStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest('PATCH', `/api/cases/${id}`, { status });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      toast({
        title: "Status updated",
        description: "Case status has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    },
  });

  const handleAcceptAppointment = async (appointment: Appointment) => {
    await updateAppointmentMutation.mutateAsync({
      id: appointment.id,
      data: { status: "confirmed" },
    });
  };

  const handleDeclineAppointment = async (appointment: Appointment) => {
    await updateAppointmentMutation.mutateAsync({
      id: appointment.id,
      data: { status: "declined" },
    });
  };

  const handleUpdateCaseStatus = async (caseId: string, status: string) => {
    await updateCaseStatusMutation.mutateAsync({ id: caseId, status });
  };

  const viewCaseDetail = (caseItem: SmartCase) => {
    setSelectedCase(caseItem);
    setShowCaseDetail(true);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "urgent": return "destructive";
      case "high": return "default";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed": return "default";
      case "in_progress": return "secondary";
      case "pending": return "outline";
      case "confirmed": return "default";
      case "declined": return "destructive";
      default: return "outline";
    }
  };

  const upcomingAppointments = appointments.filter(a => 
    new Date(a.scheduledStart) > new Date() && a.status !== "declined"
  );

  const pendingAppointments = appointments.filter(a => 
    a.status === "pending"
  );

  return (
    <div data-testid="page-contractor-dashboard" className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="Contractor Dashboard" />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {loadingContractor && (
              <Card data-testid="card-loading">
                <CardContent className="p-6 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-muted-foreground">Loading contractor profile...</p>
                </CardContent>
              </Card>
            )}

            {contractorError && (
              <Card data-testid="card-not-contractor">
                <CardContent className="p-6 text-center text-muted-foreground">
                  <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>You don't have a contractor profile linked to your account.</p>
                  <p className="text-sm mt-2">Please contact your administrator to set up contractor access.</p>
                </CardContent>
              </Card>
            )}

            {contractor && (
              <>
            <Card data-testid="card-contractor-info">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  <span className="font-medium">Viewing as: {contractor.name}</span>
                  {contractor.category && (
                    <Badge variant="outline">{contractor.category}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card data-testid="card-stat-pending">
                <CardHeader className="pb-2">
                  <CardDescription>Pending Appointments</CardDescription>
                  <CardTitle className="text-3xl">{pendingAppointments.length}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Require your response</p>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-upcoming">
                <CardHeader className="pb-2">
                  <CardDescription>Upcoming Appointments</CardDescription>
                  <CardTitle className="text-3xl">{upcomingAppointments.length}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Next 30 days</p>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-assigned">
                <CardHeader className="pb-2">
                  <CardDescription>Assigned Cases</CardDescription>
                  <CardTitle className="text-3xl">{assignedCases.length}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Active work orders</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="pending" data-testid="tabs-main">
              <TabsList>
                <TabsTrigger value="pending" data-testid="tab-pending">
                  Pending ({pendingAppointments.length})
                </TabsTrigger>
                <TabsTrigger value="upcoming" data-testid="tab-upcoming">
                  Upcoming ({upcomingAppointments.length})
                </TabsTrigger>
                <TabsTrigger value="cases" data-testid="tab-cases">
                  My Cases ({assignedCases.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-4">
                {pendingAppointments.length === 0 ? (
                  <Card data-testid="card-no-pending">
                    <CardContent className="p-6 text-center text-muted-foreground">
                      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No pending appointments</p>
                    </CardContent>
                  </Card>
                ) : (
                  pendingAppointments.map((appointment) => (
                    <Card key={appointment.id} data-testid={`card-appointment-${appointment.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">
                              {appointment.smartCase?.title || "Maintenance Request"}
                            </CardTitle>
                            <CardDescription className="mt-2">
                              {appointment.smartCase?.description?.substring(0, 150) || ""}
                              {(appointment.smartCase?.description?.length || 0) > 150 && "..."}
                            </CardDescription>
                          </div>
                          <Badge variant={getPriorityColor(appointment.smartCase?.priority || "")}>
                            {appointment.smartCase?.priority || "Medium"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span data-testid={`text-date-${appointment.id}`}>
                              {format(new Date(appointment.scheduledStart), "MMM d, yyyy")}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span data-testid={`text-time-${appointment.id}`}>
                              {format(new Date(appointment.scheduledStart), "h:mm a")} - 
                              {format(new Date(appointment.scheduledEnd), "h:mm a")}
                            </span>
                          </div>
                        </div>

                        {appointment.smartCase?.aiTriageJson ? (
                          <div className="bg-muted p-3 rounded-lg text-sm" data-testid={`ai-analysis-${appointment.id}`}>
                            <p className="font-medium mb-1">AI Analysis:</p>
                            <p className="text-muted-foreground">
                              {String((appointment.smartCase.aiTriageJson as any)?.summary || "No AI analysis available")}
                            </p>
                          </div>
                        ) : null}

                        <div className="flex gap-2">
                          <Button
                            data-testid={`button-accept-${appointment.id}`}
                            onClick={() => handleAcceptAppointment(appointment)}
                            disabled={updateAppointmentMutation.isPending}
                            className="flex-1"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Accept
                          </Button>
                          <Button
                            data-testid={`button-decline-${appointment.id}`}
                            onClick={() => handleDeclineAppointment(appointment)}
                            disabled={updateAppointmentMutation.isPending}
                            variant="outline"
                            className="flex-1"
                          >
                            Decline
                          </Button>
                          {appointment.smartCase && (
                            <Button
                              data-testid={`button-view-${appointment.id}`}
                              onClick={() => viewCaseDetail(appointment.smartCase!)}
                              variant="ghost"
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="upcoming" className="space-y-4">
                {upcomingAppointments.length === 0 ? (
                  <Card data-testid="card-no-upcoming">
                    <CardContent className="p-6 text-center text-muted-foreground">
                      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No upcoming appointments</p>
                    </CardContent>
                  </Card>
                ) : (
                  upcomingAppointments.map((appointment) => (
                    <Card key={appointment.id} data-testid={`card-upcoming-${appointment.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg">
                            {appointment.smartCase?.title || "Maintenance Request"}
                          </CardTitle>
                          <Badge variant={getStatusColor(appointment.status)}>
                            {appointment.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>{format(new Date(appointment.scheduledStart), "MMM d, yyyy")}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {format(new Date(appointment.scheduledStart), "h:mm a")} - 
                              {format(new Date(appointment.scheduledEnd), "h:mm a")}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="cases" className="space-y-4">
                {assignedCases.length === 0 ? (
                  <Card data-testid="card-no-cases">
                    <CardContent className="p-6 text-center text-muted-foreground">
                      <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No assigned cases</p>
                    </CardContent>
                  </Card>
                ) : (
                  assignedCases.map((caseItem) => (
                    <Card key={caseItem.id} data-testid={`card-case-${caseItem.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{caseItem.title}</CardTitle>
                            <CardDescription>{caseItem.description}</CardDescription>
                          </div>
                          <div className="flex flex-col gap-2 items-end">
                            <Badge variant={getPriorityColor(caseItem.priority || "")}>
                              {caseItem.priority}
                            </Badge>
                            {caseItem.category && (
                              <Badge variant="outline">{caseItem.category}</Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {caseItem.aiTriageJson ? (
                          <div className="bg-muted p-3 rounded-lg text-sm">
                            <p className="font-medium mb-1">AI Summary:</p>
                            <p className="text-muted-foreground">
                              {String((caseItem.aiTriageJson as any)?.summary || "No summary available")}
                            </p>
                            {(caseItem.aiTriageJson as any)?.safetyWarning ? (
                              <div className="flex items-start gap-2 mt-2 text-amber-600 dark:text-amber-500">
                                <AlertTriangle className="h-4 w-4 mt-0.5" />
                                <p className="text-sm">{String((caseItem.aiTriageJson as any).safetyWarning)}</p>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="flex gap-2">
                          <Select
                            value={caseItem.status || "New"}
                            onValueChange={(status) => handleUpdateCaseStatus(caseItem.id, status)}
                          >
                            <SelectTrigger data-testid={`select-status-${caseItem.id}`}>
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
                            data-testid={`button-view-case-${caseItem.id}`}
                            onClick={() => viewCaseDetail(caseItem)}
                            variant="outline"
                          >
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
              </>
            )}
          </div>
        </main>
      </div>

      <Dialog open={showCaseDetail} onOpenChange={setShowCaseDetail}>
        <DialogContent className="max-w-2xl" data-testid="dialog-case-detail">
          <DialogHeader>
            <DialogTitle>{selectedCase?.title}</DialogTitle>
          </DialogHeader>
          {selectedCase && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-1">Description</h4>
                <p className="text-sm text-muted-foreground">{selectedCase.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-1">Priority</h4>
                  <Badge variant={getPriorityColor(selectedCase.priority || "")} data-testid="text-detail-priority">
                    {selectedCase.priority}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">Status</h4>
                  <Badge variant="outline" data-testid="text-detail-status">{selectedCase.status}</Badge>
                </div>
                {selectedCase.category && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Category</h4>
                    <Badge variant="outline" data-testid="text-detail-category">{selectedCase.category}</Badge>
                  </div>
                )}
              </div>

              {selectedCase.aiTriageJson ? (
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-medium">AI Triage Analysis</h4>
                  <div className="space-y-2 text-sm">
                    {(selectedCase.aiTriageJson as any)?.summary ? (
                      <div>
                        <span className="font-medium">Summary: </span>
                        <span className="text-muted-foreground" data-testid="text-detail-ai-summary">
                          {String((selectedCase.aiTriageJson as any).summary)}
                        </span>
                      </div>
                    ) : null}
                    {(selectedCase.aiTriageJson as any)?.estimatedCost ? (
                      <div>
                        <span className="font-medium">Estimated Cost: </span>
                        <span className="text-muted-foreground" data-testid="text-detail-estimated-cost">
                          ${(selectedCase.aiTriageJson as any).estimatedCost.min} - 
                          ${(selectedCase.aiTriageJson as any).estimatedCost.max}
                        </span>
                      </div>
                    ) : null}
                    {(selectedCase.aiTriageJson as any)?.recommendedActions ? (
                      <div>
                        <span className="font-medium">Recommended Actions: </span>
                        <span className="text-muted-foreground" data-testid="text-detail-recommended-actions">
                          {String(Array.isArray((selectedCase.aiTriageJson as any).recommendedActions)
                            ? (selectedCase.aiTriageJson as any).recommendedActions.join(", ")
                            : (selectedCase.aiTriageJson as any).recommendedActions)}
                        </span>
                      </div>
                    ) : null}
                    {(selectedCase.aiTriageJson as any)?.safetyWarning ? (
                      <div className="flex items-start gap-2 text-amber-600 dark:text-amber-500 mt-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                        <div>
                          <span className="font-medium">Safety Warning: </span>
                          <span data-testid="text-detail-safety-warning">
                            {String((selectedCase.aiTriageJson as any).safetyWarning)}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
