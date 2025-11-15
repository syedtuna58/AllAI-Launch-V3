import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, User, Briefcase } from "lucide-react";

type Customer = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  companyName: string | null;
  role: string;
  propertyCount: number;
  activeJobCount: number;
};

export default function CustomersPage() {
  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['/api/contractor/customers'],
  });

  const getCustomerDisplayName = (customer: Customer) => {
    if (customer.firstName && customer.lastName) {
      return `${customer.firstName} ${customer.lastName}`;
    }
    if (customer.companyName) {
      return customer.companyName;
    }
    return customer.email;
  };

  const getCustomerType = (role: string) => {
    return role === 'org_admin' ? 'Landlord' : 'Property Owner';
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Customers" />
        <main className="flex-1 p-6 overflow-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
              Customers
            </h1>
            <p className="text-muted-foreground">
              Manage your client relationships and view their properties
            </p>
          </div>

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
                <p className="text-muted-foreground text-center max-w-md">
                  Once you accept jobs from landlords and property owners, they'll appear here as your customers.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {customers.map((customer) => (
                <Card key={customer.id} className="hover:shadow-lg transition-shadow" data-testid={`card-customer-${customer.id}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      <span data-testid={`text-customer-name-${customer.id}`}>
                        {getCustomerDisplayName(customer)}
                      </span>
                    </CardTitle>
                    <CardDescription data-testid={`text-customer-type-${customer.id}`}>
                      {getCustomerType(customer.role)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        <span data-testid={`text-property-count-${customer.id}`}>
                          {customer.propertyCount} {customer.propertyCount === 1 ? 'property' : 'properties'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Briefcase className="h-4 w-4" />
                        <span data-testid={`text-active-jobs-${customer.id}`}>
                          {customer.activeJobCount} active {customer.activeJobCount === 1 ? 'job' : 'jobs'}
                        </span>
                      </div>
                      {customer.email && (
                        <div className="text-sm text-muted-foreground truncate" data-testid={`text-customer-email-${customer.id}`}>
                          {customer.email}
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
