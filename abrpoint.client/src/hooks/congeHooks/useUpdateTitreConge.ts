import { useMutation } from "react-query";
import { Conge } from "../../models/Conge";
import CongeService from "../../services/CongeService/CongeService";

const useUpdateTitreConge = () => {
    
    return useMutation({
        mutationKey: ["conge"],
        mutationFn: (conge:Conge) => CongeService.putWithoutParams(conge),
          
    })
    

}

export default useUpdateTitreConge;