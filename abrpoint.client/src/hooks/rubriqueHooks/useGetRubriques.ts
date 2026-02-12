import { useQuery } from "react-query";
import RubriqueService from "../../services/RubriqueService/RubriqueService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetRubriques = () => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["rubriques",soccod],
    queryFn:()=> RubriqueService.getAllWithParams(`${soccod}`)
  });
};

export default useGetRubriques;
