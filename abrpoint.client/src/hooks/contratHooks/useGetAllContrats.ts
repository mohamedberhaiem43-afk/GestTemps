import { useQuery } from "@tanstack/react-query";
import ContratService from "../../services/ContratService/ContratService";

const useGetAllContrats = (p0: string, p1: string, options?: { soccod?: string; uticod?: string }) => {
  const { soccod, uticod } = options || {}; // Safely destructure `options`

  return useQuery({
    queryKey: ["contrats", p0, p1, soccod, uticod],
    queryFn: () => ContratService.getAllWithParams(`${soccod}/${uticod}`),
    enabled: !!soccod && !!uticod, // Fetch only if both soccod and uticod are available
  });
};

export default useGetAllContrats;
