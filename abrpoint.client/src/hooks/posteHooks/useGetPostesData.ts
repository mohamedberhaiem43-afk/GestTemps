import { useQuery } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import PosteHoraireService from "../../services/PosteService/PosteHoraireService";

const useGetPostesData = (codposte: string | undefined, catcod: string | undefined) => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["all-postes", soccod, codposte, catcod],
    queryFn: () => PosteHoraireService.getWithParams(`get-poste-horaire/${soccod}/${codposte}/${catcod}`),
    enabled: !!soccod && !!codposte && !!catcod, // only run when all are ready
  });
};

export default useGetPostesData;
