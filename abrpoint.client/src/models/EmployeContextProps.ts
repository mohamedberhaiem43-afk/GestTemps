import { createContext } from "react";

interface EmployeeContextProps {
  selectedEmpMat: string[];
  setSelectedEmpMat: (value: string[]) => void;
}
export const EmployeeContext = createContext<EmployeeContextProps>({
  selectedEmpMat: [],
  setSelectedEmpMat: () => {},
});
