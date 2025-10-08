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
import { Calendar, Clock, MapPin, Heart, CheckCircle, AlertTriangle } from "lucide-react";
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
            {case_.status === "New" && (
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
  const [slot1Date, setSlot1Date] = useState("");
  const [slot1Time, setSlot1Time] = useState("");
  const [slot2Date, setSlot2Date] = useState("");
  const [slot2Time, setSlot2Time] = useState("");
  const [slot3Date, setSlot3Date] = useState("");
  const [slot3Time, setSlot3Time] = useState("");

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
      const proposal = await apiRequest("POST", `/api/cases/${caseId}/proposals`, {
        caseId,
        contractorId: user?.id,
        estimatedCost: cost,
        estimatedDurationMinutes: duration,
        notes,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours from now
      });

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
      setSlot1Date("");
      setSlot1Time("");
      setSlot2Date("");
      setSlot2Time("");
      setSlot3Date("");
      setSlot3Time("");
      
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

  const handleProposeTime = (case_: ContractorCase) => {
    setProposingCase(case_);
    setProposalDialogOpen(true);
  };

  const handleConfirmProposal = () => {
    if (!proposingCase || !proposalCost || !slot1Date || !slot1Time || !slot2Date || !slot2Time || !slot3Date || !slot3Time) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields including cost and all 3 time slots.",
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

    const slots = [
      {
        slotNumber: 1,
        startTime: new Date(`${slot1Date}T${slot1Time}`).toISOString(),
        endTime: new Date(new Date(`${slot1Date}T${slot1Time}`).getTime() + proposalDuration * 60000).toISOString(),
      },
      {
        slotNumber: 2,
        startTime: new Date(`${slot2Date}T${slot2Time}`).toISOString(),
        endTime: new Date(new Date(`${slot2Date}T${slot2Time}`).getTime() + proposalDuration * 60000).toISOString(),
      },
      {
        slotNumber: 3,
        startTime: new Date(`${slot3Date}T${slot3Time}`).toISOString(),
        endTime: new Date(new Date(`${slot3Date}T${slot3Time}`).getTime() + proposalDuration * 60000).toISOString(),
      },
    ];

    createProposalMutation.mutate({
      caseId: proposingCase.id,
      cost,
      duration: proposalDuration,
      notes: proposalNotes,
      slots,
    });
  };

  const handleAcceptCase = (case_: ContractorCase) => {
    setAcceptingCase(case_);
    setAcceptDialogOpen(true);
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

  const myCases = filteredCases.filter(c => c.assignedContractorId === user?.id);
  const newCases = filteredCases.filter(c => c.status === "New" && !c.assignedContractorId);
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
              <Card>
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

              <Card>
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

              <Card>
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

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Favorites</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-pink-600" data-testid="text-favorites-count">
                    {favoritedCases.length}
                  </div>
                  <p className="text-xs text-muted-foreground">Saved cases</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-4 items-center">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Statuses</SelectItem>
                    {statuses.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-type-filter">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Types</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="hide-closed"
                    checked={hideClosedCases}
                    onCheckedChange={setHideClosedCases}
                    data-testid="switch-hide-closed"
                  />
                  <Label htmlFor="hide-closed">Hide Closed Cases</Label>
                </div>
              </CardContent>
            </Card>

            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="cases" data-testid="tab-my-cases">
                  My Cases ({myCases.length})
                </TabsTrigger>
                <TabsTrigger value="new" data-testid="tab-new-cases">
                  New Cases ({newCases.length})
                </TabsTrigger>
                <TabsTrigger value="active" data-testid="tab-active">
                  Active ({activeCases.length})
                </TabsTrigger>
                <TabsTrigger value="favorites" data-testid="tab-favorites">
                  Favorites ({favoritedCases.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="cases" className="mt-6 space-y-4">
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

              <TabsContent value="new" className="mt-6 space-y-4">
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

              <TabsContent value="active" className="mt-6 space-y-4">
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

              <TabsContent value="favorites" className="mt-6 space-y-4">
                {favoritedCases.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No favorited cases. Click the heart icon on any case to add it to favorites.
                  </div>
                ) : (
                  favoritedCases.map((case_) => (
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

            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-semibold">Option 1</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="slot1-date">Date</Label>
                  <Input
                    id="slot1-date"
                    type="date"
                    value={slot1Date}
                    onChange={(e) => setSlot1Date(e.target.value)}
                    data-testid="input-slot1-date"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="slot1-time">Time</Label>
                  <Input
                    id="slot1-time"
                    type="time"
                    value={slot1Time}
                    onChange={(e) => setSlot1Time(e.target.value)}
                    data-testid="input-slot1-time"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-semibold">Option 2</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="slot2-date">Date</Label>
                  <Input
                    id="slot2-date"
                    type="date"
                    value={slot2Date}
                    onChange={(e) => setSlot2Date(e.target.value)}
                    data-testid="input-slot2-date"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="slot2-time">Time</Label>
                  <Input
                    id="slot2-time"
                    type="time"
                    value={slot2Time}
                    onChange={(e) => setSlot2Time(e.target.value)}
                    data-testid="input-slot2-time"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-semibold">Option 3</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="slot3-date">Date</Label>
                  <Input
                    id="slot3-date"
                    type="date"
                    value={slot3Date}
                    onChange={(e) => setSlot3Date(e.target.value)}
                    data-testid="input-slot3-date"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="slot3-time">Time</Label>
                  <Input
                    id="slot3-time"
                    type="time"
                    value={slot3Time}
                    onChange={(e) => setSlot3Time(e.target.value)}
                    data-testid="input-slot3-time"
                  />
                </div>
              </div>
            </div>

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

      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-accept-case">
          <DialogHeader>
            <DialogTitle>Accept Case & Schedule Appointment</DialogTitle>
            <DialogDescription>
              {acceptingCase?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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
              <Label htmlFor="estimated-duration">Estimated Duration (minutes)</Label>
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
