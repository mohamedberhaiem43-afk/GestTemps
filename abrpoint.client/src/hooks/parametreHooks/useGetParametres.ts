import { useQuery } from "react-query";
import ParametreService from "../../services/ParametreService/ParametreService";

const useGetParametres = () => {
    const soccod = sessionStorage.getItem('soccod');
    
    return useQuery({
        queryKey: ["parametres",soccod],
        queryFn: ()=> ParametreService.getWithParams(`${soccod}`),
        enabled: !!soccod
          
    })
    

}

export default useGetParametres;