import { useMutation } from "@tanstack/react-query";
import { Conge } from "../../models/Conge";
import DemCongeService from "../../services/DemCongeService/DemCongeService";

const useUpdateDemConge = () => {
    
    return useMutation({
        mutationKey: ["conge"],
        mutationFn: (conge:Conge) => DemCongeService.putWithoutParams(conge),
          
    })
    

}

export default useUpdateDemConge;