import { useMutation } from "@tanstack/react-query";
import PosteService from "../../services/PosteService";


const useDeleteDeletePoste = () => {
    return useMutation({
        mutationKey: ["poste"],
        mutationFn: ({ soccod, poscod }: { soccod: string; poscod:string }) => 
            PosteService.delete(soccod, poscod),});
};  

export default useDeleteDeletePoste;
