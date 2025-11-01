import React, { createContext, useContext, useState } from 'react';
import { Solde } from '../../models/Solde';

interface SoldeContextType {
  selectedSolde: Solde | null;
  setSelectedSolde: (ferier: Solde | null) => void;
}

const SoldeContext = createContext<SoldeContextType | undefined>(undefined);

export const useSoldeContext = () => {
  const context = useContext(SoldeContext);
  if (!context) {
    throw new Error('useSoldeContext must be used within a SoldeProvider');
  }
  return context;
};

export const SoldeProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [selectedSolde, setSelectedSolde] = useState<Solde | null>(null);

  return (
    <SoldeContext.Provider value={{ selectedSolde, setSelectedSolde }}>
      {children}
    </SoldeContext.Provider>
  );
};
