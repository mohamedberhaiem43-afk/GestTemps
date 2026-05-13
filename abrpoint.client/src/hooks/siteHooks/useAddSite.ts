import { useMutation } from "@tanstack/react-query";
import { Filiale } from "../../models/Filiale";
import FilialeService from "../../services/FilialeService/FilialeService";


const useAddSite = () => {
    return useMutation({
        mutationKey: ["filiales"],
        mutationFn: (data:Filiale) => FilialeService.post(data),
    });
};  

export default useAddSite;
