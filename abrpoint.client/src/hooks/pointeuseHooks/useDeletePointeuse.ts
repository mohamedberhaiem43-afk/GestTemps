import { useMutation } from "react-query";
import DeletePointeuse from "../../services/PointeuseService/DeletePointeuse";

const useDeletePointeuse = () => {
  const soccod = sessionStorage.getItem("soccod") || '';

  return useMutation<string, Error, string>( // Types: Data, Error, Variables
    (poicod: string) => DeletePointeuse.delete(soccod, poicod)
  );
};

export default useDeletePointeuse;