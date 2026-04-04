import { createContext, useContext, useState, type ReactNode } from "react";

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

const getCurrentMonthValue = () => String(new Date().getMonth() + 1);
const getCurrentYearValue = () => new Date().getFullYear().toString();

const DateMoisPointageRangeContext = createContext<DateMoisPointageRangeContextType | undefined>(undefined);

export const DateMoisPointageRangeProvider = ({ children }: { children: ReactNode }) => {
  const [dateRange, setDateRange] = useState<DateMoisPointageRange>({
    dateDebut: "",
    dateFin: "",
    selectedFiliale: "",
    selectedRegime: "",
    selectedService: "",
    annee: getCurrentYearValue(),
    mois: getCurrentMonthValue(),
    semaine: "0",
    empcods: [],
  });

  return (
    <DateMoisPointageRangeContext.Provider value={{ dateRange, setDateRange }}>
      {children}
    </DateMoisPointageRangeContext.Provider>
  );
};

export const useDateMoisPointageRange = () => useContext(DateMoisPointageRangeContext);
