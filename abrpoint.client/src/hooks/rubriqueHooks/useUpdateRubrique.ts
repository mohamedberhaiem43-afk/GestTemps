import { useMutation } from "react-query";
import { Rubrique } from "../../models/Rubrique";
import RubriqueService from "../../services/RubriqueService/RubriqueService";


const useUpdateRubrique = () => {
    return useMutation({
        mutationKey: ["rubriques-update"],
        mutationFn: (rubrique: Rubrique) => RubriqueService.putWithoutParams(rubrique),
    });
};  

export default useUpdateRubrique;