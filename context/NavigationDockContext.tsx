import React, { createContext, useContext, useState, useSyncExternalStore } from 'react';
import { createNavigationDock } from '../services/navigationDock';

const NavigationDockContext = createContext<ReturnType<typeof createNavigationDock> | null>(null);

export function NavigationDockProvider({ children }: { children: React.ReactNode }) {
  const [dock] = useState(createNavigationDock);
  return <NavigationDockContext.Provider value={dock}>{children}</NavigationDockContext.Provider>;
}

export function useMoneyNavigation() {
  const dock = useNavigationDock();
  return useSyncExternalStore(dock.subscribe, dock.getSnapshot, dock.getSnapshot);
}

export function useNavigationDock() {
  const dock = useContext(NavigationDockContext);
  if (!dock) throw new Error('NavigationDockProvider is required around the main navigator');
  return dock;
}
