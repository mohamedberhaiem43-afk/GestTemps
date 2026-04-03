import { ReactNode,createContext, useState } from 'react';
import Employe from '../../../models/Employe';
import EmpEtat from '../../../models/EmpEtat';

type EmployeeContextType = {
  selectedEmpMat: string;
  setSelectedEmpMat: React.Dispatch<React.SetStateAction<string>>;
  selectedEmp: any;
  setSelectedEmp: React.Dispatch<React.SetStateAction<any>>;
  selectedEmpPoste: any;
  date: any;
  selectedEmpLib: any;
  setSelectedEmpLib: (lib: string) => void;
  empEtatData: EmpEtat[];
  arrondi: number;
  setArrondi: React.Dispatch<React.SetStateAction<any>>;
  setEmpEtatData: React.Dispatch<React.SetStateAction<any>>;
  arrondisup: number;
  setArrondiSup: React.Dispatch<React.SetStateAction<any>>;
  setDate: any;
  setSelectedEmpPoste: React.Dispatch<React.SetStateAction<any>>;
  
};

export const EmployeeContext = createContext<EmployeeContextType>({
  selectedEmpMat: '',
  setSelectedEmpMat: () => {},
  selectedEmp: null,
  setSelectedEmp: () => {},
  selectedEmpLib: null,
  setSelectedEmpLib : () => {},
  empEtatData: [],
  setEmpEtatData: () => {},
  selectedEmpPoste: null,
  date: null,
  arrondi: 0,
  arrondisup: 0,
  setDate: () => {},
  setArrondi: () => {},
  setArrondiSup: () => {},
  setSelectedEmpPoste: () => {},
});


export const EmployeeProvider = ({ children }: { children: ReactNode }) => {
  const [selectedEmpMat, setSelectedEmpMat] = useState<string>('');
  const [selectedEmp, setSelectedEmp] = useState<Employe|null>(null);
  const [selectedEmpPoste, setSelectedEmpPoste] = useState(null);
  const [arrondi, setArrondi] = useState(0);
  const [arrondisup, setArrondiSup] = useState(0);
  const [date, setDate] = useState(null);
  const [empEtatData, setEmpEtatData] = useState<EmpEtat[]>([]);
  const [selectedEmpLib, setSelectedEmpLib] = useState<string | null>(null);

  return (
    <EmployeeContext.Provider value={{ selectedEmpMat, setSelectedEmpMat,selectedEmpLib,setSelectedEmpLib,selectedEmp,setSelectedEmp, selectedEmpPoste, setSelectedEmpPoste,
    date,setDate,arrondi,setArrondi,arrondisup,setArrondiSup,empEtatData,setEmpEtatData }}>
      {children}
    </EmployeeContext.Provider>
  );
};

