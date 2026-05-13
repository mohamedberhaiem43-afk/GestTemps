import { useMutation } from "@tanstack/react-query";
import SoldeService from "../../services/SoldeService/SoldeService";
import { Solde } from "../../models/Solde";

const useUpdateSolde = () => {
    
    return useMutation({
        mutationKey: ["soldes"],
        mutationFn: (solde:Solde) => SoldeService.putWithoutParams(solde),
          
    })
    

}

export default useUpdateSolde;