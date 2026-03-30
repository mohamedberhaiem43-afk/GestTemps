import { useQuery } from "react-query";
import UtilisateurService from "../../services/UtilisateurService/UtilisateurService";
import UtilisateurDto from "../../models/Utilisateur";
import { useAuth } from "../../components/helper/AuthProvider";

export default function useGetUsers() {
    const { soccod, uticod } = useAuth();
    return useQuery<UtilisateurDto[],Error>({
      queryKey:["users", soccod, uticod],
      queryFn: () => UtilisateurService.getAllWithParams(`users-list/${soccod}/${uticod}`),
      enabled: !!soccod && !!uticod,
    });
};
