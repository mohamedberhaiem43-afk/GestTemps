import { useQuery } from "@tanstack/react-query";
import PosteService from "../../services/PosteService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetEmployePoste = (codpost:string,day:string) => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["postes", soccod,codpost,day],
    queryFn: () => PosteService.getWithParams(`get-employe-poste/${soccod}/${codpost}/${day}`),
    enabled: !!soccod && !!codpost && !!day,
  });
};

export default useGetEmployePoste;
