import { useQuery } from "@tanstack/react-query";
import ParametreService from "../../services/ParametreService/ParametreService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetPaie = () => {
    const { soccod } = useAuth();
    
    return useQuery({
        queryKey: ["parametres",soccod],
        queryFn: ()=> ParametreService.getWithParams(`get-paie/${soccod}`),
        enabled: !!soccod
          
    })
    

}

export default useGetPaie;