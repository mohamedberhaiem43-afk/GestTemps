import { useQuery } from "react-query";
import RubriqueService from "../../services/RubriqueService/RubriqueService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetRubriquesPaire = () => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["rubriques",soccod],
    queryFn:()=> RubriqueService.getAllWithParams(`get-paires/${soccod}`)
  });
};

export default useGetRubriquesPaire;
