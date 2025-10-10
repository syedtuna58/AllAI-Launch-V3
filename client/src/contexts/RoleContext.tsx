import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UserCategory, UserCategoryMember } from '@shared/schema';

export type UserRole = 'admin' | 'contractor' | 'tenant';

interface RoleContextType {
  currentRole: UserRole;
  setRole: (role: UserRole) => void;
  currentCategory: UserCategory | null;
  setCategory: (categoryId: string | null) => void;
  userCategories: UserCategory[];
  userMemberships: UserCategoryMember[];
  isLoadingCategories: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

interface RoleProviderProps {
  children: ReactNode;
  defaultRole?: UserRole;
  userId?: string;
}

export function RoleProvider({ children, defaultRole, userId }: RoleProviderProps) {
  const getInitialRole = (): UserRole => {
    try {
      const saved = localStorage.getItem('selectedRole');
      // Only use saved value if it's a valid role
      if (saved === 'admin' || saved === 'contractor' || saved === 'tenant') {
        return saved as UserRole;
      }
      // Clear invalid value from localStorage
      if (saved) {
        localStorage.removeItem('selectedRole');
      }
    } catch (e) {}
    
    return defaultRole || 'admin';
  };

  const [currentRole, setCurrentRole] = useState<UserRole>(getInitialRole);
  const [currentCategory, setCurrentCategoryState] = useState<UserCategory | null>(null);

  // Fetch all categories
  const { data: userCategories = [], isLoading: isLoadingCategories } = useQuery<UserCategory[]>({
    queryKey: ['/api/categories'],
    enabled: !!userId,
  });

  // Fetch user's category memberships
  const { data: userMemberships = [] } = useQuery<UserCategoryMember[]>({
    queryKey: ['/api/users', userId, 'categories'],
    enabled: !!userId,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('selectedRole');
      if (!saved && defaultRole) {
        setCurrentRole(defaultRole);
      }
    } catch (e) {}
  }, [defaultRole]);

  // Load saved category from localStorage
  useEffect(() => {
    if (userCategories.length > 0) {
      try {
        const savedCategoryId = localStorage.getItem('selectedCategoryId');
        if (savedCategoryId) {
          const category = userCategories.find(c => c.id === savedCategoryId);
          if (category) {
            setCurrentCategoryState(category);
          }
        }
      } catch (e) {}
    }
  }, [userCategories]);

  const setRole = (role: UserRole) => {
    setCurrentRole(role);
    try {
      localStorage.setItem('selectedRole', role);
      // Clear category when switching to built-in role
      setCurrentCategoryState(null);
      localStorage.removeItem('selectedCategoryId');
    } catch (e) {}
  };

  const setCategory = (categoryId: string | null) => {
    if (!categoryId) {
      setCurrentCategoryState(null);
      try {
        localStorage.removeItem('selectedCategoryId');
      } catch (e) {}
      return;
    }

    const category = userCategories.find(c => c.id === categoryId);
    if (category) {
      setCurrentCategoryState(category);
      try {
        localStorage.setItem('selectedCategoryId', categoryId);
      } catch (e) {}
    }
  };

  return (
    <RoleContext.Provider value={{ 
      currentRole, 
      setRole, 
      currentCategory,
      setCategory,
      userCategories,
      userMemberships,
      isLoadingCategories
    }}>
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
