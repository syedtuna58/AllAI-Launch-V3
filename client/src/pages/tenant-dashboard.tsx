import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Clock, AlertTriangle, CheckCircle, Wrench, ThumbsUp, ThumbsDown, Bot, Send, Home, Building, Camera, Loader2 } from "lucide-react";
import { LiveNotification } from "@/components/ui/live-notification";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import { Link, useLocation } from "wouter";
import { ObjectUploader } from "@/components/ObjectUploader";
import RemindersWidget from "@/components/widgets/reminders-widget";
import NotificationsWidget from "@/components/widgets/notifications-widget";

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
  const [mayaOpen, setMayaOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  const { data: myCases = [], isLoading: casesLoading } = useQuery<TenantCase[]>({
    queryKey: ['/api/tenant/cases'],
    enabled: !!user
  });

  const { data: appointments = [] } = useQuery<TenantAppointment[]>({
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
            properties: data.propertyMatches,
            tenantUnitInfo: data.tenantUnitInfo
          }
        };

        setMessages(prev => [...prev, assistantMessage]);
        
        // For tenants with auto-filled unit info, go straight to confirming
        if (data.tenantUnitInfo) {
          setConversationState("tenant_confirming");
        } else {
          setConversationState("property_matching");
        }

      } else if (conversationState === "confirming" || conversationState === "tenant_confirming") {
        if (content.toLowerCase().includes("yes") || content.toLowerCase().includes("confirm")) {
          setConversationState("creating");
          const caseRes = await apiRequest('POST', '/api/tenant/cases', {
            title: triageData?.suggestedTitle || "Maintenance Request",
            description: issueDescription,
            priority: triageData?.urgency || "Normal",
            category: triageData?.category || "general",
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

  const handleTenantConfirm = async () => {
    setIsProcessing(true);
    try {
      const caseRes = await apiRequest('POST', '/api/tenant/cases', {
        title: triageData?.suggestedTitle || "Maintenance Request",
        description: issueDescription,
        priority: triageData?.urgency || "Normal",
        category: triageData?.category || "general",
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
    } catch (error) {
      console.error("Create case error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create maintenance request. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
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
                  Dashboard
                </h1>
                <p className="text-muted-foreground mt-2">
                  Overview of your maintenance requests and reminders
                </p>
              </div>
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
                          
                          {message.data?.tenantUnitInfo ? (
                            <div className="w-full mt-2">
                              <Button
                                variant="default"
                                className="w-full"
                                onClick={handleTenantConfirm}
                                disabled={isProcessing}
                                data-testid="button-confirm-tenant-unit"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Yes, that's correct
                              </Button>
                            </div>
                          ) : message.data?.properties && message.data.properties.length > 0 ? (
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
                          ) : null}
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

            {/* Reminders and Notifications */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <RemindersWidget />
              <NotificationsWidget />
            </div>
          </div>
        </main>
      </div>

      {user?.id && (
        <LiveNotification
          userRole="tenant"
          userId={user.id}
        />
      )}
    </div>
  );
}
