import React, { createContext, useContext, useState } from 'react';
import { Autoriser } from '../../models/Autoriser';

interface SortieGeneralContextType {
  selectedSortieGeneral: Autoriser | null;
  setSelectedSortieGeneral: (sortie: Autoriser | null) => void;
}

const SortieGeneralContext = createContext<SortieGeneralContextType | undefined>(undefined);

export const useSortieGeneralContext = () => {
  const context = useContext(SortieGeneralContext);
  if (!context) {
    throw new Error('useSortieGeneralContext must be used within a AbsenceProvider');
  }
  return context;
};

export const SortieGeneralProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedSortieGeneral, setSelectedSortieGeneral] = useState<Autoriser | null>(null);

  return (
    <SortieGeneralContext.Provider value={{ selectedSortieGeneral, setSelectedSortieGeneral }}>
      {children}
    </SortieGeneralContext.Provider>
  );
};
