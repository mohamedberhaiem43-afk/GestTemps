import { useQuery } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import { dashboardService } from "../../services/DashboardService";

const useGetDashboardData = (request:any) => {
  const { soccod } = useAuth();

  console.log("Request in useGetDashboardData:", request);
  return useQuery({
    queryKey: ["dashboard", soccod,request],
    queryFn:()=> dashboardService.postWithParams(`data`,request!),
    enabled: !!soccod && !!request, // Ne pas exécuter la requête tant que soccod ou request n'est pas défini
  });
};

export default useGetDashboardData;
