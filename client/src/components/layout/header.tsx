import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import QuickAddModal from "@/components/modals/quick-add-modal";
import ReminderForm from "@/components/forms/reminder-form";
import NotificationDropdown from "@/components/notifications/notification-dropdown";
import ReminderDropdown from "@/components/reminders/reminder-dropdown";
import { RoleSwitcher } from "@/components/role-switcher";
import { useAuth } from "@/hooks/useAuth";
import { useDevMode } from "@/contexts/DevModeContext";
import { useLocation } from "wouter";
import { Search, Plus, Settings, DollarSign, Building, Wrench, Users, Calendar, Home, Star, Command, TrendingUp, Inbox } from "lucide-react";
import type { Property, OwnershipEntity, Unit } from "@shared/schema";

interface HeaderProps {
  title: string;
}

const AVAILABLE_SHORTCUTS = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, href: '/' },
  { id: 'inbox', label: 'Inbox', icon: Inbox, href: '/inbox' },
  { id: 'portfolio', label: 'Portfolio', icon: Building, href: '/portfolio' },
  { id: 'tenants', label: 'Tenants', icon: Users, href: '/tenants' },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench, href: '/maintenance' },
  { id: 'predictive-insights', label: 'Predictive Insights', icon: TrendingUp, href: '/predictive-insights' },
  { id: 'financial', label: 'Financial', icon: DollarSign, href: '/financial' },
  { id: 'reminders', label: 'Reminders', icon: Calendar, href: '/reminders' },
];

export default function Header({ title }: HeaderProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { devModeEnabled, setDevModeEnabled } = useDevMode();
  const [, setLocation] = useLocation();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedShortcuts, setPinnedShortcuts] = useState<string[]>(() => {
    const saved = localStorage.getItem('pinnedShortcuts');
    return saved ? JSON.parse(saved) : ['dashboard', 'financial'];
  });

  // Save pinned shortcuts
  useEffect(() => {
    localStorage.setItem('pinnedShortcuts', JSON.stringify(pinnedShortcuts));
  }, [pinnedShortcuts]);

  // Command palette keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleShortcut = (shortcutId: string) => {
    setPinnedShortcuts(prev => 
      prev.includes(shortcutId) 
        ? prev.filter(id => id !== shortcutId)
        : [...prev, shortcutId]
    );
  };

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

  const pinnedShortcutItems = AVAILABLE_SHORTCUTS.filter(s => pinnedShortcuts.includes(s.id));

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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid="button-shortcuts-menu">
                    <Star className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="px-2 py-1.5 text-sm font-semibold">Quick Access</div>
                  <DropdownMenuSeparator />
                  {AVAILABLE_SHORTCUTS.map(shortcut => (
                    <DropdownMenuItem
                      key={shortcut.id}
                      onClick={() => toggleShortcut(shortcut.id)}
                      className="flex items-center justify-between"
                      data-testid={`toggle-shortcut-${shortcut.id}`}
                    >
                      <span>{shortcut.label}</span>
                      {pinnedShortcuts.includes(shortcut.id) && (
                        <Star className="h-3 w-3 fill-current" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Role Switcher */}
          {user && <RoleSwitcher />}
          
          {/* Command Palette Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCommandPalette(true)}
                  data-testid="button-command-palette"
                >
                  <Command className="h-4 w-4 mr-2" />
                  <span className="text-xs text-muted-foreground">⌘K</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Open Command Palette</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Notifications Bell */}
          <NotificationDropdown />
          
          {/* Reminders Calendar */}
          <ReminderDropdown onCreateReminder={() => setShowReminderForm(true)} />
          
          {/* Settings Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-settings">
                <Settings className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-sm font-semibold">Settings</div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation('/channel-settings')} data-testid="menu-channel-settings">
                Channel Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation('/approval-settings')} data-testid="menu-approval-settings">
                Approval Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation('/categories')} data-testid="menu-categories">
                Categories
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setDevModeEnabled(!devModeEnabled)}
                className="flex items-center justify-between"
                data-testid="menu-dev-mode"
              >
                <span>Dev Mode</span>
                <div className={`w-8 h-4 rounded-full transition-colors ${devModeEnabled ? 'bg-primary' : 'bg-muted'}`}>
                  <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-transform ${devModeEnabled ? 'ml-4' : 'ml-0.5'}`} />
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
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

      {/* Command Palette Dialog */}
      <Dialog open={showCommandPalette} onOpenChange={setShowCommandPalette}>
        <DialogContent className="max-w-2xl p-0">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search pages, actions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2"
                data-testid="input-command-search"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {AVAILABLE_SHORTCUTS
              .filter(s => 
                searchQuery === '' || 
                s.label.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map(shortcut => {
                const Icon = shortcut.icon;
                return (
                  <button
                    key={shortcut.id}
                    onClick={() => {
                      setLocation(shortcut.href);
                      setShowCommandPalette(false);
                      setSearchQuery('');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent rounded-lg transition-colors text-left"
                    data-testid={`command-${shortcut.id}`}
                  >
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{shortcut.label}</span>
                    {pinnedShortcuts.includes(shortcut.id) && (
                      <Star className="h-3 w-3 ml-auto fill-current text-yellow-500" />
                    )}
                  </button>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
