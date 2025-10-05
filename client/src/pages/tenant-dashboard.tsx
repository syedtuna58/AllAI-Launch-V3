import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, AlertTriangle, CheckCircle, MapPin, Wrench } from "lucide-react";
import { LiveNotification } from "@/components/ui/live-notification";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import { Link } from "wouter";
import { format } from "date-fns";

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
  const [selectedTab, setSelectedTab] = useState("cases");

  const { data: myCases = [], isLoading: casesLoading } = useQuery<TenantCase[]>({
    queryKey: ['/api/tenant/cases'],
    enabled: !!user
  });

  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery<TenantAppointment[]>({
    queryKey: ['/api/tenant/appointments'],
    enabled: !!user
  });

  const activeCases = myCases.filter(c => !['Resolved', 'Closed'].includes(c.status));
  const pendingApproval = appointments.filter(a => a.requiresTenantAccess && !a.tenantApproved);
  const upcomingAppointments = appointments.filter(a => 
    new Date(a.scheduledStartAt) > new Date() && a.status !== 'Cancelled'
  );

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
                    {pendingApproval.length}
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
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="cases" data-testid="tab-cases">
                  My Cases ({myCases.length})
                </TabsTrigger>
                <TabsTrigger value="appointments" data-testid="tab-appointments">
                  Appointments ({appointments.length})
                </TabsTrigger>
                <TabsTrigger value="approval" data-testid="tab-approval">
                  Pending Approval ({pendingApproval.length})
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

              <TabsContent value="approval" className="mt-6">
                <div className="grid gap-4">
                  {pendingApproval.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center text-muted-foreground">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No appointments pending approval</p>
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

                          <Button className="w-full bg-blue-600 hover:bg-blue-700">
                            Approve Access
                          </Button>
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
    </div>
  );
}
