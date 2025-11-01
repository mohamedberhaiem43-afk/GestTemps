import { createContext, useContext, useState } from 'react';

// In your context file
export type DateMoisPointageRange = {
    dateDebut: string;
    dateFin: string;
    selectedFiliale: string;
    selectedRegime: string;
    selectedService: string;
    annee: string;
    mois: string;
    semaine: string;
    empcods?: string[];
};

export type DateMoisPointageRangeContextType = {
    dateRange: DateMoisPointageRange;
    setDateRange: React.Dispatch<React.SetStateAction<DateMoisPointageRange>>;
};

const DateMoisPointageRangeContext = createContext<DateMoisPointageRangeContextType | undefined>(undefined);

import { ReactNode } from 'react';

export const DateMoisPointageRangeProvider = ({ children }: { children: ReactNode }) => {
    const [dateRange, setDateRange] = useState({ dateDebut: '', dateFin: '',selectedFiliale:'',selectedRegime:'',selectedService:'',annee:'',mois:'',semaine:'' });

    return (
        <DateMoisPointageRangeContext.Provider value={{ dateRange, setDateRange }}>
            {children}
        </DateMoisPointageRangeContext.Provider>
    );
};

export const useDateMoisPointageRange = () => useContext(DateMoisPointageRangeContext);
