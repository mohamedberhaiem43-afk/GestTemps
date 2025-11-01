import { useQuery } from "@tanstack/react-query";
import EcheanceContratService from "../../services/ContratService/EcheanceContratService";
import EchContrat from "../../models/EcheanceContrat";



const useGetEchContrats = (echdeb:string,echfin:string) => {
    const soccod = sessionStorage.getItem('soccod');
    const uticod = localStorage.getItem('Uticod');
    return useQuery<EchContrat[],Error>({
      queryKey:["echeance-contrat",soccod,echdeb,echfin,uticod], 
      queryFn:()=>  EcheanceContratService.getAllWithParams(`get-echeance/${soccod}/${echdeb}/${echfin}/${uticod}`),     
      enabled:!!soccod && !!echdeb && !!echfin && !!uticod
    });
};

export default useGetEchContrats;
