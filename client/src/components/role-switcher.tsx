import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Users, Wrench, Check, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRole, type UserRole } from '@/contexts/RoleContext';

export function RoleSwitcher() {
  const [, setLocation] = useLocation();
  const { 
    currentRole, 
    setRole, 
    currentCategory, 
    setCategory,
    userCategories,
    userMemberships 
  } = useRole();

  const roleIcons = {
    admin: Building2,
    contractor: Wrench,
    tenant: Users,
  };

  const roleLabels = {
    admin: 'Admin View',
    contractor: 'Contractor View',
    tenant: 'Tenant View',
  };

  const rolePaths = {
    admin: '/',
    contractor: '/contractor-dashboard',
    tenant: '/tenant-dashboard',
  };

  const roleColors = {
    admin: 'text-blue-600 dark:text-blue-400',
    contractor: 'text-orange-600 dark:text-orange-400',
    tenant: 'text-green-600 dark:text-green-400',
  };

  // Get icon for current selection
  const getCurrentIcon = () => {
    if (currentCategory) {
      return Users; // Default icon for custom categories
    }
    return roleIcons[currentRole];
  };

  const getCurrentLabel = () => {
    if (currentCategory) {
      return currentCategory.name;
    }
    return roleLabels[currentRole];
  };

  const Icon = getCurrentIcon();

  // Filter categories where user is a member
  const myCategories = userCategories.filter(cat => 
    userMemberships.some(m => m.categoryId === cat.id && m.isActive)
  );

  const handleRoleChange = (role: UserRole) => {
    setRole(role);
    setLocation(rolePaths[role]);
  };

  const handleCategoryChange = (categoryId: string) => {
    setCategory(categoryId);
    // Stay on current page or navigate to dashboard
  };

  return (
    <div className="flex items-center gap-2" data-testid="role-switcher">
      <Icon className={`h-4 w-4 ${currentCategory ? 'text-foreground' : roleColors[currentRole]}`} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="gap-2 px-2 h-auto"
            data-testid="role-select-trigger"
          >
            <span>{getCurrentLabel()}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Switch View</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Built-in Roles */}
          <DropdownMenuItem 
            onClick={() => handleRoleChange('admin')}
            className="cursor-pointer"
            data-testid="role-option-admin"
          >
            <Building2 className="mr-2 h-4 w-4 text-blue-600" />
            <span>Admin View</span>
            {!currentCategory && currentRole === 'admin' && (
              <Check className="ml-auto h-4 w-4" />
            )}
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => handleRoleChange('contractor')}
            className="cursor-pointer"
            data-testid="role-option-contractor"
          >
            <Wrench className="mr-2 h-4 w-4 text-orange-600" />
            <span>Contractor View</span>
            {!currentCategory && currentRole === 'contractor' && (
              <Check className="ml-auto h-4 w-4" />
            )}
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => handleRoleChange('tenant')}
            className="cursor-pointer"
            data-testid="role-option-tenant"
          >
            <Users className="mr-2 h-4 w-4 text-green-600" />
            <span>Tenant View</span>
            {!currentCategory && currentRole === 'tenant' && (
              <Check className="ml-auto h-4 w-4" />
            )}
          </DropdownMenuItem>
          
          {/* Custom Categories */}
          {myCategories.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>My Categories</DropdownMenuLabel>
              {myCategories.map((category) => {
                const isSelected = currentCategory?.id === category.id;
                return (
                  <DropdownMenuItem 
                    key={category.id}
                    onClick={() => handleCategoryChange(category.id)}
                    className={cn(
                      "cursor-pointer",
                      isSelected && "bg-accent"
                    )}
                    data-testid={`category-option-${category.id}`}
                  >
                    <div 
                      className="mr-2 h-4 w-4 rounded-full" 
                      style={{ backgroundColor: category.color || '#0080FF' }}
                    />
                    <span>{category.name}</span>
                    {isSelected && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                );
              })}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

