import { useMutation } from "react-query";
import ContratService from "../../services/ContratService/ContratService";
import { Contrat } from "../../models/Contrat";


const useUpdateContrat = () => {
    return useMutation({
        mutationKey: ["contrats"],
        mutationFn: (data:Contrat) => ContratService.putWithoutParams(data),
    });
};  

export default useUpdateContrat;
