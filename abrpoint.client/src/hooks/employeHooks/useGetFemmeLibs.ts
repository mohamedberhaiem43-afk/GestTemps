import { useQuery } from "@tanstack/react-query";
import ListeService from "../../services/ListeService";
import { useAuth } from "../../components/helper/AuthProvider";


const uticod = localStorage.getItem('Uticod');

const useGetFemmeLibs = () => {
    const { soccod } = useAuth();
    return useQuery({
    queryKey: ["employees", soccod,uticod],
    queryFn:()=> ListeService.getAllWithParams(`Employes/get-femme-libs/${soccod}/${uticod}`),
    enabled: !!soccod,
  });
};

export default useGetFemmeLibs;
