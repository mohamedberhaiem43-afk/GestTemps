import { useQuery } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import { dashboardService } from "../../services/DashboardService";

const useGetResumeDuJour = (departement: string | null) => {
  const { soccod } = useAuth();


  return useQuery({
    queryKey: ["resume_jour", soccod,departement],
    queryFn:()=> dashboardService.getAllWithParams(`resume-jour/${soccod}/${departement}`),
    enabled: !!soccod && !!departement, // Ne pas exécuter la requête tant que soccod n'est pas défini
  });
};

export default useGetResumeDuJour;
