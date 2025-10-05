import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCheck, Wrench, Building2 } from 'lucide-react';
import { useRole, type UserRole } from '@/contexts/RoleContext';

export function RoleSwitcher() {
  const [, setLocation] = useLocation();
  const { currentRole, setRole } = useRole();
  
  const roleConfig = {
    admin: {
      label: 'Admin View',
      icon: Building2,
      path: '/',
      color: 'text-blue-600 dark:text-blue-400'
    },
    contractor: {
      label: 'Contractor View',
      icon: Wrench,
      path: '/contractor-dashboard',
      color: 'text-orange-600 dark:text-orange-400'
    },
    tenant: {
      label: 'Tenant View',
      icon: UserCheck,
      path: '/tenant-dashboard',
      color: 'text-green-600 dark:text-green-400'
    }
  };

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    const config = roleConfig[newRole];
    setLocation(config.path);
  };

  const CurrentIcon = roleConfig[currentRole].icon;

  return (
    <div className="flex items-center gap-2" data-testid="role-switcher">
      <CurrentIcon className={`h-4 w-4 ${roleConfig[currentRole].color}`} />
      <Select value={currentRole} onValueChange={handleRoleChange}>
        <SelectTrigger className="w-[180px]" data-testid="role-select-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin" data-testid="role-option-admin">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span>Admin View</span>
            </div>
          </SelectItem>
          <SelectItem value="contractor" data-testid="role-option-contractor">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-orange-600" />
              <span>Contractor View</span>
            </div>
          </SelectItem>
          <SelectItem value="tenant" data-testid="role-option-tenant">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-600" />
              <span>Tenant View</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

