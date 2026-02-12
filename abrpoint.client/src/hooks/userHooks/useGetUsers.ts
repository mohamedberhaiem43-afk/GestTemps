import { useQuery } from "react-query";
import UtilisateurService from "../../services/UtilisateurService/UtilisateurService";
import UtilisateurDto from "../../models/Utilisateur";
import { useAuth } from "../../components/helper/AuthProvider";



export default function useGetUsers() {
    const uticod = localStorage.getItem('Uticod');
    const { soccod } = useAuth();
    return useQuery<UtilisateurDto[],Error>({
      queryKey:["users",uticod], 
      queryFn: () => UtilisateurService.getAllWithParams(`users-list/${soccod}/${uticod}`)
    });
};
