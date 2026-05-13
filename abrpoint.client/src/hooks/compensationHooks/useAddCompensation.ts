import { useMutation } from "@tanstack/react-query";
import CompensationService from "../../services/ComensationService/CompensationService";
import { Compenser } from "../../Compense";


const useAddCompensation = () => {
    return useMutation({
        mutationKey: ["compensations"],
        mutationFn: (data:Compenser) => CompensationService.post(data),
    });
};  

export default useAddCompensation;
