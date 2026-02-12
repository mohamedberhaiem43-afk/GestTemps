import { useMutation } from "react-query";
import SocHeuresService from "../../services/SocieteService/SocHeuresService";
import { useAuth } from "../../components/helper/AuthProvider";

const useUpdateSocHeures = () => {
    const { soccod } = useAuth();
    
    return useMutation({
        mutationKey: ["socheures-update"],
        mutationFn: (socheures: { socpresence?: string; sochsup?: string }) => 
            SocHeuresService.putObject(
                `update-socheures/${soccod}`,socheures
            ),
    });
};

export default useUpdateSocHeures;