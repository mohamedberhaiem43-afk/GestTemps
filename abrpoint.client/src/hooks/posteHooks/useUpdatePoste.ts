import { useMutation } from "react-query";
import PosteService from "../../services/PosteService";
import { UpdatePoste } from "../../models/PosteDto";


const useUpdatePoste = () => {
    return useMutation({
        mutationKey: ["postes"],
        mutationFn: (data:UpdatePoste) => PosteService.putWithoutParams(data),
    });
};  

export default useUpdatePoste;
