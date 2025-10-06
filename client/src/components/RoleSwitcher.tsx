import { useRole } from '@/contexts/RoleContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Users, Wrench, Home, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RoleSwitcher() {
  const { 
    currentRole, 
    setRole, 
    currentCategory, 
    setCategory,
    userCategories,
    userMemberships 
  } = useRole();

  const roleIcons = {
    admin: Home,
    contractor: Wrench,
    tenant: Users,
  };

  const roleLabels = {
    admin: 'Admin',
    contractor: 'Contractor',
    tenant: 'Tenant',
  };

  // Get icon for current selection
  const getCurrentIcon = () => {
    if (currentCategory) {
      const iconName = currentCategory.icon || 'Users';
      // Return Users icon for custom categories
      return Users;
    }
    const Icon = roleIcons[currentRole];
    return Icon;
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2"
          data-testid="button-role-switcher"
        >
          <Icon className="h-4 w-4" />
          <span>{getCurrentLabel()}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Switch View</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Built-in Roles */}
        <DropdownMenuItem 
          onClick={() => setRole('admin')}
          className="cursor-pointer"
          data-testid="menu-item-admin"
        >
          <Home className="mr-2 h-4 w-4" />
          <span>Admin</span>
          {!currentCategory && currentRole === 'admin' && (
            <Check className="ml-auto h-4 w-4" />
          )}
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => setRole('contractor')}
          className="cursor-pointer"
          data-testid="menu-item-contractor"
        >
          <Wrench className="mr-2 h-4 w-4" />
          <span>Contractor</span>
          {!currentCategory && currentRole === 'contractor' && (
            <Check className="ml-auto h-4 w-4" />
          )}
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => setRole('tenant')}
          className="cursor-pointer"
          data-testid="menu-item-tenant"
        >
          <Users className="mr-2 h-4 w-4" />
          <span>Tenant</span>
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
                  onClick={() => setCategory(category.id)}
                  className={cn(
                    "cursor-pointer",
                    isSelected && "bg-accent"
                  )}
                  data-testid={`menu-item-category-${category.id}`}
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
  );
}
