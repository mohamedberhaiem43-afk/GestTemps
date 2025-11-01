import { useMutation } from "react-query";
import SanctionService from "../../services/SanctionService/SanctionService";
import { Sanction } from "../../models/Sanction";

const useUpdateSanction = () => {
    
    return useMutation({
        mutationKey: ["Sanction"],
        mutationFn: (sanction:Sanction) => SanctionService.putWithoutParams(sanction),
          
    })
    

}

export default useUpdateSanction;