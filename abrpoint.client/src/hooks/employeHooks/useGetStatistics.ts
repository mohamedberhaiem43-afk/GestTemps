import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import StatService from "../../services/EmployeService/StatService";

const useGetStatistics = () => {
const { soccod } = useAuth();
  return useQuery({
    queryKey: ["employes-depass-max",soccod],
    queryFn: () => StatService.getAllWithParams(`get-stats/${soccod}`),
  });
};

export default useGetStatistics;
