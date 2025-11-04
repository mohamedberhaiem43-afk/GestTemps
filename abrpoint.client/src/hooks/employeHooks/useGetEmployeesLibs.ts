import { useQuery } from "@tanstack/react-query";
import ListeService from "../../services/ListeService";
import { useAuth } from "../../components/helper/AuthProvider";
  

const useGetEmployeesLibs = () => {
    const { soccod } = useAuth();
    const uticod = localStorage.getItem('Uticod');
    return useQuery({
    queryKey: ["employees", soccod,uticod],
    queryFn:()=> ListeService.getAllWithParams(`Employes/get-libs/${soccod}/${uticod}`),
    enabled: !!soccod && !!uticod,
  });
};

export default useGetEmployeesLibs;
