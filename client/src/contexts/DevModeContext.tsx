import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface DevModeContextType {
  devModeEnabled: boolean;
  setDevModeEnabled: (enabled: boolean) => void;
}

const DevModeContext = createContext<DevModeContextType | undefined>(undefined);

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [devModeEnabled, setDevModeEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('devModeEnabled') === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('devModeEnabled', devModeEnabled.toString());
    }
  }, [devModeEnabled]);

  return (
    <DevModeContext.Provider value={{ devModeEnabled, setDevModeEnabled }}>
      {children}
    </DevModeContext.Provider>
  );
}

export function useDevMode() {
  const context = useContext(DevModeContext);
  if (!context) {
    throw new Error('useDevMode must be used within DevModeProvider');
  }
  return context;
}
