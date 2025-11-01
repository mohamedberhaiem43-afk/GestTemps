import { useMutation } from "@tanstack/react-query";
import AllaitementService from "../../services/AllaitementService";
import { AllaitementDto } from "../../models/Allaitement";


const useUpdateAllaitement = () => {
    return useMutation({
        mutationKey: ["allaitements"],
        mutationFn: (data:AllaitementDto) => AllaitementService.putWithoutParams(data),
    });
};  

export default useUpdateAllaitement;
