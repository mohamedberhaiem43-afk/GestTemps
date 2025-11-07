import React, { createContext, PropsWithChildren, useContext, useState } from 'react';
import { Compenser } from '../../Compense';

interface CompenstationContextType {
  selectedCompensation: Compenser | null;
  setSelectedCompensation: (compensation: Compenser | null) => void;
}

const CompensationContext = createContext<CompenstationContextType | undefined>(undefined);

export const useCompensationContext = () => {
  const context = useContext(CompensationContext);
  if (!context) {
    throw new Error('useCompensationContext must be used within a CompensationProvider');
  }
  return context;
};

export const CompensationProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [selectedCompensation, setSelectedCompensation] = useState<Compenser | null>(null);

  return (
    <CompensationContext.Provider value={{ selectedCompensation, setSelectedCompensation }}>
      {children}
    </CompensationContext.Provider>
  );
};
