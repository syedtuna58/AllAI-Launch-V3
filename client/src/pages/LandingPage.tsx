import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Wrench, Home, Shield } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4">Property Management System</h1>
          <p className="text-xl text-muted-foreground">
            Complete platform for landlords, contractors, and tenants
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card>
            <CardHeader>
              <Shield className="h-12 w-12 text-primary mb-2" />
              <CardTitle>Platform Admin</CardTitle>
              <CardDescription>System-wide management and analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/login">
                <Button className="w-full" data-testid="button-admin-login">Admin Login</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Building2 className="h-12 w-12 text-primary mb-2" />
              <CardTitle>Landlord</CardTitle>
              <CardDescription>Manage properties, tenants, and maintenance</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/login">
                <Button className="w-full" data-testid="button-landlord-login">Landlord Login</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Wrench className="h-12 w-12 text-primary mb-2" />
              <CardTitle>Contractor</CardTitle>
              <CardDescription>Access job marketplace and manage tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link href="/contractor-signup">
                  <Button className="w-full" data-testid="button-contractor-signup">Sign Up</Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" className="w-full" data-testid="button-contractor-login">Login</Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Home className="h-12 w-12 text-primary mb-2" />
              <CardTitle>Tenant</CardTitle>
              <CardDescription>View your unit and submit requests</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/login">
                <Button className="w-full" data-testid="button-tenant-login">Tenant Login</Button>
              </Link>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Invited by your landlord
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div>
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                1
              </div>
              <h3 className="font-semibold mb-2">Create Account</h3>
              <p className="text-sm text-muted-foreground">
                Landlords get magic link access. Contractors sign up with email and phone verification.
              </p>
            </div>
            <div>
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                2
              </div>
              <h3 className="font-semibold mb-2">Connect & Collaborate</h3>
              <p className="text-sm text-muted-foreground">
                Landlords invite tenants and post jobs. Contractors browse the marketplace and accept jobs.
              </p>
            </div>
            <div>
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                3
              </div>
              <h3 className="font-semibold mb-2">Track & Manage</h3>
              <p className="text-sm text-muted-foreground">
                Everyone sees only their relevant data with role-based access and AI-powered assistance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
