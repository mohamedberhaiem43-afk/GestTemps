import { useQuery } from "@tanstack/react-query";
import ContratService from "../../services/ContratService/ContratService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetAllContrats = (p0: string, p1: string, options?: { uticod?: string }) => {
  const { uticod } = options || {}; // Safely destructure `options`
  const { soccod } = useAuth();
  return useQuery({
    queryKey: ["contrats", p0, p1, soccod, uticod],
    queryFn: () => ContratService.getAllWithParams(`${soccod}/${uticod}`),
    enabled: !!soccod && !!uticod, // Fetch only if both soccod and uticod are available
  });
};

export default useGetAllContrats;
