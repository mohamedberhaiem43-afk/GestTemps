import { useQuery } from "react-query";
import ListeService from "../../services/ListeService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetEmployeesLibs = (sitcod?: string, sercod?: string, dircod?: string, empreg?: string) => {
    const { soccod, uticod } = useAuth();
    
    const params = new URLSearchParams();
    if (sitcod) params.append("sitcod", sitcod);
    if (sercod) params.append("sercod", sercod);
    if (dircod) params.append("dircod", dircod);
    if (empreg) params.append("empreg", empreg);
    
    const queryString = params.toString() ? `?${params.toString()}` : "";

    return useQuery({
      queryKey: ["employees", soccod, uticod, sitcod, sercod, dircod, empreg],
      queryFn: () => ListeService.getAllWithParams(`Employes/get-libs/${soccod}/${uticod}${queryString}`),
      enabled: !!soccod && !!uticod,
    });
};

export default useGetEmployeesLibs;
