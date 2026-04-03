import { useMutation } from "react-query";
import AbsenceService from "../../services/AbsenceService/AbsenceService";
import { Absence } from "../../models/Absence";

const useUpdateAbsence = () => {
    
    return useMutation({
        mutationKey: ["absence"],
        mutationFn: (absence:Absence) => AbsenceService.putWithoutParams(absence),
          
    })
    

}

export default useUpdateAbsence;