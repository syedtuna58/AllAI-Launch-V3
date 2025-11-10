import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import QuickAddModal from "@/components/modals/quick-add-modal";
import MayaQuickPromptsModal from "@/components/modals/maya-quick-prompts-modal";
import ReminderForm from "@/components/forms/reminder-form";
import NotificationDropdown from "@/components/notifications/notification-dropdown";
import ReminderDropdown from "@/components/reminders/reminder-dropdown";
import { RoleSwitcher } from "@/components/role-switcher";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Plus, Bot, DollarSign, TrendingUp, Inbox, Receipt, Calculator, MessageSquare, Clock } from "lucide-react";
import type { Property, OwnershipEntity, Unit } from "@shared/schema";

interface HeaderProps {
  title: string;
}

const AVAILABLE_SHORTCUTS = [
  { id: 'predictive-insights', label: 'Predictive Insights', icon: TrendingUp, href: '/predictive-insights' },
  { id: 'expenses', label: 'Expenses', icon: Receipt, href: '/financial?tab=expenses' },
  { id: 'revenue', label: 'Revenue', icon: DollarSign, href: '/financial?tab=revenue' },
  { id: 'taxes', label: 'Taxes', icon: Calculator, href: '/financial?tab=tax' },
  { id: 'needs-reply', label: 'Needs Reply', icon: MessageSquare, href: '/inbox?filter=unresponded' },
  { id: 'due-soon', label: 'Due Soon', icon: Clock, href: '/reminders?filter=Overdue' },
];

export default function Header({ title }: HeaderProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [editingReminder, setEditingReminder] = useState<any>(null);
  const [showMayaPrompts, setShowMayaPrompts] = useState(false);
  const [pinnedShortcuts, setPinnedShortcuts] = useState<string[]>(() => {
    const saved = localStorage.getItem('pinnedShortcuts');
    return saved ? JSON.parse(saved) : ['needs-reply'];
  });

  // Save pinned shortcuts
  useEffect(() => {
    localStorage.setItem('pinnedShortcuts', JSON.stringify(pinnedShortcuts));
  }, [pinnedShortcuts]);

  // Maya keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowMayaPrompts(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const pinnedShortcutItems = AVAILABLE_SHORTCUTS.filter(s => 
    pinnedShortcuts.includes(s.id) && 
    s.id !== 'predictive-insights' && 
    s.id !== 'due-soon'
  );

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
          {/* Quick Access Shortcuts */}
          {pinnedShortcutItems.length > 0 && (
            <div className="flex items-center gap-1 px-3 py-1 bg-muted/50 rounded-lg">
              <TooltipProvider>
                {pinnedShortcutItems.map(shortcut => {
                  const Icon = shortcut.icon;
                  return (
                    <Tooltip key={shortcut.id}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setLocation(shortcut.href)}
                          data-testid={`shortcut-${shortcut.id}`}
                        >
                          <Icon className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{shortcut.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </TooltipProvider>
            </div>
          )}
          
          {/* Ask Maya Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-300"
                  onClick={() => setShowMayaPrompts(true)}
                  data-testid="button-ask-maya"
                >
                  <Bot className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Ask Maya (⌘K)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Role Switcher */}
          {user && <RoleSwitcher />}
          
          {/* Notifications Bell */}
          <NotificationDropdown />
          
          {/* Reminders Calendar */}
          <ReminderDropdown 
            onCreateReminder={() => setShowReminderForm(true)}
            onEditReminder={(reminder) => {
              setEditingReminder(reminder);
              setShowReminderForm(true);
            }}
          />
          
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

      <MayaQuickPromptsModal 
        open={showMayaPrompts}
        onOpenChange={setShowMayaPrompts}
      />

      {/* Reminder Dialog */}
      <Dialog open={showReminderForm} onOpenChange={(open) => {
        setShowReminderForm(open);
        if (!open) setEditingReminder(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingReminder ? 'Edit Reminder' : 'Create New Reminder'}</DialogTitle>
          </DialogHeader>
          <ReminderForm 
            reminder={editingReminder}
            properties={properties || []}
            entities={entities || []}
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
    </>
  );
}
