"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';

interface DemoContextType {
  isDemoMode: boolean;
  enableDemoMode: () => void;
  disableDemoMode: () => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);

  const enableDemoMode = useCallback(() => {
    setIsDemoMode(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('demoMode', 'true');
    }
  }, []);

  const disableDemoMode = useCallback(() => {
    setIsDemoMode(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('demoMode');
    }
  }, []);

  return (
    <DemoContext.Provider value={{ isDemoMode, enableDemoMode, disableDemoMode }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error('useDemo debe ser usado dentro de un DemoProvider');
  }
  return context;
}
