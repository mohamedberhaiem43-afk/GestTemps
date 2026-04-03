import { useMutation } from "react-query";
import FilialeService from "../../services/FilialeService/FilialeService";
import { Filiale } from "../../models/Filiale";
import { useAuth } from "../../components/helper/AuthProvider";

const useUpdateSite = () => {
    const { soccod } = useAuth();
    return useMutation({
        mutationKey: ["site",soccod],
        mutationFn: (site:Filiale) => FilialeService.putWithoutParams(site),
          
    })
    
}

export default useUpdateSite;