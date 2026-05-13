import { useMutation } from "@tanstack/react-query";
import DemCongeService from "../../services/DemCongeService/DemCongeService";
import { Conge } from "../../models/Conge";


const useAddDemConge = () => {
    return useMutation({
        mutationKey: ["demconges"],
        mutationFn: (data:Conge) => DemCongeService.post(data),
    });
};

export default useAddDemConge;
