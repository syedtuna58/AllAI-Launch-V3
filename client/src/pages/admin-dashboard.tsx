import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Clock, Wrench, Bell, Calendar } from "lucide-react";
import { LiveNotification } from "@/components/ui/live-notification";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import CasesWidget from "@/components/widgets/cases-widget";
import RemindersWidget from "@/components/widgets/reminders-widget";
import NotificationsWidget from "@/components/widgets/notifications-widget";
import ReminderForm from "@/components/forms/reminder-form";
import type { SmartCase, Property, OwnershipEntity, Unit, Reminder, Notification } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showReminderForm, setShowReminderForm] = useState(false);

  const { data: allCases = [] } = useQuery<SmartCase[]>({
    queryKey: ['/api/cases'],
    enabled: true
  });

  const { data: properties } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    retry: false,
  });

  const { data: entities } = useQuery<OwnershipEntity[]>({
    queryKey: ["/api/entities"],
    retry: false,
  });

  const { data: units } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    retry: false,
  });

  const { data: reminders } = useQuery<Reminder[]>({
    queryKey: ["/api/reminders"],
    retry: false,
  });

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    retry: false,
  });

  const unassignedCases = allCases.filter(c => !c.assignedContractorId);
  const urgentCases = allCases.filter(c => c.priority && ['High', 'Urgent'].includes(c.priority));
  const newCases = allCases.filter(c => c.status === 'New');
  
  const now = new Date();
  const overdueReminders = reminders?.filter(r => 
    r.dueAt && new Date(r.dueAt) <= now && !r.completedAt
  ) || [];
  
  const unreadNotifications = notifications?.filter(n => !n.isRead) || [];

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

  return (
    <div className="min-h-screen bg-background flex" data-testid="page-admin-dashboard">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="Admin Dashboard" />

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-foreground" data-testid="text-admin-dashboard-title">
                  Admin Dashboard
                </h1>
                <p className="text-muted-foreground mt-2">
                  Monitor and manage maintenance cases, contractors, and system performance
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card 
                className="cursor-pointer hover:bg-accent transition-colors active:scale-[0.98]"
                onClick={() => setLocation('/maintenance')}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-cases">
                    {allCases.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Active maintenance cases
                  </p>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:bg-accent transition-colors active:scale-[0.98]"
                onClick={() => setLocation('/maintenance')}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unassigned</CardTitle>
                  <Wrench className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600" data-testid="text-unassigned-cases">
                    {unassignedCases.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Need contractor assignment
                  </p>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:bg-accent transition-colors active:scale-[0.98]"
                onClick={() => setLocation('/reminders')}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Reminders</CardTitle>
                  <Calendar className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600" data-testid="text-reminders">
                    {overdueReminders.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Overdue items
                  </p>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:bg-accent transition-colors active:scale-[0.98]"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Notifications</CardTitle>
                  <Bell className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600" data-testid="text-notifications">
                    {unreadNotifications.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Unread messages
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-[calc(100vh-28rem)] max-h-[700px]">
                <CasesWidget />
              </div>

              <div className="flex flex-col gap-6 h-[calc(100vh-28rem)] max-h-[700px]">
                <div className="flex-1 min-h-0 overflow-hidden">
                  <RemindersWidget onCreateReminder={() => setShowReminderForm(true)} />
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <NotificationsWidget />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {user && (
        <LiveNotification
          userRole="admin"
          userId={user.id}
        />
      )}

      <Dialog open={showReminderForm} onOpenChange={setShowReminderForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Reminder</DialogTitle>
          </DialogHeader>
          <ReminderForm 
            properties={properties || []}
            entities={entities || []}
            units={units || []}
            onSubmit={(data) => createReminderMutation.mutate(data)}
            onCancel={() => setShowReminderForm(false)}
            isLoading={createReminderMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
