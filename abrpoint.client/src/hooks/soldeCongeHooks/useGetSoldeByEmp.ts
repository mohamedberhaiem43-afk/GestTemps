import { useQuery } from "@tanstack/react-query";
import apiInstance from "../../components/API/apiInstance";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetSoldeByEmp = (empcod: string) => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["solde-emp", soccod, empcod],
    queryFn: async () => {
      const res = await apiInstance.get(`/Soldes/by-emp/${soccod}/${empcod}`);
      return res.data;
    },
    enabled: !!soccod && !!empcod,
    // Le solde doit refléter immédiatement une affectation de solde, un congé accepté
    // ou un transfert CET — opérations effectuées sur d'autres écrans. On considère donc
    // la donnée toujours périmée et on refetch à chaque montage de la page + au focus,
    // au lieu de servir une valeur en cache (staleTime global 5 min) jusqu'à rechargement.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
};

export default useGetSoldeByEmp;
