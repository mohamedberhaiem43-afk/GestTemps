import { useQuery } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import ContratReportService from "../../services/ContratService/ContratReportService";

const useGetContratReport = (empcod: string) => {
    const { soccod } = useAuth();
    return useQuery<any,Error>({
        queryKey: ["contrats",soccod,empcod],
        queryFn:(soccod)=> ContratReportService.getReport(`get-contrat-report/${soccod}/${empcod}`),
    }) 

}

export default useGetContratReport;