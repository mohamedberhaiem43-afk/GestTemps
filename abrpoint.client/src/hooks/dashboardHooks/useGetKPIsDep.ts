import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import { dashboardService } from "../../services/DashboardService";

const useGetKPIsDep = (request:any) => {
  const { soccod } = useAuth();


  return useQuery({
    queryKey: ["kpi_dep", soccod,request],
    queryFn:()=> dashboardService.postWithParams(`kpis-departements`,request),
    enabled: !!soccod && !!request, // Ne pas exécuter la requête tant que soccod ou request n'est pas défini
  });
};

export default useGetKPIsDep;
