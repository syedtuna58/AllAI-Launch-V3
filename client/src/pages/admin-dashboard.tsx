import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Users, Home, AlertTriangle, Wrench } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import PropertyAssistant from "@/components/ai/property-assistant";
import RemindersWidget from "@/components/widgets/reminders-widget";
import NotificationsWidget from "@/components/widgets/notifications-widget";

type PlatformStats = {
  orgCount: number;
  userCount: number;
  contractorCount: number;
  propertyCount: number;
  openCaseCount: number;
};

type OrganizationDetail = {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  createdAt: string;
  _count: {
    members: number;
    properties: number;
    tenants: number;
    cases: number;
  };
};

type UserDetail = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  primaryRole: string;
  createdAt: string;
  lastLoginAt: string | null;
};

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // Redirect non-platform-admins
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (user.primaryRole !== "platform_super_admin") {
        toast({
          title: "Access Denied",
          description: "Platform admin access required",
          variant: "destructive",
        });
        setLocation("/dashboard");
        return;
      }
    }
  }, [user, isLoading, isAuthenticated, setLocation, toast]);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "Please log in to continue",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ["/api/admin/stats"],
    retry: false,
  });

  const { data: organizations = [], isLoading: orgsLoading } = useQuery<OrganizationDetail[]>({
    queryKey: ["/api/admin/organizations"],
    retry: false,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<UserDetail[]>({
    queryKey: ["/api/admin/users"],
    retry: false,
  });

  if (isLoading || !isAuthenticated) {
    return null;
  }

  const roleColors: Record<string, string> = {
    platform_super_admin: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    org_admin: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    property_owner: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    contractor: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    tenant: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  };

  const roleLabels: Record<string, string> = {
    platform_super_admin: "Platform Admin",
    org_admin: "Landlord",
    property_owner: "Property Owner",
    contractor: "Contractor",
    tenant: "Tenant",
  };

  return (
    <div className="flex h-screen bg-background" data-testid="page-admin-dashboard">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Platform Admin Dashboard" subtitle="Welcome back, Platform Admin" />
        
        <main className="flex-1 overflow-auto p-6 bg-muted/30">
          {/* System-Wide Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Card data-testid="card-total-orgs">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Organizations</p>
                    <p className="text-3xl font-bold">{stats?.orgCount || 0}</p>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-200" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-total-users">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                    <p className="text-3xl font-bold">{stats?.userCount || 0}</p>
                  </div>
                  <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <Users className="h-6 w-6 text-purple-600 dark:text-purple-200" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-total-properties">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Properties</p>
                    <p className="text-3xl font-bold">{stats?.propertyCount || 0}</p>
                  </div>
                  <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                    <Home className="h-6 w-6 text-green-600 dark:text-green-200" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-open-cases">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Cases</p>
                    <p className="text-3xl font-bold">{stats?.openCaseCount || 0}</p>
                  </div>
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-200" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-contractors">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Contractors</p>
                    <p className="text-3xl font-bold">{stats?.contractorCount || 0}</p>
                  </div>
                  <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                    <Wrench className="h-6 w-6 text-orange-600 dark:text-orange-200" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              {/* Organizations Section */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>All Organizations</CardTitle>
                  <CardDescription>Overview of all organizations in the platform</CardDescription>
                </CardHeader>
                <CardContent>
                  {orgsLoading ? (
                    <p className="text-muted-foreground">Loading organizations...</p>
                  ) : organizations.length === 0 ? (
                    <p className="text-muted-foreground">No organizations found</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Organization</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead className="text-center">Properties</TableHead>
                          <TableHead className="text-center">Tenants</TableHead>
                          <TableHead className="text-center">Cases</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {organizations.map((org) => (
                          <TableRow key={org.id}>
                            <TableCell className="font-medium">{org.name}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>{org.ownerName}</div>
                                <div className="text-muted-foreground">{org.ownerEmail}</div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">{org._count.properties}</TableCell>
                            <TableCell className="text-center">{org._count.tenants}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={org._count.cases > 0 ? "default" : "secondary"}>
                                {org._count.cases}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(org.createdAt), "MMM d, yyyy")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Users Section */}
              <Card>
                <CardHeader>
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>Recent users across all roles</CardDescription>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <p className="text-muted-foreground">Loading users...</p>
                  ) : users.length === 0 ? (
                    <p className="text-muted-foreground">No users found</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Joined</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.firstName && user.lastName 
                                ? `${user.firstName} ${user.lastName}`
                                : user.firstName || user.email}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                            <TableCell>
                              <Badge className={roleColors[user.primaryRole] || ""}>
                                {roleLabels[user.primaryRole] || user.primaryRole}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(user.createdAt), "MMM d, yyyy")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {/* Maya AI - Platform Scoped */}
              <PropertyAssistant />
              
              {/* Reminders Widget */}
              <RemindersWidget />
              
              {/* Notifications Widget */}
              <NotificationsWidget />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
