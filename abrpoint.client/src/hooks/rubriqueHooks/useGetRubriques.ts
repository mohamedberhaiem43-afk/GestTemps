import { useQuery } from "@tanstack/react-query";
import RubriqueService from "../../services/RubriqueService/RubriqueService";

const useGetRubriques = () => {
  const soccod = sessionStorage.getItem('soccod');

  return useQuery({
    queryKey: ["rubriques",soccod],
    queryFn:()=> RubriqueService.getAllWithParams(`${soccod}`)
  });
};

export default useGetRubriques;
