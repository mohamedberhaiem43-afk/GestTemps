import { createContext, useContext, useState } from 'react';

type DateRange = {
    dateDebut: Date;
    dateFin: Date;
    selectedFiliale: string;
    selectedRegime: string;
    selectedService: string;
    pres: string;
    mois: string;
    empcods: string[] | null;
};


type DateRangeContextType = {
    dateRange: DateRange;
    setDateRange: React.Dispatch<React.SetStateAction<DateRange>>;
};

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

import { ReactNode } from 'react';

export const DateRangeProvider = ({ children }: { children: ReactNode }) => {
const [dateRange, setDateRange] = useState<DateRange>({
    dateDebut: new Date(),
    dateFin: new Date(),
    selectedFiliale: sessionStorage.getItem('sitcod')||'',
    selectedRegime: '',
    selectedService: '',
    pres: '',
    mois: '',
    empcods: null
});

    return (
        <DateRangeContext.Provider value={{ dateRange, setDateRange }}>
            {children}
        </DateRangeContext.Provider>
    );
};

export const useDateRange = () => {
  const context = useContext(DateRangeContext);
  if (context === undefined) {
    throw new Error('useDateRange must be used within a DateRangeProvider');
  }
  return context;
};
