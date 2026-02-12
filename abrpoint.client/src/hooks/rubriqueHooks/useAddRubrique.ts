import { useMutation } from "react-query";
import { Rubrique } from "../../models/Rubrique";
import RubriqueService from "../../services/RubriqueService/RubriqueService";


const useAddRubrique = () => {
    return useMutation({
        mutationKey: ["rubriques"],
        mutationFn: (data:Rubrique) => RubriqueService.post(data),
    });
};  

export default useAddRubrique;
