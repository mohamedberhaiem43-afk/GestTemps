import { useMutation } from "react-query";
import { Ferier } from "../../models/Ferier";
import FerierService from "../../services/FerierService/FerierService";

const useUpdateRepos = () => {
    
    return useMutation({
        mutationKey: ["repos"],
        mutationFn: (ferier:Ferier) => FerierService.putWithoutParams(ferier),
          
    })
    

}

export default useUpdateRepos;