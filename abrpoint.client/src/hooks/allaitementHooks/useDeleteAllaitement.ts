import { useMutation } from "@tanstack/react-query";
import AllaitementService from "../../services/AllaitementService";


const useDeleteAllaitement = () => {
    return useMutation({
        mutationKey: ["allaitement"],
        mutationFn: ({ soccod, concod }: { soccod: string; concod: string }) => 
            AllaitementService.delete(soccod, concod),});
};  

export default useDeleteAllaitement;
