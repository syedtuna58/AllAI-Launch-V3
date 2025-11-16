import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building, DollarSign, AlertTriangle, Bell, Check, Clock, X, Receipt, Users, Wrench, Bot, TrendingUp, Target } from "lucide-react";
import { format } from "date-fns";
import type { SmartCase, Reminder, Property, OwnershipEntity, Unit } from "@shared/schema";
import PropertyAssistant from "@/components/ai/property-assistant";
import CasesWidget from "@/components/widgets/cases-widget";
import RemindersWidget from "@/components/widgets/reminders-widget";
import NotificationsWidget from "@/components/widgets/notifications-widget";
import ReminderForm from "@/components/forms/reminder-form";
import { apiRequest, queryClient } from "@/lib/queryClient";

type DashboardStats = {
  totalProperties: number;
  monthlyRevenue: number;
  openCases: number;
  dueReminders: number;
};

type RentCollectionStatus = {
  collected: number;
  total: number;
  percentage: number;
  items: Array<{
    id: string;
    property: string;
    tenant: string;
    amount: number;
    status: "paid" | "due" | "overdue";
    dueDate: Date;
  }>;
};

// Role-based visibility helper functions
function canViewTenants(userRole: string | undefined): boolean {
  return userRole === "platform_super_admin" || userRole === "org_admin";
}

function canViewEntities(userRole: string | undefined): boolean {
  return userRole === "platform_super_admin" || userRole === "org_admin";
}

function canViewFinancials(userRole: string | undefined): boolean {
  // All dashboard users can see their own financials
  return true;
}

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [editingReminder, setEditingReminder] = useState<any>(null);

  // Redirect contractors and tenants to their dedicated dashboards
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (user.primaryRole === "contractor") {
        setLocation("/contractor-dashboard");
        return;
      }
      if (user.primaryRole === "tenant") {
        setLocation("/tenant-dashboard");
        return;
      }
    }
  }, [user, isLoading, isAuthenticated, setLocation]);

  // Redirect to home if not authenticated
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

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    retry: false,
  });

  const { data: rentCollection, isLoading: rentLoading } = useQuery<RentCollectionStatus>({
    queryKey: ["/api/dashboard/rent-collection"],
    retry: false,
    enabled: canViewTenants(user?.primaryRole),
  });

  const { data: properties } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    retry: false,
  });

  const { data: entities } = useQuery<OwnershipEntity[]>({
    queryKey: ["/api/entities"],
    retry: false,
    enabled: canViewEntities(user?.primaryRole),
  });

  const { data: units } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    retry: false,
  });

  const { data: insights = [] } = useQuery({
    queryKey: ['/api/predictive-insights'],
    retry: false,
  });

  const createReminderMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/reminders", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      setShowReminderForm(false);
      toast({
        title: "Success",
        description: "Reminder created successfully",
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
        description: "Failed to create reminder",
        variant: "destructive",
      });
    },
  });

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background" data-testid="page-dashboard">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Dashboard" />
        
        <main className="flex-1 overflow-auto p-6 bg-muted/30">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card data-testid="card-total-properties">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Total Properties</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-total-properties">
                      {statsLoading ? "..." : stats?.totalProperties || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Building className="text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card data-testid="card-monthly-revenue">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Monthly Revenue</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-monthly-revenue">
                      {statsLoading ? "..." : `$${stats?.monthlyRevenue?.toLocaleString() || 0}`}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card data-testid="card-open-cases">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Open Cases</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-open-cases">
                      {statsLoading ? "..." : stats?.openCases || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card data-testid="card-due-reminders">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Due Reminders</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-due-reminders">
                      {statsLoading ? "..." : stats?.dueReminders || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <Bell className="text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Property Assistant */}
          <PropertyAssistant 
            context="dashboard"
            exampleQuestions={[
              "How are my properties performing overall?",
              "What needs my immediate attention?",
              "Any red flags in my portfolio?",
              "Which property is my best performer?"
            ]}
          />

          {/* Predictive Insights Summary */}
          {insights.length > 0 && (
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950" data-testid="card-predictive-insights">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    <CardTitle>Predictive Insights</CardTitle>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => window.location.href = '/predictive-insights'} data-testid="button-view-all-insights">
                    View All
                  </Button>
                </div>
                <CardDescription>
                  AI-powered predictions based on historical data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {insights.slice(0, 3).map((insight: any) => (
                    <div key={insight.id} className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg">
                      <Target className="h-4 w-4 mt-1 text-blue-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{insight.prediction}</p>
                        {insight.predictedDate && (
                          <p className="text-xs text-muted-foreground">
                            Expected: {format(new Date(insight.predictedDate), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(parseFloat(insight.confidence || 0) * 100)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Dashboard Grid - New Layout: Cases Left, Reminders/Notifications Right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-32rem)]">
            
            {/* Left Half - Cases with Filtering (Scrollable) */}
            <div className="h-full">
              <CasesWidget />
            </div>

            {/* Right Half - Reminders (Top) and Notifications (Bottom) */}
            <div className="grid grid-rows-2 gap-6 h-full">
              <RemindersWidget 
                onCreateReminder={() => setShowReminderForm(true)}
                onEditReminder={(reminder) => {
                  setEditingReminder(reminder);
                  setShowReminderForm(true);
                }}
              />
              <NotificationsWidget />
            </div>
          </div>
        </main>
      </div>

      {/* Reminder Form Dialog */}
      <Dialog open={showReminderForm} onOpenChange={(open) => {
        setShowReminderForm(open);
        if (!open) setEditingReminder(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingReminder ? 'Edit Reminder' : 'Create Reminder'}</DialogTitle>
          </DialogHeader>
          <ReminderForm 
            reminder={editingReminder}
            properties={properties || []}
            entities={canViewEntities(user?.primaryRole) ? (entities || []) : []}
            units={units || []}
            onSubmit={(data) => createReminderMutation.mutate(data)}
            onCancel={() => {
              setShowReminderForm(false);
              setEditingReminder(null);
            }}
            isLoading={createReminderMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
