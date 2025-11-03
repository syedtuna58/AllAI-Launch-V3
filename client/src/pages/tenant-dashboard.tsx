import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, Clock, AlertTriangle, CheckCircle, MapPin, Wrench, ThumbsUp, ThumbsDown, Bot, Send, ChevronDown, ChevronUp, Home, Building, Camera, Loader2 } from "lucide-react";
import { LiveNotification } from "@/components/ui/live-notification";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ObjectUploader } from "@/components/ObjectUploader";
import TenantCalendar from "@/components/TenantCalendar";

interface TenantCase {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  buildingName?: string;
  roomNumber?: string;
  createdAt: string;
  updatedAt: string;
  assignedContractorId?: string;
}

interface TenantAppointment {
  id: string;
  caseId: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  status: string;
  notes?: string;
  requiresTenantAccess: boolean;
  tenantApproved: boolean;
}

interface ScheduledJob {
  id: string;
  title: string;
  description: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  status: string;
  urgency: string;
  caseId: string | null;
  contractorId: string | null;
  address: string | null;
  notes: string | null;
  orgId: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  data?: any;
}

interface PropertyMatch {
  id: string;
  name: string;
  address: string;
  unitId?: string;
  unitNumber?: string;
  matchScore: number;
  matchReason: string;
}

const PRIORITY_COLORS = {
  Low: "text-green-700 border-green-300 bg-green-50",
  Medium: "text-amber-700 border-amber-300 bg-amber-50",
  High: "text-orange-600 border-orange-300 bg-orange-50",
  Urgent: "text-red-700 border-red-300 bg-red-50"
};

const STATUS_COLORS = {
  New: "text-blue-700 border-blue-300 bg-blue-50",
  "In Review": "text-amber-700 border-amber-300 bg-amber-50",
  Scheduled: "text-purple-700 border-purple-300 bg-purple-50",
  "In Progress": "text-orange-600 border-orange-300 bg-orange-50",
  "On Hold": "text-gray-700 border-gray-300 bg-gray-50",
  Resolved: "text-green-700 border-green-300 bg-green-50",
  Closed: "text-gray-600 border-gray-300 bg-gray-50"
};

export default function TenantDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedTab, setSelectedTab] = useState("cases");
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<TenantAppointment | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [selectedJob, setSelectedJob] = useState<ScheduledJob | null>(null);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [counterProposeDialogOpen, setCounterProposeDialogOpen] = useState(false);
  const [availabilitySlots, setAvailabilitySlots] = useState<Array<{startAt: string, endAt: string}>>([{startAt: '', endAt: ''}]);
  const [counterProposeReason, setCounterProposeReason] = useState('');
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm Maya 👋 Tell me about your maintenance issue and I'll help you submit a request.",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationState, setConversationState] = useState<"initial" | "property_matching" | "confirming" | "creating">("initial");
  const [propertyMatches, setPropertyMatches] = useState<PropertyMatch[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<PropertyMatch | null>(null);
  const [issueDescription, setIssueDescription] = useState("");
  const [triageData, setTriageData] = useState<any>(null);
  const [uploadedMedia, setUploadedMedia] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  const { data: myCases = [], isLoading: casesLoading } = useQuery<TenantCase[]>({
    queryKey: ['/api/tenant/cases'],
    enabled: !!user
  });

  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery<TenantAppointment[]>({
    queryKey: ['/api/tenant/appointments'],
    enabled: !!user
  });

  const { data: scheduledJobs = [] } = useQuery<ScheduledJob[]>({
    queryKey: ['/api/scheduled-jobs'],
    enabled: !!user
  });

  // Filter jobs that are linked to tenant's cases and have "Pending Approval" status
  const myCaseIds = new Set(myCases.map(c => c.id));
  const pendingJobApprovals = scheduledJobs.filter(job => 
    job.status === 'Pending Approval' && job.caseId && myCaseIds.has(job.caseId)
  );

  const activeCases = myCases.filter(c => !['Resolved', 'Closed'].includes(c.status));
  const pendingApproval = appointments.filter(a => a.requiresTenantAccess && !a.tenantApproved);
  const upcomingAppointments = appointments.filter(a => 
    new Date(a.scheduledStartAt) > new Date() && a.status !== 'Cancelled'
  );

  const approveMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const res = await apiRequest('POST', `/api/appointments/${appointmentId}/tenant-approve`, {
        token: 'mock-token-for-testing'
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/appointments'] });
      toast({
        title: "Appointment Approved",
        description: "The contractor has been notified of your approval.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Approval Failed",
        description: error.message,
      });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async ({ appointmentId, reason }: { appointmentId: string; reason: string }) => {
      const res = await apiRequest('POST', `/api/appointments/${appointmentId}/tenant-decline`, {
        token: 'mock-token-for-testing',
        reason
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/appointments'] });
      setDeclineDialogOpen(false);
      setDeclineReason("");
      toast({
        title: "Appointment Declined",
        description: "The contractor has been notified.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Decline Failed",
        description: error.message,
      });
    },
  });

  const approveJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return await apiRequest('POST', `/api/scheduled-jobs/${jobId}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/cases'] });
      toast({
        title: "Schedule Approved",
        description: "The contractor has been notified of your approval.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Approval Failed",
        description: error.message,
      });
    },
  });

  const rejectJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return await apiRequest('POST', `/api/scheduled-jobs/${jobId}/reject`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/cases'] });
      toast({
        title: "Schedule Rejected",
        description: "The contractor will propose a new time.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Rejection Failed",
        description: error.message,
      });
    },
  });

  const counterProposeMutation = useMutation({
    mutationFn: async ({ jobId, availabilitySlots, reason }: { jobId: string; availabilitySlots: Array<{startAt: string, endAt: string}>; reason: string }) => {
      return await apiRequest('POST', `/api/scheduled-jobs/${jobId}/counter-propose`, {
        availabilitySlots,
        reason
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/cases'] });
      setCounterProposeDialogOpen(false);
      setJobDialogOpen(false);
      setAvailabilitySlots([{startAt: '', endAt: ''}]);
      setCounterProposeReason('');
      toast({
        title: "Counter-Proposal Submitted",
        description: "The contractor will review your proposed times.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error.message,
      });
    },
  });

  const handleApprove = (appointment: TenantAppointment) => {
    approveMutation.mutate(appointment.id);
  };

  const handleDeclineClick = (appointment: TenantAppointment) => {
    setSelectedAppointment(appointment);
    setDeclineDialogOpen(true);
  };

  const handleDeclineConfirm = () => {
    if (selectedAppointment) {
      declineMutation.mutate({
        appointmentId: selectedAppointment.id,
        reason: declineReason
      });
    }
  };

  const sendMayaMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsProcessing(true);

    try {
      if (conversationState === "initial") {
        setIssueDescription(content);
        
        const res = await apiRequest('POST', '/api/triage/chat', {
          message: content,
          step: "analyze_issue"
        });
        const data = await res.json();

        setTriageData(data.triage);
        setPropertyMatches(data.propertyMatches || []);

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
          data: {
            triage: data.triage,
            properties: data.propertyMatches
          }
        };

        setMessages(prev => [...prev, assistantMessage]);
        setConversationState("property_matching");

      } else if (conversationState === "confirming") {
        if (content.toLowerCase().includes("yes") || content.toLowerCase().includes("confirm")) {
          setConversationState("creating");
          const caseRes = await apiRequest('POST', '/api/cases', {
            title: triageData?.suggestedTitle || "Maintenance Request",
            description: issueDescription,
            status: "New",
            type: "maintenance",
            priority: triageData?.urgency || "Medium",
            category: triageData?.category || "general",
            propertyId: selectedProperty?.id,
            unitId: selectedProperty?.unitId,
            aiTriageJson: triageData,
            mediaUrls: uploadedMedia,
          });

          if (caseRes.ok) {
            const successMessage: Message = {
              id: (Date.now() + 2).toString(),
              role: "assistant",
              content: `✅ Your maintenance request has been submitted successfully${uploadedMedia.length > 0 ? ` with ${uploadedMedia.length} photo(s)` : ''}! Check the "Cases" tab below to track its progress.`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, successMessage]);
            queryClient.invalidateQueries({ queryKey: ['/api/tenant/cases'] });
            setTimeout(() => {
              setMayaOpen(false);
              setConversationState("initial");
              setUploadedMedia([]);
              setMessages([{
                id: "welcome",
                role: "assistant",
                content: "Hi! I'm Maya 👋 Tell me about your maintenance issue and I'll help you submit a request.",
                timestamp: new Date(),
              }]);
            }, 2000);
          }
        }
      }
    } catch (error) {
      console.error("Maya error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to process your request. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePropertySelect = (property: PropertyMatch) => {
    setSelectedProperty(property);
    
    const confirmMessage: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: `Perfect! I'll create a maintenance request for:\n\n📍 **${property.name}**${property.unitNumber ? `\n🏠 Unit ${property.unitNumber}` : ''}\n\n**Issue**: ${triageData?.category || 'Maintenance'}\n**Priority**: ${triageData?.urgency || 'Medium'}\n\nType "yes" to confirm and submit this request.`,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, confirmMessage]);
    setConversationState("confirming");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Resolved':
      case 'Closed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'In Progress':
        return <Wrench className="h-5 w-5 text-orange-600" />;
      case 'Scheduled':
        return <Calendar className="h-5 w-5 text-purple-600" />;
      default:
        return <Clock className="h-5 w-5 text-blue-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="My Maintenance Requests" />

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-foreground" data-testid="text-tenant-dashboard-title">
                  My Maintenance Requests
                </h1>
                <p className="text-muted-foreground mt-2">
                  Track your maintenance cases and approve service appointments
                </p>
              </div>
              <Link href="/tenant-request">
                <Button data-testid="button-new-request">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  New Request
                </Button>
              </Link>
            </div>

            {/* Maya AI Chat Widget */}
            <Card className="border-2 border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle>Maya AI Assistant</CardTitle>
                    <CardDescription>Describe your maintenance issue - feel free to add photos/videos to help clarify</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {messages.length > 1 && (
                  <div className="max-h-[300px] overflow-auto space-y-4 pb-4 border-b">
                    {messages.slice(1).map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {message.role === "assistant" && (
                          <Avatar className="h-8 w-8 mt-1">
                            <AvatarFallback className="bg-primary/10">
                              <Bot className="h-4 w-4 text-primary" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        
                        <div className={`flex flex-col gap-2 max-w-[80%] ${message.role === "user" ? "items-end" : "items-start"}`}>
                          <div
                            className={`rounded-lg px-4 py-2 ${
                              message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </div>
                          
                          {message.data?.properties && message.data.properties.length > 0 && (
                            <div className="w-full space-y-2 mt-2">
                              {message.data.properties.map((property: PropertyMatch) => (
                                <Button
                                  key={property.id}
                                  variant="outline"
                                  className="w-full justify-start text-left h-auto py-3"
                                  onClick={() => handlePropertySelect(property)}
                                  disabled={isProcessing}
                                >
                                  <div className="flex items-start gap-3 w-full">
                                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                                      {property.unitNumber ? (
                                        <Home className="h-5 w-5 text-primary" />
                                      ) : (
                                        <Building className="h-5 w-5 text-primary" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-sm">
                                        {property.name}
                                        {property.unitNumber && <span className="ml-2 text-muted-foreground">Unit {property.unitNumber}</span>}
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-1">{property.matchReason}</div>
                                    </div>
                                  </div>
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {isProcessing && (
                      <div className="flex gap-3" data-testid="indicator-processing">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10">
                            <Bot className="h-4 w-4 text-primary" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="bg-muted rounded-lg px-4 py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                )}

                <div className="space-y-2">
                  {uploadedMedia.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      📎 {uploadedMedia.length} photo{uploadedMedia.length > 1 ? 's' : ''} attached (optional)
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Describe your maintenance issue..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMayaMessage(inputValue);
                        }
                      }}
                      disabled={isProcessing}
                      className="flex-1"
                      data-testid="input-maya-message"
                    />
                    <ObjectUploader
                      maxNumberOfFiles={5}
                      maxFileSize={10485760}
                      allowedFileTypes={['image/*', 'video/*']}
                      note="📸 Upload photos or videos (optional) - Helps us better understand the issue"
                      onGetUploadParameters={async () => {
                        const res = await apiRequest('POST', '/api/object-storage/url', {});
                        const data = await res.json();
                        return {
                          method: "PUT" as const,
                          url: data.url,
                        };
                      }}
                      onComplete={(result) => {
                        const urls = result.successful.map((file: any) => file.uploadURL.split('?')[0]);
                        setUploadedMedia(prev => [...prev, ...urls]);
                        toast({
                          title: "Photos uploaded",
                          description: `${urls.length} photo(s) attached - completely optional but helpful!`,
                        });
                      }}
                      buttonClassName="shrink-0"
                    >
                      <Camera className="h-4 w-4" />
                    </ObjectUploader>
                    <Button
                      onClick={() => sendMayaMessage(inputValue)}
                      disabled={isProcessing || !inputValue.trim()}
                      data-testid="button-send-message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-cases">
                    {myCases.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your maintenance requests
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Cases</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600" data-testid="text-active-cases">
                    {activeCases.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    In progress
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
                  <Clock className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600" data-testid="text-pending-approval">
                    {pendingApproval.length + pendingJobApprovals.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Need your approval
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
                  <Calendar className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600" data-testid="text-upcoming-appointments">
                    {upcomingAppointments.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Scheduled visits
                  </p>
                </CardContent>
              </Card>
            </div>

            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="cases" data-testid="tab-cases">
                  My Requests ({myCases.length})
                </TabsTrigger>
                <TabsTrigger value="calendar" data-testid="tab-calendar">
                  Calendar
                </TabsTrigger>
                <TabsTrigger value="appointments" data-testid="tab-appointments">
                  Appointments ({appointments.length})
                </TabsTrigger>
                <TabsTrigger value="approval" data-testid="tab-approval">
                  Pending Approval ({pendingApproval.length + pendingJobApprovals.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="cases" className="mt-6">
                <div className="grid gap-4">
                  {casesLoading ? (
                    <div className="text-center py-8">Loading your cases...</div>
                  ) : myCases.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center text-muted-foreground">
                        <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No maintenance requests yet</p>
                        <Link href="/tenant-request">
                          <Button className="mt-4" data-testid="button-create-first-request">
                            Create Your First Request
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ) : (
                    myCases.map((case_) => (
                      <Card key={case_.id} className="w-full" data-testid={`card-case-${case_.id}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {getStatusIcon(case_.status)}
                              <div>
                                <CardTitle className="text-lg" data-testid={`text-case-title-${case_.id}`}>
                                  {case_.title}
                                </CardTitle>
                                <Badge variant="outline" className="text-xs font-mono mt-1" data-testid={`text-case-number-${case_.caseNumber}`}>
                                  Case: {case_.caseNumber}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={`${PRIORITY_COLORS[case_.priority as keyof typeof PRIORITY_COLORS]} border`}
                                data-testid={`badge-priority-${case_.id}`}
                              >
                                {case_.priority}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`${STATUS_COLORS[case_.status as keyof typeof STATUS_COLORS]} border`}
                                data-testid={`badge-status-${case_.id}`}
                              >
                                {case_.status}
                              </Badge>
                            </div>
                          </div>
                          <CardDescription className="text-sm text-muted-foreground mt-2">
                            {case_.category} • Reported {new Date(case_.createdAt).toLocaleDateString()}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm mb-3" data-testid={`text-case-description-${case_.id}`}>
                            {case_.description}
                          </p>

                          {(case_.buildingName || case_.roomNumber) && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              <span data-testid={`text-case-location-${case_.id}`}>
                                {case_.buildingName} {case_.roomNumber && `Room ${case_.roomNumber}`}
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="appointments" className="mt-6">
                <div className="grid gap-4">
                  {appointmentsLoading ? (
                    <div className="text-center py-8">Loading appointments...</div>
                  ) : appointments.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center text-muted-foreground">
                        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No appointments scheduled</p>
                      </CardContent>
                    </Card>
                  ) : (
                    appointments.map((appointment) => (
                      <Card key={appointment.id} data-testid={`card-appointment-${appointment.id}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Service Appointment</CardTitle>
                            <Badge variant="outline" className={appointment.tenantApproved ? "bg-green-50" : "bg-amber-50"}>
                              {appointment.tenantApproved ? 'Approved' : 'Pending Approval'}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span data-testid={`text-appointment-date-${appointment.id}`}>
                                {format(new Date(appointment.scheduledStartAt), "MMM d, yyyy")}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span data-testid={`text-appointment-time-${appointment.id}`}>
                                {format(new Date(appointment.scheduledStartAt), "h:mm a")} - 
                                {format(new Date(appointment.scheduledEndAt), "h:mm a")}
                              </span>
                            </div>
                          </div>

                          {appointment.notes && (
                            <div className="bg-muted p-3 rounded-lg text-sm">
                              <p className="font-medium mb-1">Notes:</p>
                              <p className="text-muted-foreground">{appointment.notes}</p>
                            </div>
                          )}

                          {appointment.requiresTenantAccess && !appointment.tenantApproved && (
                            <Button className="w-full" data-testid={`button-approve-${appointment.id}`}>
                              Approve Access
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="calendar" className="mt-6">
                <TenantCalendar
                  scheduledJobs={scheduledJobs}
                  myCases={myCases}
                  onJobClick={(job) => {
                    setSelectedJob(job);
                    setJobDialogOpen(true);
                  }}
                />
              </TabsContent>

              <TabsContent value="approval" className="mt-6">
                <div className="grid gap-4">
                  {/* Scheduled Jobs Pending Approval */}
                  {pendingJobApprovals.map((job) => {
                    const relatedCase = myCases.find(c => c.id === job.caseId);
                    return (
                      <Card key={job.id} className="border-l-4 border-l-yellow-400">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{job.title}</CardTitle>
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                              Pending Approval
                            </Badge>
                          </div>
                          <CardDescription>
                            Please approve or reject this proposed schedule
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {job.description && (
                            <p className="text-sm text-muted-foreground">{job.description}</p>
                          )}
                          {job.scheduledStartAt && job.scheduledEndAt && (
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span data-testid={`text-job-date-${job.id}`}>
                                  {format(new Date(job.scheduledStartAt), "MMM d, yyyy")}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span data-testid={`text-job-time-${job.id}`}>
                                  {format(new Date(job.scheduledStartAt), "h:mm a")} - 
                                  {format(new Date(job.scheduledEndAt), "h:mm a")}
                                </span>
                              </div>
                            </div>
                          )}
                          {relatedCase && (
                            <div className="text-sm text-muted-foreground">
                              Related to: <span className="font-medium">{relatedCase.title}</span>
                            </div>
                          )}

                          <div className="flex gap-2 pt-2">
                            <Button 
                              className="flex-1 bg-green-600 hover:bg-green-700"
                              onClick={() => approveJobMutation.mutate(job.id)}
                              disabled={approveJobMutation.isPending}
                              data-testid={`button-approve-job-${job.id}`}
                            >
                              <ThumbsUp className="h-4 w-4 mr-2" />
                              Approve Schedule
                            </Button>
                            <Button 
                              variant="destructive"
                              className="flex-1"
                              onClick={() => rejectJobMutation.mutate(job.id)}
                              disabled={rejectJobMutation.isPending}
                              data-testid={`button-reject-job-${job.id}`}
                            >
                              <ThumbsDown className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Appointments Pending Approval */}
                  {pendingApproval.length === 0 && pendingJobApprovals.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center text-muted-foreground">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No schedules pending approval</p>
                      </CardContent>
                    </Card>
                  ) : (
                    pendingApproval.map((appointment) => (
                      <Card key={appointment.id} className="border-l-4 border-l-blue-400">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">Access Approval Required</CardTitle>
                          <CardDescription>
                            A contractor needs access to your unit to complete maintenance
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {format(new Date(appointment.scheduledStartAt), "MMM d, yyyy")}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {format(new Date(appointment.scheduledStartAt), "h:mm a")} - 
                                {format(new Date(appointment.scheduledEndAt), "h:mm a")}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button 
                              className="flex-1 bg-green-600 hover:bg-green-700"
                              onClick={() => handleApprove(appointment)}
                              disabled={approveMutation.isPending}
                              data-testid={`button-approve-${appointment.id}`}
                            >
                              <ThumbsUp className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button 
                              variant="destructive"
                              className="flex-1"
                              onClick={() => handleDeclineClick(appointment)}
                              disabled={declineMutation.isPending}
                              data-testid={`button-decline-${appointment.id}`}
                            >
                              <ThumbsDown className="h-4 w-4 mr-2" />
                              Decline
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {user?.id && (
        <LiveNotification
          userRole="tenant"
          userId={user.id}
        />
      )}

      <Dialog open={jobDialogOpen} onOpenChange={setJobDialogOpen}>
        <DialogContent data-testid="dialog-job-details">
          <DialogHeader>
            <DialogTitle>{selectedJob?.title}</DialogTitle>
            <DialogDescription>
              {selectedJob?.status === 'Pending Approval' ? 'Please review and approve or reject this proposed schedule' : 'Scheduled maintenance details'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedJob?.description && (
              <div>
                <p className="text-sm font-medium mb-1">Description</p>
                <p className="text-sm text-muted-foreground">{selectedJob.description}</p>
              </div>
            )}
            {selectedJob?.scheduledStartAt && selectedJob?.scheduledEndAt && (
              <div>
                <p className="text-sm font-medium mb-1">Proposed Time</p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(selectedJob.scheduledStartAt), "MMM d, yyyy")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {format(new Date(selectedJob.scheduledStartAt), "h:mm a")} - 
                      {format(new Date(selectedJob.scheduledEndAt), "h:mm a")}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div>
              <p className="text-sm font-medium mb-1">Status</p>
              <Badge variant="outline" className={selectedJob?.status === 'Pending Approval' ? 'bg-yellow-50 text-yellow-700 border-yellow-300' : 'bg-green-50 text-green-700 border-green-300'}>
                {selectedJob?.status}
              </Badge>
            </div>
          </div>
          {selectedJob?.status === 'Pending Approval' && (
            <DialogFooter className="sm:space-x-2">
              <Button 
                variant="outline"
                onClick={() => {
                  setJobDialogOpen(false);
                  setCounterProposeDialogOpen(true);
                }}
                data-testid="button-counter-propose"
              >
                Counter-Propose Times
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  if (selectedJob) {
                    rejectJobMutation.mutate(selectedJob.id);
                    setJobDialogOpen(false);
                  }
                }}
                disabled={rejectJobMutation.isPending}
                data-testid="button-reject-schedule"
              >
                <ThumbsDown className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  if (selectedJob) {
                    approveJobMutation.mutate(selectedJob.id);
                    setJobDialogOpen(false);
                  }
                }}
                disabled={approveJobMutation.isPending}
                data-testid="button-approve-schedule"
              >
                <ThumbsUp className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent data-testid="dialog-decline">
          <DialogHeader>
            <DialogTitle>Decline Appointment</DialogTitle>
            <DialogDescription>
              Please provide a reason for declining this appointment. This will help us reschedule at a better time.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              data-testid="input-decline-reason"
              placeholder="e.g., I won't be available at this time"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeclineDialogOpen(false)}
              data-testid="button-cancel-decline"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeclineConfirm}
              disabled={declineMutation.isPending}
              data-testid="button-confirm-decline"
            >
              Confirm Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={counterProposeDialogOpen} onOpenChange={setCounterProposeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-counter-propose">
          <DialogHeader>
            <DialogTitle>Counter-Propose Alternative Times</DialogTitle>
            <DialogDescription>
              Suggest times when you're available for this maintenance visit. You can propose multiple time slots.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {availabilitySlots.map((slot, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Start Time</label>
                        <Input
                          type="datetime-local"
                          value={slot.startAt}
                          onChange={(e) => {
                            const newSlots = [...availabilitySlots];
                            newSlots[index].startAt = e.target.value;
                            setAvailabilitySlots(newSlots);
                          }}
                          data-testid={`input-start-time-${index}`}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">End Time</label>
                        <Input
                          type="datetime-local"
                          value={slot.endAt}
                          onChange={(e) => {
                            const newSlots = [...availabilitySlots];
                            newSlots[index].endAt = e.target.value;
                            setAvailabilitySlots(newSlots);
                          }}
                          data-testid={`input-end-time-${index}`}
                        />
                      </div>
                    </div>
                    {availabilitySlots.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-8"
                        onClick={() => {
                          setAvailabilitySlots(availabilitySlots.filter((_, i) => i !== index));
                        }}
                        data-testid={`button-remove-slot-${index}`}
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setAvailabilitySlots([...availabilitySlots, {startAt: '', endAt: ''}]);
              }}
              data-testid="button-add-slot"
            >
              + Add Another Time Slot
            </Button>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Reason (Optional)</label>
              <Input
                placeholder="e.g., I'm available in the mornings this week"
                value={counterProposeReason}
                onChange={(e) => setCounterProposeReason(e.target.value)}
                data-testid="input-counter-propose-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setCounterProposeDialogOpen(false);
                setAvailabilitySlots([{startAt: '', endAt: ''}]);
                setCounterProposeReason('');
              }}
              data-testid="button-cancel-counter-propose"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedJob && availabilitySlots.some(slot => slot.startAt && slot.endAt)) {
                  const validSlots = availabilitySlots.filter(slot => slot.startAt && slot.endAt);
                  counterProposeMutation.mutate({
                    jobId: selectedJob.id,
                    availabilitySlots: validSlots,
                    reason: counterProposeReason
                  });
                }
              }}
              disabled={counterProposeMutation.isPending || !availabilitySlots.some(slot => slot.startAt && slot.endAt)}
              data-testid="button-submit-counter-propose"
            >
              {counterProposeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Proposal'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
