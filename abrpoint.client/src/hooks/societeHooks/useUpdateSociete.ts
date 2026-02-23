import { useMutation } from "react-query";
import { Societe } from "../../models/Societe";
import SocieteService from "../../services/SocieteService/SocieteService";

const useUpdateSociete = () => {
    
    return useMutation({
        mutationKey: ["societe"],
        mutationFn: (societe:Societe) => SocieteService.putWithoutParams(societe),
          
    })
    

}

export default useUpdateSociete;