import { useQuery } from "@tanstack/react-query";
import PosteLibsSevice from "../../services/PosteLibsSevice";

const useGetPoste = () => {
  const soccod = sessionStorage.getItem('soccod');

  return useQuery({
    queryKey: ["postes", soccod],
    queryFn: () => PosteLibsSevice.getAllWithParams(`${soccod}`),
    enabled: !!soccod,
  });
};

export default useGetPoste;
