import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Users, Home, AlertTriangle, Wrench, ChevronDown, ChevronUp, Search, ArrowUpDown } from "lucide-react";
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
  const [expandedSection, setExpandedSection] = useState<'orgs' | 'users' | 'properties' | 'cases' | 'contractors' | null>(null);
  const [orgSearchTerm, setOrgSearchTerm] = useState("");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [orgSortBy, setOrgSortBy] = useState<'name' | 'properties' | 'tenants' | 'cases'>('name');
  const [userSortBy, setUserSortBy] = useState<'name' | 'role' | 'joined'>('joined');

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

  const roleColors: Record<string, string> = {
    platform_super_admin: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    org_admin: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    property_owner: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    contractor: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    tenant: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  };

  const roleLabels: Record<string, string> = {
    platform_super_admin: "Super Admin",
    org_admin: "Landlord",
    property_owner: "Property Owner",
    contractor: "Contractor",
    tenant: "Tenant",
  };

  // Filter and sort organizations
  const filteredOrgs = useMemo(() => {
    let filtered = organizations.filter(org => 
      org.name.toLowerCase().includes(orgSearchTerm.toLowerCase()) ||
      org.ownerName.toLowerCase().includes(orgSearchTerm.toLowerCase()) ||
      (org.ownerEmail || '').toLowerCase().includes(orgSearchTerm.toLowerCase())
    );

    return filtered.sort((a, b) => {
      switch (orgSortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'properties':
          return b._count.properties - a._count.properties;
        case 'tenants':
          return b._count.tenants - a._count.tenants;
        case 'cases':
          return b._count.cases - a._count.cases;
        default:
          return 0;
      }
    });
  }, [organizations, orgSearchTerm, orgSortBy]);

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    let filtered = users.filter(user =>
      (user.firstName || '').toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      (user.lastName || '').toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      (roleLabels[user.primaryRole] || '').toLowerCase().includes(userSearchTerm.toLowerCase())
    );

    return filtered.sort((a, b) => {
      switch (userSortBy) {
        case 'name': {
          const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.email;
          const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.email;
          return aName.localeCompare(bName);
        }
        case 'role':
          return a.primaryRole.localeCompare(b.primaryRole);
        case 'joined':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });
  }, [users, userSearchTerm, userSortBy, roleLabels]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background" data-testid="page-admin-dashboard">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Super Admin Dashboard" subtitle="Welcome back, Super Admin" />
        
        <main className="flex-1 overflow-auto p-6 bg-muted/30">
          {/* System-Wide Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Card 
              data-testid="card-total-orgs"
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => {
                setExpandedSection(expandedSection === 'orgs' ? null : 'orgs');
                document.getElementById('orgs-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
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

            <Card 
              data-testid="card-total-users"
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => {
                setExpandedSection(expandedSection === 'users' ? null : 'users');
                document.getElementById('users-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
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

            <Card 
              data-testid="card-total-properties"
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setExpandedSection('properties')}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Properties</p>
                    <p className="text-3xl font-bold">{stats?.propertyCount || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">Across all orgs</p>
                  </div>
                  <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                    <Home className="h-6 w-6 text-green-600 dark:text-green-200" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              data-testid="card-open-cases"
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setExpandedSection('cases')}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Cases</p>
                    <p className="text-3xl font-bold">{stats?.openCaseCount || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">Across all orgs</p>
                  </div>
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-200" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              data-testid="card-contractors"
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setExpandedSection('contractors')}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Contractors</p>
                    <p className="text-3xl font-bold">{stats?.contractorCount || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">Platform-wide</p>
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
              <Card id="orgs-section" className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>All Organizations</CardTitle>
                      <CardDescription>Overview of all organizations in the platform</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search organizations..."
                          value={orgSearchTerm}
                          onChange={(e) => setOrgSearchTerm(e.target.value)}
                          className="pl-9 w-64"
                          data-testid="input-search-orgs"
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {orgsLoading ? (
                    <p className="text-muted-foreground">Loading organizations...</p>
                  ) : filteredOrgs.length === 0 ? (
                    <p className="text-muted-foreground">No organizations found</p>
                  ) : (
                    <div className="max-h-96 overflow-auto border rounded-md">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                          <TableRow>
                            <TableHead>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setOrgSortBy('name')}
                                className="hover:bg-transparent"
                              >
                                Organization
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                              </Button>
                            </TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setOrgSortBy('properties')}
                                className="hover:bg-transparent"
                              >
                                Properties
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                              </Button>
                            </TableHead>
                            <TableHead className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setOrgSortBy('tenants')}
                                className="hover:bg-transparent"
                              >
                                Tenants
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                              </Button>
                            </TableHead>
                            <TableHead className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setOrgSortBy('cases')}
                                className="hover:bg-transparent"
                              >
                                Cases
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                              </Button>
                            </TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredOrgs.map((org) => (
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
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Users Section */}
              <Card id="users-section">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>All Users</CardTitle>
                      <CardDescription>Recent users across all roles</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search users..."
                          value={userSearchTerm}
                          onChange={(e) => setUserSearchTerm(e.target.value)}
                          className="pl-9 w-64"
                          data-testid="input-search-users"
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <p className="text-muted-foreground">Loading users...</p>
                  ) : filteredUsers.length === 0 ? (
                    <p className="text-muted-foreground">No users found</p>
                  ) : (
                    <div className="max-h-96 overflow-auto border rounded-md">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                          <TableRow>
                            <TableHead>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setUserSortBy('name')}
                                className="hover:bg-transparent"
                              >
                                Name
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                              </Button>
                            </TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setUserSortBy('role')}
                                className="hover:bg-transparent"
                              >
                                Role
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                              </Button>
                            </TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setUserSortBy('joined')}
                                className="hover:bg-transparent"
                              >
                                Joined
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                              </Button>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUsers.map((user) => (
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
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {/* Maya AI - Platform Scoped */}
              <PropertyAssistant 
                context="super_admin"
                exampleQuestions={[
                  "How many organizations are actively using the platform?",
                  "What's the total revenue across all properties?",
                  "Which organizations have the most maintenance cases?",
                  "Show me platform-wide user growth trends"
                ]}
              />
              
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
