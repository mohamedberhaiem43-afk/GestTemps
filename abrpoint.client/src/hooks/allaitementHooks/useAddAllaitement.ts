import { useMutation } from "react-query";
import AllaitementModel from "../../models/Allaitement";
import AddAllaitementService from "../../services/AddAllaitementService";


const useAddAllaitement = () => {
    return useMutation({
        mutationKey: ["allaitements"],
        mutationFn: (data:AllaitementModel) => AddAllaitementService.post(data),
    });
};  

export default useAddAllaitement;
