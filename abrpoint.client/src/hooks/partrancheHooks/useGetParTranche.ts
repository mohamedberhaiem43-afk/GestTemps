import { useQuery } from "react-query";
import ParTrancheService from "../../services/ParTrancheService";

const useGetParTranche = () => {
  const soccod = sessionStorage.getItem('soccod');

  return useQuery({
    queryKey: ["partranche", soccod],
    queryFn: () => ParTrancheService.getAllWithParams(`${soccod}`),
    enabled: !!soccod 
  });
};

export default useGetParTranche;
