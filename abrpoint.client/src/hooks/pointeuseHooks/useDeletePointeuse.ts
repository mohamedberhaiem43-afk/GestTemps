import { useMutation } from "react-query";
import DeletePointeuse from "../../services/PointeuseService/DeletePointeuse";
import { useAuth } from "../../components/helper/AuthProvider";

const useDeletePointeuse = () => {
  const { soccod } = useAuth();

  return useMutation<string, Error, string>( // Types: Data, Error, Variables
    (poicod: string) => DeletePointeuse.delete(soccod, poicod)
  );
};

export default useDeletePointeuse;