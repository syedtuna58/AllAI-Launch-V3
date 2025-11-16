import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Building2, 
  Users, 
  Home, 
  AlertTriangle, 
  Wrench, 
  Search, 
  ArrowUpDown, 
  Activity,
  TrendingUp,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Star
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import PropertyAssistant from "@/components/ai/property-assistant";

type PlatformStats = {
  orgCount: number;
  userCount: number;
  activeUserCount: number;
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
  daysSinceLogin: number | null;
  activityStatus: 'very_active' | 'active' | 'inactive' | 'dormant' | 'never_logged_in';
};

type ContractorDetail = {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  profileId: string;
  bio: string | null;
  isAvailable: boolean;
  emergencyAvailable: boolean;
  specialties: string[];
  totalJobs: number;
  completedJobs: number;
  activeJobs: number;
  scheduledJobs: number;
  favoriteCount: number;
  daysSinceLogin: number | null;
  activityStatus: 'very_active' | 'active' | 'inactive' | 'never_logged_in';
  marketplaceActive: boolean;
};

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [orgSearchTerm, setOrgSearchTerm] = useState("");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [contractorSearchTerm, setContractorSearchTerm] = useState("");
  const [orgSortBy, setOrgSortBy] = useState<'name' | 'properties' | 'tenants' | 'cases'>('name');
  const [userSortBy, setUserSortBy] = useState<'name' | 'role' | 'joined' | 'activity'>('activity');
  const [contractorSortBy, setContractorSortBy] = useState<'name' | 'jobs' | 'activity'>('activity');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>('all');

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

  const { data: contractors = [], isLoading: contractorsLoading } = useQuery<ContractorDetail[]>({
    queryKey: ["/api/admin/contractors"],
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

  const activityColors: Record<string, string> = {
    very_active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    active: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    inactive: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    dormant: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    never_logged_in: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  };

  const activityLabels: Record<string, string> = {
    very_active: "Very Active",
    active: "Active",
    inactive: "Inactive",
    dormant: "Dormant",
    never_logged_in: "Never Logged In",
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
    let filtered = users.filter(user => {
      const matchesSearch = 
        (user.firstName || '').toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        (user.lastName || '').toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        (roleLabels[user.primaryRole] || '').toLowerCase().includes(userSearchTerm.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || user.primaryRole === roleFilter;
      const matchesActivity = activityFilter === 'all' || user.activityStatus === activityFilter;
      
      return matchesSearch && matchesRole && matchesActivity;
    });

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
        case 'activity':
          return (a.daysSinceLogin ?? 999999) - (b.daysSinceLogin ?? 999999);
        default:
          return 0;
      }
    });
  }, [users, userSearchTerm, userSortBy, roleFilter, activityFilter, roleLabels]);

  // Filter and sort contractors
  const filteredContractors = useMemo(() => {
    let filtered = contractors.filter(contractor => {
      const matchesSearch = 
        (contractor.firstName || '').toLowerCase().includes(contractorSearchTerm.toLowerCase()) ||
        (contractor.lastName || '').toLowerCase().includes(contractorSearchTerm.toLowerCase()) ||
        contractor.email.toLowerCase().includes(contractorSearchTerm.toLowerCase()) ||
        contractor.specialties.some(s => s.toLowerCase().includes(contractorSearchTerm.toLowerCase()));
      
      const matchesMarketplace = 
        marketplaceFilter === 'all' ||
        (marketplaceFilter === 'active' && contractor.marketplaceActive) ||
        (marketplaceFilter === 'inactive' && !contractor.marketplaceActive);
      
      const matchesActivity = activityFilter === 'all' || contractor.activityStatus === activityFilter;
      
      return matchesSearch && matchesMarketplace && matchesActivity;
    });

    return filtered.sort((a, b) => {
      switch (contractorSortBy) {
        case 'name': {
          const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.email;
          const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.email;
          return aName.localeCompare(bName);
        }
        case 'jobs':
          return b.totalJobs - a.totalJobs;
        case 'activity':
          return (a.daysSinceLogin ?? 999999) - (b.daysSinceLogin ?? 999999);
        default:
          return 0;
      }
    });
  }, [contractors, contractorSearchTerm, contractorSortBy, marketplaceFilter, activityFilter]);

  // Calculate user analytics by role
  const userAnalyticsByRole = useMemo(() => {
    const byRole: Record<string, { total: number; active: number; inactive: number; }> = {};
    
    users.forEach(user => {
      if (!byRole[user.primaryRole]) {
        byRole[user.primaryRole] = { total: 0, active: 0, inactive: 0 };
      }
      byRole[user.primaryRole].total++;
      if (user.activityStatus === 'very_active' || user.activityStatus === 'active') {
        byRole[user.primaryRole].active++;
      } else {
        byRole[user.primaryRole].inactive++;
      }
    });
    
    return byRole;
  }, [users]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background" data-testid="page-admin-dashboard">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Super Admin Dashboard" subtitle="Platform Overview & Analytics" />
        
        <main className="flex-1 overflow-auto p-6 bg-muted/30">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="overview" data-testid="tab-overview">
                <TrendingUp className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="users" data-testid="tab-users">
                <Users className="h-4 w-4 mr-2" />
                User Analytics
              </TabsTrigger>
              <TabsTrigger value="contractors" data-testid="tab-contractors">
                <Wrench className="h-4 w-4 mr-2" />
                Contractor Marketplace
              </TabsTrigger>
              <TabsTrigger value="organizations" data-testid="tab-organizations">
                <Building2 className="h-4 w-4 mr-2" />
                Organizations
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* System-Wide Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <Card data-testid="card-total-orgs">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Organizations</p>
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

                <Card data-testid="card-active-users">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Active Users</p>
                        <p className="text-3xl font-bold">{stats?.activeUserCount || 0}</p>
                        <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
                      </div>
                      <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                        <Activity className="h-6 w-6 text-green-600 dark:text-green-200" />
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
                        <p className="text-xs text-muted-foreground mt-1">
                          {contractors.filter(c => c.marketplaceActive).length} active
                        </p>
                      </div>
                      <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                        <Wrench className="h-6 w-6 text-orange-600 dark:text-orange-200" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-total-properties">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Properties</p>
                        <p className="text-3xl font-bold">{stats?.propertyCount || 0}</p>
                      </div>
                      <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                        <Home className="h-6 w-6 text-green-600 dark:text-green-200" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-active-cases">
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
              </div>

              {/* User Analytics by Role */}
              <Card>
                <CardHeader>
                  <CardTitle>User Distribution by Role</CardTitle>
                  <CardDescription>Active vs inactive users across different roles</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(userAnalyticsByRole).map(([role, stats]) => (
                      <Card key={role} className="bg-muted/50">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <Badge className={roleColors[role] || ""}>
                              {roleLabels[role] || role}
                            </Badge>
                            <span className="text-2xl font-bold">{stats.total}</span>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Active:</span>
                              <span className="text-green-600 dark:text-green-400 font-medium">{stats.active}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Inactive:</span>
                              <span className="text-yellow-600 dark:text-yellow-400 font-medium">{stats.inactive}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

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
            </TabsContent>

            {/* User Analytics Tab */}
            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle>All Platform Users</CardTitle>
                      <CardDescription>
                        {filteredUsers.length} of {users.length} users
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="px-3 py-2 border rounded-md bg-background text-sm"
                        data-testid="select-role-filter"
                      >
                        <option value="all">All Roles</option>
                        {Object.entries(roleLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                      <select
                        value={activityFilter}
                        onChange={(e) => setActivityFilter(e.target.value)}
                        className="px-3 py-2 border rounded-md bg-background text-sm"
                        data-testid="select-activity-filter"
                      >
                        <option value="all">All Activity</option>
                        {Object.entries(activityLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
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
                    <div className="max-h-[600px] overflow-auto border rounded-md">
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
                                onClick={() => setUserSortBy('activity')}
                                className="hover:bg-transparent"
                              >
                                Activity
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                              </Button>
                            </TableHead>
                            <TableHead>Last Login</TableHead>
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
                              <TableCell>
                                <Badge className={activityColors[user.activityStatus] || ""}>
                                  {activityLabels[user.activityStatus]}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {user.daysSinceLogin === null 
                                  ? 'Never' 
                                  : user.daysSinceLogin === 0 
                                  ? 'Today'
                                  : `${user.daysSinceLogin}d ago`}
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
            </TabsContent>

            {/* Contractor Marketplace Tab */}
            <TabsContent value="contractors" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle>Contractor Marketplace</CardTitle>
                      <CardDescription>
                        {filteredContractors.length} of {contractors.length} contractors
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={marketplaceFilter}
                        onChange={(e) => setMarketplaceFilter(e.target.value)}
                        className="px-3 py-2 border rounded-md bg-background text-sm"
                        data-testid="select-marketplace-filter"
                      >
                        <option value="all">All Contractors</option>
                        <option value="active">Marketplace Active</option>
                        <option value="inactive">Marketplace Inactive</option>
                      </select>
                      <select
                        value={activityFilter}
                        onChange={(e) => setActivityFilter(e.target.value)}
                        className="px-3 py-2 border rounded-md bg-background text-sm"
                        data-testid="select-contractor-activity-filter"
                      >
                        <option value="all">All Activity</option>
                        <option value="very_active">Very Active</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search contractors..."
                          value={contractorSearchTerm}
                          onChange={(e) => setContractorSearchTerm(e.target.value)}
                          className="pl-9 w-64"
                          data-testid="input-search-contractors"
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {contractorsLoading ? (
                    <p className="text-muted-foreground">Loading contractors...</p>
                  ) : filteredContractors.length === 0 ? (
                    <p className="text-muted-foreground">No contractors found</p>
                  ) : (
                    <div className="max-h-[600px] overflow-auto border rounded-md">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                          <TableRow>
                            <TableHead>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setContractorSortBy('name')}
                                className="hover:bg-transparent"
                              >
                                Contractor
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                              </Button>
                            </TableHead>
                            <TableHead>Specialties</TableHead>
                            <TableHead>Marketplace Status</TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setContractorSortBy('activity')}
                                className="hover:bg-transparent"
                              >
                                Activity
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                              </Button>
                            </TableHead>
                            <TableHead className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setContractorSortBy('jobs')}
                                className="hover:bg-transparent"
                              >
                                Jobs
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                              </Button>
                            </TableHead>
                            <TableHead className="text-center">Favorites</TableHead>
                            <TableHead>Contact</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredContractors.map((contractor) => (
                            <TableRow key={contractor.userId}>
                              <TableCell className="font-medium">
                                {contractor.firstName && contractor.lastName 
                                  ? `${contractor.firstName} ${contractor.lastName}`
                                  : contractor.firstName || contractor.email}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {contractor.specialties.length > 0 ? (
                                    contractor.specialties.slice(0, 2).map((specialty, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {specialty}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-xs text-muted-foreground">None</span>
                                  )}
                                  {contractor.specialties.length > 2 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{contractor.specialties.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {contractor.marketplaceActive ? (
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Active
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary">
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Inactive
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <Badge className={activityColors[contractor.activityStatus] || ""}>
                                    {activityLabels[contractor.activityStatus]}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {contractor.daysSinceLogin === null 
                                      ? 'Never logged in' 
                                      : contractor.daysSinceLogin === 0 
                                      ? 'Active today'
                                      : `${contractor.daysSinceLogin}d ago`}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex flex-col gap-1 text-sm">
                                  <div className="flex items-center justify-center gap-2">
                                    <span className="font-medium">{contractor.totalJobs}</span>
                                    <span className="text-muted-foreground text-xs">total</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {contractor.activeJobs} active • {contractor.completedJobs} done
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                  <span className="font-medium">{contractor.favoriteCount}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <div className="text-muted-foreground">{contractor.email}</div>
                                  {contractor.phone && (
                                    <div className="text-muted-foreground">{contractor.phone}</div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Organizations Tab */}
            <TabsContent value="organizations" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle>All Organizations</CardTitle>
                      <CardDescription>
                        {filteredOrgs.length} of {organizations.length} organizations
                      </CardDescription>
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
                    <div className="max-h-[600px] overflow-auto border rounded-md">
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
                            <TableHead className="text-center">Actions</TableHead>
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
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    toast({
                                      title: "Organization Access",
                                      description: "Organization screen access coming soon. You'll be able to view all org screens (dashboard, properties, maintenance, calendar) from here.",
                                    });
                                  }}
                                  data-testid={`button-view-org-${org.id}`}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  View Screens
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
