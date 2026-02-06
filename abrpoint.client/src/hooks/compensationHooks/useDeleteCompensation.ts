import { useMutation } from "@tanstack/react-query";
import CompensationService from "../../services/ComensationService/CompensationService";
import { useAuth } from "../../components/helper/AuthProvider";


const useDeleteCompensation = () => {
    const { soccod } = useAuth();
    return useMutation({
        mutationKey: ["compensations"],
        mutationFn: ({ concod }: { concod: string }) => 
            CompensationService.delete(soccod, concod),});
};  

export default useDeleteCompensation;
