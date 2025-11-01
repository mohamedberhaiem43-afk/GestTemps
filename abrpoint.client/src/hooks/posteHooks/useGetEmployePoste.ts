import { useQuery } from "@tanstack/react-query";
import PosteService from "../../services/PosteService";

const useGetEmployePoste = (codpost:string,day:string) => {
  const soccod = sessionStorage.getItem('soccod');

  return useQuery({
    queryKey: ["postes", soccod,codpost,day],
    queryFn: () => PosteService.getWithParams(`get-employe-poste/${soccod}/${codpost}/${day}`),
    enabled: !!soccod && !!codpost && !!day,
  });
};

export default useGetEmployePoste;
