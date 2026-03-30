import { useQuery } from "react-query";
import ListeService from "../../services/ListeService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetFemmeLibs = () => {
    const { soccod, uticod } = useAuth();
    return useQuery({
      queryKey: ["employees", soccod, uticod],
      queryFn: () => ListeService.getAllWithParams(`Employes/get-femme-libs/${soccod}/${uticod}`),
      enabled: !!soccod && !!uticod,
    });
};

export default useGetFemmeLibs;
