import { ReactNode,createContext, useState } from 'react';

type EmployePosteContextType = {
  selectedEmpPeriodique: any;
  setSelectedEmpPeriodique: React.Dispatch<React.SetStateAction<any>>;
};

export const EmployePosteContext = createContext<EmployePosteContextType>({
  selectedEmpPeriodique: null,
  setSelectedEmpPeriodique: () => {},
});


export const EmployePosteProvider = ({ children }: { children: ReactNode }) => {
  const [selectedEmpPeriodique, setSelectedEmpPeriodique] = useState(null);

  return (
    <EmployePosteContext.Provider value={{ selectedEmpPeriodique, setSelectedEmpPeriodique }}>
      {children}
    </EmployePosteContext.Provider>
  );
};
