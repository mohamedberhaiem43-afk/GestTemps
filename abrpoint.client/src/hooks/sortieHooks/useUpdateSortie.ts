import { useMutation } from "react-query";
import SortieService from "../../services/SortieService/SortieService";
import { Autoriser } from "../../models/Autoriser";


const useUpdateSortie = () => {
    return useMutation({
        mutationKey: ["sorties"],
        mutationFn: (sortie:Autoriser) => SortieService.putWithoutParams(sortie),
    });
};  

export default useUpdateSortie;
