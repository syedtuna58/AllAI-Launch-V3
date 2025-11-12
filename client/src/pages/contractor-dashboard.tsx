import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar, Clock, MapPin, Heart, CheckCircle, AlertTriangle, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { LiveNotification } from "@/components/ui/live-notification";
import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import { Link } from "wouter";
import PropertyAssistant from "@/components/ai/property-assistant";
import { LiveSchedulingWidget } from "@/components/LiveSchedulingWidget";

interface ContractorCase {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  buildingName?: string;
  roomNumber?: string;
  locationText?: string;
  estimatedCost?: number;
  actualCost?: number;
  assignedContractorId?: string;
  createdAt: string;
  updatedAt: string;
}

interface ContractorAppointment {
  id: string;
  caseId?: string;
  contractorId: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  status: string;
  notes?: string;
}

const PRIORITY_COLORS = {
  Low: "text-green-700 border-green-300",
  Medium: "text-amber-700 border-amber-300",
  High: "text-orange-600 border-orange-300",
  Urgent: "text-orange-700 border-orange-300"
};

const STATUS_COLORS = {
  New: "text-blue-700 border-blue-300",
  Assigned: "text-cyan-700 border-cyan-300",
  "In Review": "text-amber-700 border-amber-300",
  Scheduled: "text-purple-700 border-purple-300",
  "In Progress": "text-orange-600 border-orange-300",
  "On Hold": "text-gray-700 border-gray-300",
  Resolved: "text-green-700 border-green-300",
  Closed: "text-gray-600 border-gray-300",
  Pending: "text-blue-700 border-blue-300",
  Confirmed: "text-green-700 border-green-300",
  Completed: "text-green-700 border-green-300"
};

const CaseCard = ({
  case_,
  isFavorite,
  onToggleFavorite,
  onAcceptCase,
  onProposeTime,
  updateCaseStatus,
  acceptCaseMutation
}: {
  case_: ContractorCase,
  isFavorite: boolean,
  onToggleFavorite: (caseId: string) => void,
  onAcceptCase: (case_: ContractorCase) => void,
  onProposeTime: (case_: ContractorCase) => void,
  updateCaseStatus: any,
  acceptCaseMutation: any
}) => {
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "Urgent":
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case "High":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {getPriorityIcon(case_.priority)}
              {case_.title}
            </CardTitle>
            <CardDescription className="mt-1">
              {case_.buildingName && case_.roomNumber ?
                `${case_.buildingName} - Room ${case_.roomNumber}` :
                case_.locationText || 'Location TBD'
              }
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-transparent hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              onClick={() => onToggleFavorite(case_.id)}
              data-testid={`button-favorite-${case_.id}`}
              aria-pressed={isFavorite}
              title={isFavorite ? 'Unfavorite' : 'Favorite'}
            >
              <Heart
                className={`h-4 w-4 transition-colors ${isFavorite
                  ? 'text-pink-500 fill-pink-500'
                  : 'text-muted-foreground hover:text-pink-400'
                }`}
              />
            </Button>
            <div className="flex flex-col gap-2">
              <Badge variant="outline" className={PRIORITY_COLORS[case_.priority as keyof typeof PRIORITY_COLORS] || "bg-gray-100"}>
                {case_.priority}
              </Badge>
              <Badge variant="outline" className={STATUS_COLORS[case_.status as keyof typeof STATUS_COLORS] || "bg-gray-100"}>
                {case_.status}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{case_.description}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>{case_.category}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{formatDateTime(case_.createdAt)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            {(case_.status === "New" || case_.status === "In Review") && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onProposeTime(case_)}
                  data-testid={`button-propose-time-${case_.id}`}
                >
                  Propose Times
                </Button>
                <Button
                  size="sm"
                  onClick={() => onAcceptCase(case_)}
                  disabled={acceptCaseMutation.isPending}
                  data-testid={`button-accept-case-${case_.id}`}
                >
                  Accept Now
                </Button>
              </>
            )}
            {case_.status === "Scheduled" && (
              <Button
                size="sm"
                onClick={() => updateCaseStatus.mutate({ caseId: case_.id, status: "In Progress" })}
                disabled={updateCaseStatus.isPending}
                data-testid={`button-start-case-${case_.id}`}
              >
                Start Work
              </Button>
            )}
            {case_.status === "In Progress" && (
              <Button
                size="sm"
                variant="default"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => updateCaseStatus.mutate({ caseId: case_.id, status: "Resolved" })}
                disabled={updateCaseStatus.isPending}
                data-testid={`button-complete-case-${case_.id}`}
              >
                Mark Complete
              </Button>
            )}
            {case_.status === "Resolved" && (
              <Button
                size="sm"
                variant="default"
                className="bg-gray-600 hover:bg-gray-700 text-white"
                onClick={() => updateCaseStatus.mutate({ caseId: case_.id, status: "Closed" })}
                disabled={updateCaseStatus.isPending}
                data-testid={`button-close-case-${case_.id}`}
              >
                Close & Archive
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function ContractorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("cases");
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [acceptingCase, setAcceptingCase] = useState<ContractorCase | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [acceptNotes, setAcceptNotes] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState(120);
  const [acceptCost, setAcceptCost] = useState("");
  const [acceptAiGuidance, setAcceptAiGuidance] = useState<any>(null);
  const [acceptLoadingGuidance, setAcceptLoadingGuidance] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [hideClosedCases, setHideClosedCases] = useState<boolean>(true);
  const [favoriteCases, setFavoriteCases] = useState<Set<string>>(new Set());
  
  // Multi-slot proposal state
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
  const [proposingCase, setProposingCase] = useState<ContractorCase | null>(null);
  const [proposalCost, setProposalCost] = useState("");
  const [proposalDuration, setProposalDuration] = useState(120);
  const [proposalNotes, setProposalNotes] = useState("");
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<{start: Date; end: Date}[]>([]);
  const [aiGuidance, setAiGuidance] = useState<any>(null);
  const [loadingGuidance, setLoadingGuidance] = useState(false);

  // Fetch contractor's vendor profile to get vendor ID
  const { data: contractorProfile } = useQuery<any>({
    queryKey: ['/api/contractors/me'],
    enabled: !!user
  });

  const { data: assignedCases = [], isLoading: casesLoading } = useQuery<ContractorCase[]>({
    queryKey: ['/api/contractor/cases'],
    enabled: !!user
  });

  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery<ContractorAppointment[]>({
    queryKey: ['/api/contractor/appointments'],
    enabled: !!user
  });

  const updateCaseStatus = useMutation({
    mutationFn: async ({ caseId, status, notes }: { caseId: string; status: string; notes?: string }) => {
      return await apiRequest("PATCH", `/api/cases/${caseId}`, {
        status,
        ...(notes && { notes })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/cases'] });
      toast({
        title: "Status Updated",
        description: "Case status has been updated successfully."
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update case status. Please try again.",
        variant: "destructive"
      });
    }
  });

  const updateAppointmentStatus = useMutation({
    mutationFn: async ({ appointmentId, status, notes }: { appointmentId: string; status: string; notes?: string }) => {
      return await apiRequest("PATCH", `/api/appointments/${appointmentId}`, {
        status,
        ...(notes && { notes })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/appointments'] });
      toast({
        title: "Appointment Updated",
        description: "Appointment status has been updated successfully."
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update appointment status. Please try again.",
        variant: "destructive"
      });
    }
  });

  const acceptCaseMutation = useMutation({
    mutationFn: async ({ caseId, scheduledDateTime, notes, estimatedDurationMinutes }: {
      caseId: string;
      scheduledDateTime: string;
      notes?: string;
      estimatedDurationMinutes?: number;
    }) => {
      return await apiRequest("POST", `/api/contractor/accept-case`, {
        caseId,
        scheduledDateTime,
        notes,
        estimatedDurationMinutes
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/appointments'] });

      setAcceptDialogOpen(false);
      setAcceptingCase(null);
      setScheduledDate("");
      setScheduledTime("");
      setAcceptNotes("");

      toast({
        title: "Case Accepted!",
        description: "Case has been accepted and scheduled successfully."
      });
    },
    onError: (error: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/appointments'] });

      const errorMessage = error?.message || "Unknown error occurred";

      if (errorMessage.includes("Scheduling conflict") || errorMessage.includes("conflicts with existing")) {
        toast({
          title: "Scheduling Conflict",
          description: "This time slot conflicts with another appointment. Please choose a different time.",
          variant: "destructive"
        });
      } else if (errorMessage.includes("Cannot accept case")) {
        toast({
          title: "Case No Longer Available",
          description: "This case has already been accepted by another contractor or its status has changed.",
          variant: "destructive"
        });
        setAcceptDialogOpen(false);
        setAcceptingCase(null);
        setScheduledDate("");
        setScheduledTime("");
        setAcceptNotes("");
      } else {
        toast({
          title: "Accept Failed",
          description: `Failed to accept case: ${errorMessage}`,
          variant: "destructive"
        });
      }
    }
  });

  const createProposalMutation = useMutation({
    mutationFn: async ({ caseId, cost, duration, notes, slots }: {
      caseId: string;
      cost: number;
      duration: number;
      notes: string;
      slots: Array<{ startTime: string; endTime: string; slotNumber: number }>;
    }) => {
      // Create the proposal
      const proposalRes = await apiRequest("POST", `/api/cases/${caseId}/proposals`, {
        caseId,
        contractorId: user?.id,
        estimatedCost: cost,
        estimatedDurationMinutes: duration,
        notes,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours from now
      });
      const proposal = await proposalRes.json();

      // Create the slots
      for (const slot of slots) {
        await apiRequest("POST", `/api/proposals/${proposal.id}/slots`, {
          proposalId: proposal.id,
          slotNumber: slot.slotNumber,
          startTime: slot.startTime,
          endTime: new Date(new Date(slot.startTime).getTime() + duration * 60000).toISOString(),
        });
      }

      return proposal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/cases'] });
      setProposalDialogOpen(false);
      setProposingCase(null);
      setProposalCost("");
      setProposalDuration(120);
      setProposalNotes("");
      setSelectedTimeSlots([]);
      
      toast({
        title: "Proposal Sent!",
        description: "Your time slot proposal has been sent to the tenant for review."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Proposal Failed",
        description: error?.message || "Failed to create proposal. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleProposeTime = async (case_: ContractorCase) => {
    setProposingCase(case_);
    setProposalDialogOpen(true);
    
    // Fetch AI guidance
    setLoadingGuidance(true);
    try {
      const res = await fetch(`/api/cases/${case_.id}/ai-guidance`, {
        credentials: 'include'
      });
      if (res.ok) {
        const guidance = await res.json();
        setAiGuidance(guidance);
        
        // Pre-fill with AI suggestions
        setProposalDuration(guidance.duration.estimatedMinutes);
        if (guidance.cost.estimatedCostAverage) {
          setProposalCost(guidance.cost.estimatedCostAverage.toString());
        }
      }
    } catch (error) {
      console.error("Failed to fetch AI guidance:", error);
    } finally {
      setLoadingGuidance(false);
    }
  };

  const handleConfirmProposal = () => {
    if (!proposingCase || !proposalCost || selectedTimeSlots.length !== 3) {
      toast({
        title: "Missing Information",
        description: "Please fill in cost and select exactly 3 time slots.",
        variant: "destructive"
      });
      return;
    }

    const cost = parseFloat(proposalCost);
    if (isNaN(cost)) {
      toast({
        title: "Invalid Cost",
        description: "Please enter a valid cost amount.",
        variant: "destructive"
      });
      return;
    }

    const slots = selectedTimeSlots.map((slot, index) => ({
      slotNumber: index + 1,
      startTime: slot.start.toISOString(),
      endTime: slot.end.toISOString(),
    }));

    createProposalMutation.mutate({
      caseId: proposingCase.id,
      cost,
      duration: proposalDuration,
      notes: proposalNotes,
      slots,
    });
  };

  const handleAcceptCase = async (case_: ContractorCase) => {
    // Reset all state first to avoid stale data
    setAcceptAiGuidance(null);
    setAcceptCost("");
    setEstimatedDuration(120);
    setScheduledDate("");
    setScheduledTime("");
    setAcceptNotes("");
    
    setAcceptingCase(case_);
    setAcceptDialogOpen(true);
    
    // Fetch AI guidance
    setAcceptLoadingGuidance(true);
    try {
      const res = await fetch(`/api/cases/${case_.id}/ai-guidance`, {
        credentials: 'include'
      });
      if (res.ok) {
        const guidance = await res.json();
        setAcceptAiGuidance(guidance);
        
        // Pre-fill with AI suggestions
        setEstimatedDuration(guidance.duration.estimatedMinutes);
        if (guidance.cost.estimatedCostAverage) {
          setAcceptCost(guidance.cost.estimatedCostAverage.toString());
        }
      } else {
        // Clear guidance on error
        setAcceptAiGuidance(null);
      }
    } catch (error) {
      console.error("Failed to fetch AI guidance:", error);
      setAcceptAiGuidance(null);
    } finally {
      setAcceptLoadingGuidance(false);
    }
  };

  const handleConfirmAccept = () => {
    if (!acceptingCase || !scheduledDate || !scheduledTime) {
      toast({
        title: "Missing Information",
        description: "Please select both date and time for the appointment.",
        variant: "destructive"
      });
      return;
    }

    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
    
    acceptCaseMutation.mutate({
      caseId: acceptingCase.id,
      scheduledDateTime,
      notes: acceptNotes,
      estimatedDurationMinutes: estimatedDuration
    });
  };

  const handleToggleFavorite = (caseId: string) => {
    setFavoriteCases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(caseId)) {
        newSet.delete(caseId);
      } else {
        newSet.add(caseId);
      }
      return newSet;
    });
  };

  const filteredCases = assignedCases.filter(case_ => {
    if (hideClosedCases && case_.status === "Closed") return false;
    if (statusFilter !== "All" && case_.status !== statusFilter) return false;
    if (typeFilter !== "All" && case_.category !== typeFilter) return false;
    return true;
  });

  // All assignedCases from the backend are already filtered to this contractor's vendor IDs
  // So myCases is simply all the assigned cases (no additional filtering needed)
  const myCases = filteredCases;
  
  // New cases would come from marketplace - currently assignedCases only contains assigned cases
  // So newCases for marketplace would need a separate endpoint in the future
  const newCases = filteredCases.filter(c => c.status === "New");
  
  const activeCases = myCases.filter(c => ["Scheduled", "In Progress"].includes(c.status || ""));
  const favoritedCases = filteredCases.filter(c => favoriteCases.has(c.id));

  const categories = Array.from(new Set(assignedCases.map(c => c.category).filter(Boolean)));
  const statuses = Array.from(new Set(assignedCases.map(c => c.status).filter(Boolean)));

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="Contractor Dashboard" />

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-foreground" data-testid="text-contractor-dashboard-title">
                  Contractor Dashboard
                </h1>
                <p className="text-muted-foreground mt-2">
                  Manage your maintenance cases and schedule appointments
                </p>
              </div>
              <Link href="/contractor-availability">
                <Button variant="outline" data-testid="button-manage-availability">
                  <Calendar className="h-4 w-4 mr-2" />
                  Manage Availability
                </Button>
              </Link>
            </div>

            {/* Maya AI Assistant */}
            <PropertyAssistant context="contractor-dashboard" />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedTab("cases")} data-testid="card-my-cases">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">My Cases</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-my-cases-count">
                    {myCases.length}
                  </div>
                  <p className="text-xs text-muted-foreground">Assigned to you</p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedTab("active")} data-testid="card-active-work">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Work</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600" data-testid="text-active-cases-count">
                    {activeCases.length}
                  </div>
                  <p className="text-xs text-muted-foreground">In progress</p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedTab("new")} data-testid="card-new-cases">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">New Cases</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600" data-testid="text-new-cases-count">
                    {newCases.length}
                  </div>
                  <p className="text-xs text-muted-foreground">Available to accept</p>
                </CardContent>
              </Card>

              <Link href="/maintenance">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-primary/5 border-primary/20" data-testid="card-job-hub">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Job Hub</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary flex items-center justify-center mb-1">
                      <Wrench className="h-8 w-8" />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">View all jobs</p>
                  </CardContent>
                </Card>
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="cases" data-testid="tab-my-cases">
                      My Cases ({myCases.length})
                    </TabsTrigger>
                    <TabsTrigger value="new" data-testid="tab-new-cases">
                      New Cases ({newCases.length})
                    </TabsTrigger>
                    <TabsTrigger value="active" data-testid="tab-active">
                      Active ({activeCases.length})
                    </TabsTrigger>
                  </TabsList>

              <TabsContent value="cases" className="mt-6 space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {casesLoading ? (
                  <div className="text-center py-8">Loading cases...</div>
                ) : myCases.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No cases assigned to you. Check the "New Cases" tab to accept new work.
                  </div>
                ) : (
                  myCases.map((case_) => (
                    <CaseCard
                      key={case_.id}
                      case_={case_}
                      isFavorite={favoriteCases.has(case_.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onAcceptCase={handleAcceptCase}
                      onProposeTime={handleProposeTime}
                      updateCaseStatus={updateCaseStatus}
                      acceptCaseMutation={acceptCaseMutation}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="new" className="mt-6 space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {newCases.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No new cases available at the moment.
                  </div>
                ) : (
                  newCases.map((case_) => (
                    <CaseCard
                      key={case_.id}
                      case_={case_}
                      isFavorite={favoriteCases.has(case_.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onAcceptCase={handleAcceptCase}
                      onProposeTime={handleProposeTime}
                      updateCaseStatus={updateCaseStatus}
                      acceptCaseMutation={acceptCaseMutation}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="active" className="mt-6 space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {activeCases.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No active cases.
                  </div>
                ) : (
                  activeCases.map((case_) => (
                    <CaseCard
                      key={case_.id}
                      case_={case_}
                      isFavorite={favoriteCases.has(case_.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onAcceptCase={handleAcceptCase}
                      onProposeTime={handleProposeTime}
                      updateCaseStatus={updateCaseStatus}
                      acceptCaseMutation={acceptCaseMutation}
                    />
                  ))
                )}
              </TabsContent>

                </Tabs>
              </div>

              <div className="lg:col-span-1">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-lg">This Week</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Link href="/calendar">
                      <Button variant="ghost" className="w-full justify-start text-sm mb-4 hover:bg-primary/10" data-testid="button-view-full-calendar">
                        <Calendar className="h-4 w-4 mr-2" />
                        View Full Calendar
                      </Button>
                    </Link>
                    
                    {appointmentsLoading ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">Loading schedule...</div>
                    ) : appointments.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        No scheduled appointments this week
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {appointments.slice(0, 5).map((apt) => (
                          <div key={apt.id} className="border-l-4 border-primary pl-3 py-2 hover:bg-muted/50 transition-colors" data-testid={`appointment-${apt.id}`}>
                            <div className="font-medium text-sm">Scheduled Job</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(apt.scheduledStartAt), 'EEE, MMM d • h:mm a')}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Status: {apt.status}
                            </div>
                          </div>
                        ))}
                        {appointments.length > 5 && (
                          <Link href="/calendar">
                            <Button variant="link" size="sm" className="w-full text-xs" data-testid="button-view-more-appointments">
                              View {appointments.length - 5} more →
                            </Button>
                          </Link>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>

      <Dialog open={proposalDialogOpen} onOpenChange={setProposalDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="dialog-propose-times">
          <DialogHeader>
            <DialogTitle>Propose Time Slots</DialogTitle>
            <DialogDescription>
              {proposingCase?.title} - Offer 3 time options for the tenant to choose from
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {loadingGuidance ? (
              <div className="bg-muted/50 p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="text-sm text-muted-foreground">Getting AI guidance...</span>
                </div>
              </div>
            ) : aiGuidance ? (
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2 mb-3">
                  <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-semibold">AI</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm mb-1">AI Recommendations (Editable)</h4>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="proposal-cost">Estimated Cost ($)</Label>
                <Input
                  id="proposal-cost"
                  type="number"
                  placeholder="150.00"
                  value={proposalCost}
                  onChange={(e) => setProposalCost(e.target.value)}
                  data-testid="input-proposal-cost"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="proposal-duration">Duration (minutes)</Label>
                <Input
                  id="proposal-duration"
                  type="number"
                  value={proposalDuration}
                  onChange={(e) => setProposalDuration(Number(e.target.value))}
                  min={15}
                  step={15}
                  data-testid="input-proposal-duration"
                />
              </div>
            </div>

            <LiveSchedulingWidget
              durationMinutes={proposalDuration}
              onSlotSelect={(slot) => {
                // Check if slot is already selected (for deselection)
                const isAlreadySelected = selectedTimeSlots.some(
                  s => new Date(s.start).getTime() === new Date(slot.start).getTime()
                );
                
                if (isAlreadySelected) {
                  // Remove the slot
                  setSelectedTimeSlots(selectedTimeSlots.filter(
                    s => new Date(s.start).getTime() !== new Date(slot.start).getTime()
                  ));
                } else if (selectedTimeSlots.length < 3) {
                  // Add the slot
                  setSelectedTimeSlots([...selectedTimeSlots, slot]);
                }
              }}
              selectedSlots={selectedTimeSlots}
              maxSlots={3}
              title="Select 3 Available Time Slots"
            />

            <div className="grid gap-2">
              <Label htmlFor="proposal-notes">Notes (optional)</Label>
              <Textarea
                id="proposal-notes"
                value={proposalNotes}
                onChange={(e) => setProposalNotes(e.target.value)}
                placeholder="Add any notes about the proposed times or requirements..."
                data-testid="textarea-proposal-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProposalDialogOpen(false)}
              data-testid="button-cancel-proposal"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmProposal}
              disabled={createProposalMutation.isPending}
              data-testid="button-confirm-proposal"
            >
              {createProposalMutation.isPending ? "Sending..." : "Send Proposal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={acceptDialogOpen} onOpenChange={(open) => {
        setAcceptDialogOpen(open);
        if (!open) {
          // Reset state when closing
          setAcceptAiGuidance(null);
          setAcceptCost("");
          setEstimatedDuration(120);
          setScheduledDate("");
          setScheduledTime("");
          setAcceptNotes("");
          setAcceptingCase(null);
        }
      }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" data-testid="dialog-accept-case">
          <DialogHeader>
            <DialogTitle>Accept Case & Schedule Appointment</DialogTitle>
            <DialogDescription>
              {acceptingCase?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {acceptLoadingGuidance ? (
              <div className="bg-muted/50 p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="text-sm text-muted-foreground">Getting AI guidance...</span>
                </div>
              </div>
            ) : acceptAiGuidance ? (
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2 mb-3">
                  <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-semibold">AI</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm mb-1">AI Recommendations (Editable)</h4>
                    <p className="text-xs text-muted-foreground mb-3">Based on job analysis and market data</p>
                    
                    <div className="space-y-2">
                      <div>
                        <div className="text-xs font-medium text-blue-700 dark:text-blue-300">Duration</div>
                        <div className="text-sm">{acceptAiGuidance.duration.estimatedMinutes} minutes</div>
                        <div className="text-xs text-muted-foreground italic mt-0.5">{acceptAiGuidance.duration.reasoning}</div>
                      </div>
                      
                      <div>
                        <div className="text-xs font-medium text-blue-700 dark:text-blue-300">Estimated Cost</div>
                        <div className="text-sm">
                          ${acceptAiGuidance.cost.estimatedCostLow} - ${acceptAiGuidance.cost.estimatedCostHigh} 
                          <span className="text-muted-foreground ml-2">(avg: ${acceptAiGuidance.cost.estimatedCostAverage})</span>
                        </div>
                        <div className="text-xs text-muted-foreground italic mt-0.5">{acceptAiGuidance.cost.reasoning}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="accept-cost">Estimated Cost ($)</Label>
                <Input
                  id="accept-cost"
                  type="number"
                  placeholder="150.00"
                  value={acceptCost}
                  onChange={(e) => setAcceptCost(e.target.value)}
                  data-testid="input-accept-cost"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="estimated-duration">Duration (minutes)</Label>
                <Input
                  id="estimated-duration"
                  type="number"
                  value={estimatedDuration}
                  onChange={(e) => setEstimatedDuration(Number(e.target.value))}
                  min={15}
                  step={15}
                  data-testid="input-estimated-duration"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="scheduled-date">Appointment Date</Label>
              <Input
                id="scheduled-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                data-testid="input-scheduled-date"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="scheduled-time">Appointment Time</Label>
              <Input
                id="scheduled-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                data-testid="input-scheduled-time"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="accept-notes">Notes (optional)</Label>
              <Textarea
                id="accept-notes"
                value={acceptNotes}
                onChange={(e) => setAcceptNotes(e.target.value)}
                placeholder="Add any notes or special requirements..."
                data-testid="textarea-accept-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAcceptDialogOpen(false)}
              data-testid="button-cancel-accept"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAccept}
              disabled={acceptCaseMutation.isPending}
              data-testid="button-confirm-accept"
            >
              {acceptCaseMutation.isPending ? "Accepting..." : "Accept & Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {user?.id && (
        <LiveNotification
          userRole="contractor"
          userId={user.id}
        />
      )}
    </div>
  );
}
