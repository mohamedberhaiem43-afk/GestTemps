import { useMutation } from "@tanstack/react-query";
import AbsenceService from "../../services/AbsenceService/AbsenceService";

const soccod = sessionStorage.getItem('soccod');
const useDeleteAbsence = () => {
    return useMutation({
        mutationKey: ["absences",soccod],
        mutationFn: ({ soccod, code }: { soccod: string; code: string }) => 
            AbsenceService.delete(soccod, code),
    });
    
};  

export default useDeleteAbsence;
