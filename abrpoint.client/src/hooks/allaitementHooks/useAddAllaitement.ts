import { useMutation } from "@tanstack/react-query";
import AllaitementService from "../../services/AllaitementService";
import { AllaitementDto } from "../../models/Allaitement";


const useAddAllaitement = () => {
    return useMutation({
        mutationKey: ["allaitements"],
        mutationFn: (data:AllaitementDto) => AllaitementService.post(data),
    });
};  

export default useAddAllaitement;
