import { useQuery } from "@tanstack/react-query";
import AllaitementService from "../../services/AllaitementService";
import { AllaitementDto } from "../../models/Allaitement";
import { useAuth } from "../../components/helper/AuthProvider";



export default function useGetAllaitement() {
  const uticod = localStorage.getItem('Uticod');
  const { soccod } = useAuth();
    return useQuery<AllaitementDto[],Error>({
      queryKey:["allaitement",soccod,uticod], 
      queryFn: () => AllaitementService.getAllWithParams(`get-allaitements/${soccod}/${uticod}`)
    });
};
