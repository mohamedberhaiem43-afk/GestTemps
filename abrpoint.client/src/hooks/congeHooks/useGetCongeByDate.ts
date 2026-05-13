import { useQuery } from "@tanstack/react-query";
import CongeService from "../../services/CongeService/CongeService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetCongeByDate = (empcod:string,date:any) => {
    const { soccod } = useAuth();
    return useQuery<any,Error>({
        queryKey: ["conges",soccod,empcod,date],
        queryFn:()=> CongeService.getAllWithParams(`get-emp-conge-by-date/${soccod}/${empcod}/${date}`),
    })
    

}

export default useGetCongeByDate;