import { useQuery } from "@tanstack/react-query";
import SocieteService from "../../services/SocieteService/SocieteService";

const useGetSocietes = () => {

  return useQuery({
    queryKey: ["societes"],
    queryFn: SocieteService.getAll
  });
};

export default useGetSocietes;
