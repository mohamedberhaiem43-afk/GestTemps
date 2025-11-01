import { useMutation } from "@tanstack/react-query";
import { Poste } from "../../models/Poste";
import PosteService from "../../services/PosteService";


const useAddPoste = () => {
    return useMutation({
        mutationKey: ["postes"],
        mutationFn: (data:Poste) => PosteService.post(data),
    });
};  

export default useAddPoste;
