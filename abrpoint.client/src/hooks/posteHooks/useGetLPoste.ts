import { useQuery } from "@tanstack/react-query";
import PosteService from "../../services/PosteService";

const useGetLPoste = (codpost:string|undefined) => {
  const soccod = sessionStorage.getItem('soccod');

  return useQuery({
    queryKey: ["postes", soccod, codpost],
    queryFn: () => PosteService.getWithParams(`get-poste/${soccod}/${codpost}`),
    enabled: !!soccod,
  });
};

export default useGetLPoste;
