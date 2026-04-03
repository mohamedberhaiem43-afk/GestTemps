import { useQuery } from "react-query";
import RubriqueService from "../../services/RubriqueService/RubriqueService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetRubrique = (rubcod:string) => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["rubrique",soccod,rubcod],
    queryFn:()=> RubriqueService.getWithParams(`get-rubrique/${soccod}/${rubcod}`),
    enabled: !!soccod && !!rubcod,
  });
};

export default useGetRubrique;
