import { useQuery } from "@tanstack/react-query";
import SanctionService from "../../services/SanctionService/SanctionService";

const useGetSanction = () => {
  const soccod = sessionStorage.getItem('soccod');

  return useQuery({
    queryKey: ["sanction",soccod],
    queryFn:(concod)=> SanctionService.getAllWithParams(`get-sanction/${soccod}/${concod}`),
    enabled:!!soccod
  });
};

export default useGetSanction;
