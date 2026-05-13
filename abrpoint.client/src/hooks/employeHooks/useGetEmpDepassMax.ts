import { useQuery } from "@tanstack/react-query";
import EmpDepassService from "../../services/EmployeService/EmpDepassService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetEmpDepassMax = () => {
    const { soccod, uticod } = useAuth();
    return useQuery({
      queryKey: ["employes-depass-max", soccod, uticod],
      queryFn: () => EmpDepassService.getAllWithParams(`get-emp-depass-max/${soccod}/${uticod}`),
      enabled: !!soccod && !!uticod,
    });
};

export default useGetEmpDepassMax;
