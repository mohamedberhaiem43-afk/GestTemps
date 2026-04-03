import React, { createContext, useContext, useState } from 'react';

import AllaitementModel from '../../models/Allaitement';

interface AllaitementContextType {
  selectedAllaitement: AllaitementModel | null;
  setSelectedAllaitement: (Allaitement: AllaitementModel | null) => void;
  hoursData: Record<string, number>;
  setHoursData: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}


const AllaitementContext = createContext<AllaitementContextType | undefined>(undefined);

export const useAllaitementContext = () => {
  const context = useContext(AllaitementContext);
  if (!context) {
    throw new Error('useAllaitementContext must be used within a AllaitementProvider');
  }
  return context;
};

export const AllaitementProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [selectedAllaitement, setSelectedAllaitement] = useState<AllaitementModel | null>(null);
  const [hoursData, setHoursData] = useState<Record<string, number>>({
    lundi: 0,
    mardi: 0,
    mercredi: 0,
    jeudi: 0,
    vendredi: 0,
    samedi: 0,
    dimanche: 0,
  });

  return (
    <AllaitementContext.Provider value={{ selectedAllaitement, setSelectedAllaitement, hoursData, setHoursData }}>
      {children}
    </AllaitementContext.Provider>
  );
};
