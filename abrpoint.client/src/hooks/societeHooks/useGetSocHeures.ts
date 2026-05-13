import { useQuery } from "@tanstack/react-query";
import SocHeuresService from "../../services/SocieteService/SocHeuresService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetSocietes = () => {
    const { soccod } = useAuth();
  return useQuery({
    queryKey: ["societes"],
    queryFn: () => SocHeuresService.getWithParams(`get-socheures/${soccod}`)
  });
};

export default useGetSocietes;
