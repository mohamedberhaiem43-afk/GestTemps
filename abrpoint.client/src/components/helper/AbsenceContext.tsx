import React, { createContext, useContext, useState } from 'react';
import { AbsenceDto } from '../../models/Absence';

interface AbsenceContextType {
  selectedAbsence: AbsenceDto | null;
  setSelectedAbsence: (absence: AbsenceDto | null) => void;
}

const AbsenceContext = createContext<AbsenceContextType | undefined>(undefined);

export const useAbsenceContext = () => {
  const context = useContext(AbsenceContext);
  if (!context) {
    throw new Error('useAbsenceContext must be used within a AbsenceProvider');
  }
  return context;
};

export const AbsenceProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [selectedAbsence, setSelectedAbsence] = useState<AbsenceDto | null>(null);

  return (
    <AbsenceContext.Provider value={{ selectedAbsence, setSelectedAbsence }}>
      {children}
    </AbsenceContext.Provider>
  );
};
