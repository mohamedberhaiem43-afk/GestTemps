import { useMutation } from "@tanstack/react-query";
import CompensationService from "../../services/ComensationService/CompensationService";


const useDeleteCompensation = () => {
    return useMutation({
        mutationKey: ["compensations"],
        mutationFn: ({ soccod, concod }: { soccod: string; concod: string }) => 
            CompensationService.delete(soccod, concod),});
};  

export default useDeleteCompensation;
