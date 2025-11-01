import React, { createContext, useContext, useState } from 'react';
import { Sanction } from '../../models/Sanction';

interface SanctionContextType {
  selectedSanction: Sanction | null;
  setSelectedSanction: (Sanction: Sanction | null) => void;
}
interface SanctionProviderProps {
  children: React.ReactNode;
}

const SanctionContext = createContext<SanctionContextType | undefined>(undefined);

export const useSanctionContext = () => {
  const context = useContext(SanctionContext);
  if (!context) {
    throw new Error('useSanctionContext must be used within a SanctionProvider');
  }
  return context;
};

export const SanctionProvider: React.FC<SanctionProviderProps> = ({ children }) => {
  const [selectedSanction, setSelectedSanction] = useState<Sanction | null>(null);

  return (
    <SanctionContext.Provider value={{ selectedSanction, setSelectedSanction }}>
      {children}
    </SanctionContext.Provider>
  );
};
