import { useQuery } from "@tanstack/react-query";
import PresenceService from "../../services/PersenceService/PresenceService";



const useGetEtatRetardsReport = (soccod: string,datedebut:Date,datefin:Date,regime:string) => {
    return useQuery<any>({
      queryKey:["etat-retard",soccod,datedebut,datefin,regime], 
      queryFn: () => PresenceService.getAllWithParams(`get-etat-retard-report/${soccod}/${datedebut}/${datefin}/${regime}`),
    enabled:!!soccod && !!datedebut && !!datefin && !!regime
    });
};

export default useGetEtatRetardsReport;
