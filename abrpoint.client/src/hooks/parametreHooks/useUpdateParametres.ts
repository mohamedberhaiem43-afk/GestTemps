import { useMutation } from "@tanstack/react-query";
import { Parametre } from "../../models/Parametre";
import ParametreService from "../../services/ParametreService/ParametreService";


const useUpdateParametres = () => {
    return useMutation({
        mutationKey: ["parametres-update"],
        mutationFn: (parametre: Parametre) => ParametreService.putWithoutParams(parametre),
    });
};  

export default useUpdateParametres;