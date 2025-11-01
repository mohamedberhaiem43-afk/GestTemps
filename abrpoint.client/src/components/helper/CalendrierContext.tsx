import React, { createContext, useContext, useState } from 'react';

interface CalendrierContextType {
  selectedCalendrier: string | null;
  setSelectedCalendrier: (Calendrier: string | null) => void;
}

const CalendrierContext = createContext<CalendrierContextType | undefined>(undefined);

export const useCalendrierContext = () => {
  const context = useContext(CalendrierContext);
  if (!context) {
    throw new Error('useCalendrierContext must be used within a CalendrierProvider');
  }
  return context;
};

export const CalendrierProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [selectedCalendrier, setSelectedCalendrier] = useState<string | null>(null);

  return (
    <CalendrierContext.Provider value={{ selectedCalendrier, setSelectedCalendrier }}>
      {children}
    </CalendrierContext.Provider>
  );
};