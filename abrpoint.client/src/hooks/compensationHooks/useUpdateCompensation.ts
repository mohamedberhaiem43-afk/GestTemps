import { useMutation } from "react-query";
import CompensationService from "../../services/ComensationService/CompensationService";
import { Compenser } from "../../Compense";


const useUpdateCompensation = () => {
    return useMutation({
        mutationKey: ["compensations"],
        mutationFn: (data:Compenser) => CompensationService.putWithoutParams(data),
    });
};  

export default useUpdateCompensation;
