import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Wrench, Home, Star, Sparkles } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-full mb-4 font-semibold">
            100% FREE - No Hidden Costs
          </div>
          <h1 className="text-5xl font-bold mb-4">Your Home, Simplified</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Free property management for homeowners, landlords, renters, and contractors
          </p>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            <p className="text-lg font-semibold">Featured: Property Owner Tools</p>
            <Sparkles className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            Finally, property management tools designed for homeowners who live in their own homes. 
            Track maintenance, hire trusted contractors, and keep your home in perfect condition.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Home className="h-12 w-12 text-primary mb-2" />
                <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">Popular</span>
              </div>
              <CardTitle>Property Owner</CardTitle>
              <CardDescription>Maintain your home without the hassle</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link href="/property-owner-signup">
                  <Button className="w-full" size="lg" data-testid="button-property-owner-signup">
                    Get Started Free
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" className="w-full" data-testid="button-property-owner-login">
                    Login
                  </Button>
                </Link>
              </div>
              <ul className="text-xs text-muted-foreground mt-4 space-y-1">
                <li>✓ Track maintenance & repairs</li>
                <li>✓ Find trusted contractors</li>
                <li>✓ Manage multiple properties</li>
              </ul>
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
                <Button className="w-full" size="lg" data-testid="button-landlord-login">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="w-full mt-2" data-testid="button-landlord-login-existing">
                  Login
                </Button>
              </Link>
              <ul className="text-xs text-muted-foreground mt-4 space-y-1">
                <li>✓ Manage properties & tenants</li>
                <li>✓ Track maintenance cases</li>
                <li>✓ Invite tenants automatically</li>
              </ul>
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
                <Button className="w-full" size="lg" data-testid="button-tenant-login">Get Started Free</Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="w-full mt-2" data-testid="button-tenant-login-existing">
                  Login
                </Button>
              </Link>
              <ul className="text-xs text-muted-foreground mt-4 space-y-1">
                <li>✓ Submit maintenance requests</li>
                <li>✓ Track case status</li>
                <li>✓ Approve appointments</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Wrench className="h-12 w-12 text-primary mb-2" />
              <CardTitle>Contractor</CardTitle>
              <CardDescription>Free marketplace - thousands of immediate needs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link href="/contractor-signup">
                  <Button className="w-full" size="lg" data-testid="button-contractor-signup">Get Started Free</Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" className="w-full" data-testid="button-contractor-login">Login</Button>
                </Link>
              </div>
              <ul className="text-xs text-muted-foreground mt-4 space-y-1">
                <li>✓ Access job marketplace</li>
                <li>✓ No cold leads - real needs</li>
                <li>✓ Direct client connections</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">How it works for homeowners</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div>
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                1
              </div>
              <h3 className="font-semibold mb-2">Sign Up Free</h3>
              <p className="text-sm text-muted-foreground">
                Create your account in under 2 minutes. Add your home details and you're ready to go.
              </p>
            </div>
            <div>
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                2
              </div>
              <h3 className="font-semibold mb-2">Find Trusted Help</h3>
              <p className="text-sm text-muted-foreground">
                Browse verified contractors by specialty. Save your favorites for quick access when you need help.
              </p>
            </div>
            <div>
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                3
              </div>
              <h3 className="font-semibold mb-2">Stay Organized</h3>
              <p className="text-sm text-muted-foreground">
                Track all maintenance and repairs in one place. AI helps you stay on top of your home's needs.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p>Also available: <Link href="/login" className="underline">Landlord portal</Link> · <Link href="/contractor-signup" className="underline">Contractor marketplace</Link></p>
        </div>
      </div>
    </div>
  );
}
