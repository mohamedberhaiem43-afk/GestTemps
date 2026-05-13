import { useMutation } from "@tanstack/react-query";
import AllaitementService from "../../services/AllaitementService";
import AllaitementModel from "../../models/Allaitement";


const useUpdateAllaitement = () => {
    return useMutation({
        mutationKey: ["allaitements"],
        mutationFn: (data:AllaitementModel) => AllaitementService.putWithoutParams(data),
    });
};  

export default useUpdateAllaitement;
