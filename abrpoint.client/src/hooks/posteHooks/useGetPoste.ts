import { useQuery } from "react-query";
import PosteLibsSevice from "../../services/PosteLibsSevice";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetPoste = () => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["postes", soccod],
    queryFn: () => PosteLibsSevice.getAllWithParams(`${soccod}`),
    enabled: !!soccod,
  });
};

export default useGetPoste;
