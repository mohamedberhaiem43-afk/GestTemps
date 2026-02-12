import { useMutation } from "react-query";
import SanctionService from "../../services/SanctionService/SanctionService";
import { Sanction } from "../../models/Sanction";


const useAddSanction = () => {
    return useMutation({
        mutationKey: ["sanctions"],
        mutationFn: (data:Sanction) => SanctionService.post(data),
    });
};  

export default useAddSanction;
