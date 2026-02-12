import { useQuery } from "react-query";
import EmpDepassService from "../../services/EmployeService/EmpDepassService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetEmpDepassMax = () => {
    const { soccod } = useAuth();
    const uticod = localStorage.getItem('Uticod')
  return useQuery({
    queryKey: ["employes-depass-max",soccod,uticod],
    queryFn: () => EmpDepassService.getAllWithParams(`get-emp-depass-max/${soccod}/${uticod}`),
  });
};

export default useGetEmpDepassMax;
