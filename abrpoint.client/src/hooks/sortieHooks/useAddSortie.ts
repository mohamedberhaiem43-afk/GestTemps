import { useMutation } from "@tanstack/react-query";
import SortieService from "../../services/SortieService/SortieService";
import { Autoriser } from "../../models/Autoriser";


const useAddSortie = () => {
    return useMutation({
        mutationKey: ["sorties"],
        mutationFn: (sortie:Autoriser) => SortieService.post(sortie),
    });
};  

export default useAddSortie;
