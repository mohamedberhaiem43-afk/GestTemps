import { useMutation } from "@tanstack/react-query";
import ParTranche from "../../models/ParTranche";
import ParTrancheService from "../../services/ParTrancheService";


const useUpdateParTranche = () => {
    return useMutation({
        mutationKey: ["partranche"],
        mutationFn: (partranche:ParTranche[]) => ParTrancheService.putWithoutParamsList(partranche),
    });
};  

export default useUpdateParTranche;
