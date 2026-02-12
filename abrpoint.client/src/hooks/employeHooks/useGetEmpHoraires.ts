import { useQuery } from "react-query";
import EmployeService from "../../services/EmployeService/EmployeService";

const useGetEmpHoraires = (soccod: string | null, empcod: string | null) => {
  
  return useQuery({
    queryKey: ["employee-horaires", soccod,empcod],
    queryFn:()=> EmployeService.getAllWithParams(`get-emp-horaires${soccod}/${empcod}`),
  });
};

export default useGetEmpHoraires;
