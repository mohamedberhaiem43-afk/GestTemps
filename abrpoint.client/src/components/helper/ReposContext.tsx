import React, { createContext, useContext, useState } from 'react';
import { Ferier } from '../../models/Ferier';

interface FerierContextType {
  selectedFerier: Ferier | null;
  setSelectedFerier: (ferier: Ferier | null) => void;
}

const FerierContext = createContext<FerierContextType | undefined>(undefined);

export const useFerierContext = () => {
  const context = useContext(FerierContext);
  if (!context) {
    throw new Error('useFerierContext must be used within a AbsenceProvider');
  }
  return context;
};

export const FerierProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [selectedFerier, setSelectedFerier] = useState<Ferier | null>(null);

  return (
    <FerierContext.Provider value={{ selectedFerier, setSelectedFerier }}>
      {children}
    </FerierContext.Provider>
  );
};
