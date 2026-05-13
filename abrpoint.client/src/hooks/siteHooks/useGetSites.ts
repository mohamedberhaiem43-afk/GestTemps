import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import FilialeService from "../../services/FilialeService/FilialeService";

const useGetSites = () => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["sites",soccod],
    queryFn:()=> FilialeService.getWithParams(`${soccod}`),
    enabled: !!soccod ,
  });
};

export default useGetSites;
