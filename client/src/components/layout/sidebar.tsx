import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useDevMode } from "@/contexts/DevModeContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import UserProfileForm from "@/components/forms/user-profile-form";
import { Building, Home, Users, Wrench, DollarSign, User, LogOut, ChevronDown, ClipboardList, MessageSquare, Clock, TestTube2, MessageCircle, Inbox, TrendingUp, Settings, Calendar, Bell } from "lucide-react";

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const currentRole = user?.primaryRole;
  const { devModeEnabled, setDevModeEnabled } = useDevMode();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  const adminNavigation = [
    { name: "Dashboard", href: "/", icon: Home },
    { name: "Inbox", href: "/inbox", icon: Inbox },
    { name: "Portfolio", href: "/portfolio", icon: Building },
    { name: "Tenants", href: "/tenants", icon: Users },
    { name: "Maintenance", href: "/maintenance", icon: Wrench },
    { name: "Financial", href: "/financial", icon: DollarSign },
    { name: "Calendar", href: "/admin-calendar", icon: Calendar },
    { name: "Reminders", href: "/reminders", icon: Clock },
  ];

  const superAdminNavigation = [
    { name: "Dashboard", href: "/admin-dashboard", icon: Home },
    { name: "Inbox", href: "/inbox", icon: Inbox },
  ];

  const devToolsNavigation = [
    { name: "AI Prompt Tester", href: "/prompt-tester", icon: TestTube2 },
    { name: "Maya Chat Tester", href: "/maya-tester", icon: MessageCircle },
  ];

  const contractorNavigation = [
    { name: "Dashboard", href: "/contractor-dashboard", icon: Home },
    { name: "Inbox", href: "/inbox", icon: Inbox },
    { name: "My Jobs", href: "/maintenance", icon: Wrench },
    { name: "Calendar", href: "/contractor-schedule", icon: Calendar },
    { name: "Reminders", href: "/reminders", icon: Clock },
  ];

  const tenantNavigation = [
    { name: "Dashboard", href: "/tenant-dashboard", icon: Home },
    { name: "Requests & Calendar", href: "/maintenance", icon: Wrench },
    { name: "Reminders", href: "/reminders", icon: Bell },
  ];

  let navigation = currentRole === 'platform_super_admin'
    ? superAdminNavigation
    : currentRole === 'admin' || currentRole === 'org_admin' || currentRole === 'property_owner'
    ? adminNavigation 
    : currentRole === 'contractor'
    ? contractorNavigation
    : tenantNavigation;

  // Add dev tools if dev mode is enabled (admin only)
  if (currentRole === 'admin' && devModeEnabled) {
    navigation = [...navigation, ...devToolsNavigation];
  }

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col" data-testid="sidebar">
      {/* Logo/Header */}
      <div className="p-6 border-b border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full p-0 h-auto justify-start hover:bg-muted/50" data-testid="button-brand-menu">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Building className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-foreground">AllAI Property</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => setShowProfileModal(true)} data-testid="menu-edit-profile">
              <User className="h-4 w-4 mr-2" />
              Edit Profile
            </DropdownMenuItem>
            {currentRole !== 'platform_super_admin' && (
              <>
                <DropdownMenuItem 
                  onSelect={(e) => {
                    e.preventDefault();
                    setShowSettingsMenu(!showSettingsMenu);
                  }}
                  data-testid="menu-settings"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                  <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showSettingsMenu ? 'rotate-180' : ''}`} />
                </DropdownMenuItem>
                {showSettingsMenu && (
                  <>
                    <DropdownMenuItem onClick={() => setLocation('/channel-settings')} className="pl-8" data-testid="menu-channel-settings">
                      Channel Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation('/approval-settings')} className="pl-8" data-testid="menu-approval-settings">
                      Approval Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation('/categories')} className="pl-8" data-testid="menu-categories">
                      Categories
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setDevModeEnabled(!devModeEnabled)}
                      className="pl-8 flex items-center justify-between"
                      data-testid="menu-dev-mode"
                    >
                      <span>Dev Mode</span>
                      <div className={`w-8 h-4 rounded-full transition-colors ${devModeEnabled ? 'bg-primary' : 'bg-muted'}`}>
                        <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-transform ${devModeEnabled ? 'ml-4' : 'ml-0.5'}`} />
                      </div>
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="menu-sign-out">
              <a href="/api/logout" className="flex items-center">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Button
              key={item.name}
              variant={active ? "default" : "ghost"}
              className={`w-full justify-start ${active ? "sidebar-active" : ""}`}
              asChild
              data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <Link href={item.href} className="flex items-center space-x-3">
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            </Button>
          );
        })}
      </nav>
      
      {/* User Menu */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center overflow-hidden">
            {user?.profileImageUrl ? (
              <img 
                src={user.profileImageUrl} 
                alt="Profile" 
                className="w-full h-full object-cover"
                data-testid="img-user-avatar"
              />
            ) : (
              <div className="w-full h-full bg-muted rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground">
                  {user?.firstName?.charAt(0) || user?.email?.charAt(0) || "U"}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate" data-testid="text-user-name">
              {user?.firstName && user?.lastName 
                ? `${user.firstName} ${user.lastName}`
                : user?.email || "User"
              }
            </p>
            <p className="text-xs text-muted-foreground truncate" data-testid="text-user-email">
              {user?.email || ""}
            </p>
          </div>
        </div>
      </div>

      {/* Profile Edit Modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          {user && (
            <UserProfileForm
              user={user}
              onSuccess={() => setShowProfileModal(false)}
              onCancel={() => setShowProfileModal(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
