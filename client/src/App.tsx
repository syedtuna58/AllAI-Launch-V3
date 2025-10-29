import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { RoleProvider, useRole } from "@/contexts/RoleContext";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Properties from "@/pages/properties";
import Entities from "@/pages/entities";
import EntityPerformance from "@/pages/entity-performance";
import PropertyPerformance from "@/pages/property-performance";
import Tenants from "@/pages/tenants";
import Maintenance from "@/pages/maintenance";
import TenantRequest from "@/pages/tenant-request";
import ContractorDashboard from "@/pages/contractor-dashboard";
import ContractorAvailability from "@/pages/contractor-availability";
import AdminDashboard from "@/pages/admin-dashboard";
import TenantDashboard from "@/pages/tenant-dashboard";
import Expenses from "@/pages/expenses";
import Revenue from "@/pages/revenue";
import Tax from "@/pages/tax";
import Reminders from "@/pages/reminders";
import Categories from "@/pages/categories";
import Messages from "@/pages/messages";
import ApprovalSettings from "@/pages/approval-settings";
import PromptTester from "@/pages/prompt-tester";
import NotFound from "@/pages/not-found";

function RoleBasedHome() {
  const { currentRole } = useRole();
  
  if (currentRole === 'tenant') {
    return <Redirect to="/tenant-dashboard" />;
  } else if (currentRole === 'contractor') {
    return <Redirect to="/contractor-dashboard" />;
  } else if (currentRole === 'admin') {
    return <Redirect to="/admin-dashboard" />;
  }
  
  return <Dashboard />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route component={Landing} />
        </>
      ) : (
        <>
          <Route path="/" component={RoleBasedHome} />
          <Route path="/properties" component={Properties} />
          <Route path="/properties/:id/performance" component={PropertyPerformance} />
          <Route path="/entities" component={Entities} />
          <Route path="/entities/:id/performance" component={EntityPerformance} />
          <Route path="/tenants" component={Tenants} />
          <Route path="/maintenance" component={Maintenance} />
          <Route path="/tenant-request" component={TenantRequest} />
          <Route path="/tenant-dashboard" component={TenantDashboard} />
          <Route path="/contractor-dashboard" component={ContractorDashboard} />
          <Route path="/contractor-availability" component={ContractorAvailability} />
          <Route path="/admin-dashboard" component={AdminDashboard} />
          <Route path="/expenses" component={Expenses} />
          <Route path="/revenue" component={Revenue} />
          <Route path="/tax" component={Tax} />
          <Route path="/reminders" component={Reminders} />
          <Route path="/categories" component={Categories} />
          <Route path="/messages" component={Messages} />
          <Route path="/approval-settings" component={ApprovalSettings} />
          <Route path="/prompt-tester" component={PromptTester} />
          <Route component={NotFound} />
        </>
      )}
    </Switch>
  );
}

function AppWithProviders() {
  const { user } = useAuth();
  
  return (
    <RoleProvider defaultRole="admin" userId={user?.id}>
      <Toaster />
      <Router />
    </RoleProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppWithProviders />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
