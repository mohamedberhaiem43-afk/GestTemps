import { useQuery } from "@tanstack/react-query";
import ListeService from "../../services/ListeService";
  const soccod = sessionStorage.getItem('soccod');
  const uticod = localStorage.getItem('Uticod');

    const useGetFemmeLibs = () => {
    return useQuery({
    queryKey: ["employees", soccod,uticod],
    queryFn:()=> ListeService.getAllWithParams(`Employes/get-femme-libs/${soccod}/${uticod}`),
    enabled: !!soccod,
  });
};

export default useGetFemmeLibs;
