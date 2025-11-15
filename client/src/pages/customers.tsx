import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Briefcase, Plus, Mail, Phone, Building2, Trash2, Edit, ArrowUpDown, Filter } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Customer = {
  id: string;
  contractorId: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  activeJobCount: number;
};

const customerFormSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => data.firstName || data.lastName || data.companyName,
  {
    message: "At least one of First Name, Last Name, or Company Name is required",
    path: ["firstName"],
  }
);

type CustomerFormData = z.infer<typeof customerFormSchema>;

// Helper function to extract error message from API error
function extractErrorMessage(error: any): string {
  if (!error?.message) return "";
  
  // Error message format: "400: {\"error\":\"message\", \"details\": [...]}"
  const match = error.message.match(/\d+:\s*(\{.*\})/);
  if (match) {
    try {
      const errorObj = JSON.parse(match[1]);
      
      // If there are validation details, format them nicely
      if (errorObj.details && Array.isArray(errorObj.details)) {
        const detailMessages = errorObj.details.map((d: any) => {
          if (d.path && d.message) {
            return `${d.path.join('.')}: ${d.message}`;
          }
          return d.message || JSON.stringify(d);
        }).join(', ');
        
        return errorObj.error ? `${errorObj.error}. ${detailMessages}` : detailMessages;
      }
      
      return errorObj.error || "";
    } catch {
      return "";
    }
  }
  
  return error.message || "";
}

export default function CustomersPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'company' | 'city'>('name');
  const [filterCity, setFilterCity] = useState<string>('');
  const [filterActiveJobs, setFilterActiveJobs] = useState<'all' | 'with-jobs' | 'no-jobs'>('all');
  const { toast } = useToast();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['/api/contractor/customers'],
  });

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      companyName: "",
      email: "",
      phone: "",
      streetAddress: "",
      city: "",
      state: "",
      zipCode: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      return await apiRequest('POST', '/api/contractor/customers', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/customers'] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({
        title: "Customer added",
        description: "The customer has been added successfully.",
      });
    },
    onError: (error: any) => {
      const errorMessage = extractErrorMessage(error);
      toast({
        title: "Error",
        description: errorMessage || "Failed to add customer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CustomerFormData }) => {
      return await apiRequest('PATCH', `/api/contractor/customers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/customers'] });
      setEditingCustomer(null);
      form.reset();
      toast({
        title: "Customer updated",
        description: "The customer has been updated successfully.",
      });
    },
    onError: (error: any) => {
      const errorMessage = extractErrorMessage(error);
      toast({
        title: "Error",
        description: errorMessage || "Failed to update customer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/contractor/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/customers'] });
      toast({
        title: "Customer deleted",
        description: "The customer has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      const errorMessage = extractErrorMessage(error);
      toast({
        title: "Error",
        description: errorMessage || "Failed to delete customer. They may have existing work orders.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CustomerFormData) => {
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    form.reset({
      firstName: customer.firstName || "",
      lastName: customer.lastName || "",
      companyName: customer.companyName || "",
      email: customer.email || "",
      phone: customer.phone || "",
      streetAddress: customer.streetAddress || "",
      city: customer.city || "",
      state: customer.state || "",
      zipCode: customer.zipCode || "",
      notes: customer.notes || "",
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this customer? This action cannot be undone.")) {
      deleteMutation.mutate(id);
    }
  };

  const getCustomerDisplayName = (customer: Customer) => {
    if (customer.firstName && customer.lastName) {
      return `${customer.firstName} ${customer.lastName}`;
    }
    if (customer.firstName) return customer.firstName;
    if (customer.lastName) return customer.lastName;
    if (customer.companyName) return customer.companyName;
    return "Unnamed Customer";
  };

  // Get unique cities for filter dropdown
  const uniqueCities = Array.from(
    new Set(
      customers
        .map(c => c.city)
        .filter(Boolean)
    )
  ).sort();

  // Apply filters and sorting
  const filteredAndSortedCustomers = customers
    .filter(customer => {
      // Filter by city
      if (filterCity && customer.city !== filterCity) {
        return false;
      }
      
      // Filter by active jobs
      if (filterActiveJobs === 'with-jobs' && customer.activeJobCount === 0) {
        return false;
      }
      if (filterActiveJobs === 'no-jobs' && customer.activeJobCount > 0) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = getCustomerDisplayName(a).toLowerCase();
        const nameB = getCustomerDisplayName(b).toLowerCase();
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'company') {
        const companyA = (a.companyName || '').toLowerCase();
        const companyB = (b.companyName || '').toLowerCase();
        return companyA.localeCompare(companyB);
      }
      if (sortBy === 'city') {
        const cityA = (a.city || '').toLowerCase();
        const cityB = (b.city || '').toLowerCase();
        return cityA.localeCompare(cityB);
      }
      return 0;
    });

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Customers" />
        <main className="flex-1 p-6 overflow-auto">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
                Customers
              </h1>
              <p className="text-muted-foreground">
                Manage your clients and view their work orders
              </p>
            </div>
            <Dialog open={isAddDialogOpen || !!editingCustomer} onOpenChange={(open) => {
              if (!open) {
                setIsAddDialogOpen(false);
                setEditingCustomer(null);
                form.reset();
              }
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-customer">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
                  <DialogDescription>
                    {editingCustomer ? 'Update customer information' : 'Enter the details for your new customer'}
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John" {...field} data-testid="input-first-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Smith" {...field} data-testid="input-last-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input placeholder="ABC Properties LLC" {...field} data-testid="input-company-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@example.com" {...field} data-testid="input-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} data-testid="input-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="streetAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main St" {...field} data-testid="input-street-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input placeholder="Boston" {...field} data-testid="input-city" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input placeholder="MA" {...field} data-testid="input-state" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="zipCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Zip Code</FormLabel>
                            <FormControl>
                              <Input placeholder="02108" {...field} data-testid="input-zip-code" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Additional notes..." {...field} data-testid="input-notes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsAddDialogOpen(false);
                          setEditingCustomer(null);
                          form.reset();
                        }}
                        data-testid="button-cancel"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createMutation.isPending || updateMutation.isPending}
                        data-testid="button-submit"
                      >
                        {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingCustomer ? 'Update' : 'Add Customer'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filter and Sort Controls */}
          {customers.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-4 items-center" data-testid="filter-sort-controls">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select value={sortBy} onValueChange={(value: 'name' | 'company' | 'city') => setSortBy(value)}>
                  <SelectTrigger className="w-40" data-testid="select-sort">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="city">City</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterActiveJobs} onValueChange={(value: 'all' | 'with-jobs' | 'no-jobs') => setFilterActiveJobs(value)}>
                  <SelectTrigger className="w-40" data-testid="select-active-jobs">
                    <SelectValue placeholder="Active Jobs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    <SelectItem value="with-jobs">With Jobs</SelectItem>
                    <SelectItem value="no-jobs">No Jobs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {uniqueCities.length > 0 && (
                <Select value={filterCity} onValueChange={setFilterCity}>
                  <SelectTrigger className="w-40" data-testid="select-city">
                    <SelectValue placeholder="Filter by City" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Cities</SelectItem>
                    {uniqueCities.map((city) => (
                      <SelectItem key={city} value={city!}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {(filterCity || filterActiveJobs !== 'all') && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setFilterCity('');
                    setFilterActiveJobs('all');
                  }}
                  data-testid="button-clear-filters"
                >
                  Clear Filters
                </Button>
              )}

              <div className="ml-auto text-sm text-muted-foreground">
                Showing {filteredAndSortedCustomers.length} of {customers.length} customers
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading customers...</p>
              </div>
            </div>
          ) : customers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <User className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No customers yet</h3>
                <p className="text-muted-foreground text-center max-w-md mb-4">
                  Add your first customer to start tracking work orders and managing client relationships.
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-customer">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Customer
                </Button>
              </CardContent>
            </Card>
          ) : filteredAndSortedCustomers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Filter className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No customers match your filters</h3>
                <p className="text-muted-foreground text-center max-w-md mb-4">
                  Try adjusting your filters to see more results.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setFilterCity('');
                    setFilterActiveJobs('all');
                  }}
                  data-testid="button-clear-all-filters"
                >
                  Clear All Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredAndSortedCustomers.map((customer) => (
                <Card key={customer.id} className="hover:shadow-lg transition-shadow" data-testid={`card-customer-${customer.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5 text-primary" />
                          <span data-testid={`text-customer-name-${customer.id}`}>
                            {getCustomerDisplayName(customer)}
                          </span>
                        </CardTitle>
                        {customer.companyName && (
                          <CardDescription className="flex items-center gap-1 mt-1" data-testid={`text-company-name-${customer.id}`}>
                            <Building2 className="h-3 w-3" />
                            {customer.companyName}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(customer)}
                          data-testid={`button-edit-${customer.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(customer.id)}
                          data-testid={`button-delete-${customer.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Briefcase className="h-4 w-4" />
                        <span data-testid={`text-active-jobs-${customer.id}`}>
                          {customer.activeJobCount} active {customer.activeJobCount === 1 ? 'job' : 'jobs'}
                        </span>
                      </div>
                      {customer.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground truncate" data-testid={`text-customer-email-${customer.id}`}>
                          <Mail className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      )}
                      {customer.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid={`text-customer-phone-${customer.id}`}>
                          <Phone className="h-4 w-4" />
                          {customer.phone}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
