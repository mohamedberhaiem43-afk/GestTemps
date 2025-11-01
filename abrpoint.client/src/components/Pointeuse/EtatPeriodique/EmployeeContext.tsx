import { ReactNode,createContext, useState } from 'react';
import Employe from '../../../models/Employe';

type EmployeeContextType = {
  selectedEmpMat: any;
  setSelectedEmpMat: React.Dispatch<React.SetStateAction<any>>;
  selectedEmp: any;
  setSelectedEmp: React.Dispatch<React.SetStateAction<any>>;
  selectedEmpPoste: any;
  setSelectedEmpPoste: React.Dispatch<React.SetStateAction<any>>;
};

export const EmployeeContext = createContext<EmployeeContextType>({
  selectedEmpMat: null,
  setSelectedEmpMat: () => {},
  selectedEmp: null,
  setSelectedEmp: () => {},
  selectedEmpPoste: null,
  setSelectedEmpPoste: () => {},
});


export const EmployeeProvider = ({ children }: { children: ReactNode }) => {
  const [selectedEmpMat, setSelectedEmpMat] = useState<string|null>(null);
  const [selectedEmp, setSelectedEmp] = useState<Employe|null>(null);
  const [selectedEmpPoste, setSelectedEmpPoste] = useState(null);

  return (
    <EmployeeContext.Provider value={{ selectedEmpMat, setSelectedEmpMat,selectedEmp,setSelectedEmp, selectedEmpPoste, setSelectedEmpPoste }}>
      {children}
    </EmployeeContext.Provider>
  );
};
