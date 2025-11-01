import { useQuery } from "@tanstack/react-query";
import AllaitementService from "../../services/AllaitementService";
import { AllaitementDto } from "../../models/Allaitement";



export default function useGetAllaitement(soccod: string) {
  const uticod = localStorage.getItem('Uticod');
    return useQuery<AllaitementDto[],Error>({
      queryKey:["allaitement",soccod,uticod], 
      queryFn: () => AllaitementService.getAllWithParams(`get-allaitements/${soccod}/${uticod}`)
    });
};
