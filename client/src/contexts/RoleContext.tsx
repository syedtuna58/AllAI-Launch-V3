import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UserRole = 'admin' | 'contractor' | 'tenant';

interface RoleContextType {
  currentRole: UserRole;
  setRole: (role: UserRole) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

interface RoleProviderProps {
  children: ReactNode;
  defaultRole?: UserRole;
}

export function RoleProvider({ children, defaultRole }: RoleProviderProps) {
  const getInitialRole = (): UserRole => {
    try {
      const saved = localStorage.getItem('selectedRole');
      if (saved && (saved === 'admin' || saved === 'contractor' || saved === 'tenant')) {
        return saved as UserRole;
      }
    } catch (e) {}
    
    return defaultRole || 'admin';
  };

  const [currentRole, setCurrentRole] = useState<UserRole>(getInitialRole);

  const setRole = (role: UserRole) => {
    setCurrentRole(role);
    try {
      localStorage.setItem('selectedRole', role);
    } catch (e) {}
  };

  return (
    <RoleContext.Provider value={{ currentRole, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextType {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
