import { useQuery } from "react-query";
import GetFonctions from "../../services/FonctionService/GetFonctions";

const useGetFonctions = () => {
  const soccod = sessionStorage.getItem('soccod');

  return useQuery({
    queryKey: ["fonctions",soccod],
    queryFn: GetFonctions.getAll
  });
};

export default useGetFonctions;
