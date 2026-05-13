import { useQuery } from "@tanstack/react-query";
import ListeService from "../../services/ListeService";
import { useAuth } from "../../components/helper/AuthProvider";
  

const useGetDirectionLibs = () => {
    const { soccod } = useAuth();
    return useQuery({
    queryKey: ["directions", soccod],
    queryFn:()=> ListeService.getAllWithParams(`Directions/get-dirlibs/${soccod}`),
    enabled: !!soccod ,
  });
};

export default useGetDirectionLibs;
