import { useQuery } from "@tanstack/react-query";
import CongeService from "../../services/CongeService/CongeService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetCongeReport = () => {
    const { soccod } = useAuth();
    return useQuery<any,Error>({
        queryKey: ["conges",soccod],
        queryFn:(concod)=> CongeService.getAllWithParams(`get-report/${concod}`),
    })
    

}

export default useGetCongeReport;