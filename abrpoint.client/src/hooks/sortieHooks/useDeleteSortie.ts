import { useMutation } from "@tanstack/react-query";
import SortieService from "../../services/SortieService/SortieService";
import { useAuth } from "../../components/helper/AuthProvider";


const useDeleteSortie = () => {
    const { soccod } = useAuth();
    return useMutation({
        mutationKey: ["sorties"],
        mutationFn: ({ code }: { code: string }) => 
            SortieService.delete(soccod, code),
    });
};  

export default useDeleteSortie;
