import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import { dashboardService } from "../../services/DashboardService";

const useGetDashboardData = (request:any) => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["dashboard", soccod,request],
    queryFn:()=> dashboardService.postWithParams(`data`,request!),
    enabled: !!soccod && !!request, // Ne pas exécuter la requête tant que soccod ou request n'est pas défini
  });
};

export default useGetDashboardData;
