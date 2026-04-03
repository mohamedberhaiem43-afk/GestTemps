import { useMutation } from "react-query";
import SortieService from "../../services/SortieService/SortieService";
import { Autoriser } from "../../models/Autoriser";


const useAddBulkSortie = () => {
    return useMutation({
        mutationKey: ["sorties"],
        mutationFn: (sortie:Autoriser[]) => SortieService.putWithParamsList('bulk',sortie),
    });
};  

export default useAddBulkSortie;
