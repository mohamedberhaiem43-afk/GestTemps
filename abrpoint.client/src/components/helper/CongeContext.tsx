import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Conge } from '../../models/Conge';

// Props type for the provider
interface CongeProviderProps {
  children: ReactNode;
}
interface CongeContextType {
  selectedConge: Conge | null;
  setSelectedConge: (conge: Conge | null) => void;
}

// Context
const CongeContext = createContext<CongeContextType | undefined>(undefined);

// Hook
export const useCongeContext = () => {
  const context = useContext(CongeContext);
  if (!context) {
    throw new Error('useCongeContext must be used within a CongeProvider');
  }
  return context;
};


// Provider
export const CongeProvider: React.FC<CongeProviderProps> = ({ children }) => {
  const [selectedConge, setSelectedConge] = useState<Conge | null>(null);

  return (
    <CongeContext.Provider value={{ selectedConge, setSelectedConge }}>
      {children}
    </CongeContext.Provider>
  );
};
