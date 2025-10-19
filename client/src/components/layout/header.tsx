import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import QuickAddModal from "@/components/modals/quick-add-modal";
import ReminderForm from "@/components/forms/reminder-form";
import NotificationDropdown from "@/components/notifications/notification-dropdown";
import ReminderDropdown from "@/components/reminders/reminder-dropdown";
import { RoleSwitcher } from "@/components/role-switcher";
import { useAuth } from "@/hooks/useAuth";
import { Search, Plus } from "lucide-react";
import type { Property, OwnershipEntity, Unit } from "@shared/schema";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
    <>
      <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6" data-testid="header">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-header-title">{title}</h1>
          <span className="text-sm text-muted-foreground" data-testid="text-welcome">
            Welcome back, {user?.firstName || "User"}
          </span>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Role Switcher */}
          {user && <RoleSwitcher />}
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Search properties, tenants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-64"
              data-testid="input-search"
            />
          </div>
          
          {/* Notifications Bell */}
          <NotificationDropdown />
          
          {/* Reminders Calendar */}
          <ReminderDropdown onCreateReminder={() => setShowReminderForm(true)} />
          
          {/* Quick Add */}
          <Button onClick={() => setShowQuickAdd(true)} data-testid="button-quick-add">
            <Plus className="h-4 w-4 mr-2" />
            Quick Add
          </Button>
        </div>
      </header>

      <QuickAddModal 
        open={showQuickAdd} 
        onOpenChange={setShowQuickAdd}
        onReminderClick={() => {
          setShowQuickAdd(false);
          setShowReminderForm(true);
        }}
      />

      {/* Reminder Dialog */}
      <Dialog open={showReminderForm} onOpenChange={setShowReminderForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Reminder</DialogTitle>
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
    </>
  );
}
