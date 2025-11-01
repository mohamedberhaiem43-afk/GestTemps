import { useQuery } from "@tanstack/react-query";
import SanctionService from "../../services/SanctionService/SanctionService";
import { Sanction } from "../../models/Sanction";



const useGetSanctions = (soccod: string | null) => {
  const uticod = localStorage.getItem('Uticod');
    return useQuery<Sanction[],Error>({
      queryKey:["sanctions",soccod], 
      queryFn: () => SanctionService.getAllWithParams(`get-sanctions/${soccod}/${uticod}`),
      enabled:!!soccod,
    });
};

export default useGetSanctions;
