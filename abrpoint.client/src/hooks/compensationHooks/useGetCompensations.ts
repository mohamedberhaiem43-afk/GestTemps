import { useQuery } from "react-query";
import CompensationService from "../../services/ComensationService/CompensationService";
import { Compenser } from "../../Compense";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetCompensations = () => {
  const { soccod } = useAuth();
  return useQuery<Compenser[], Error>({
    queryKey: ["compensations", soccod],
    queryFn: () => CompensationService.getAllWithParams(`${soccod}`),
    enabled: !!soccod, // Ensure query runs only if soccod is defined
  });
};

export default useGetCompensations;
