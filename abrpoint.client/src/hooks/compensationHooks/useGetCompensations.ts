import { useQuery } from "@tanstack/react-query";
import CompensationService from "../../services/ComensationService/CompensationService";
import { Compenser } from "../../Compense";

const useGetCompensations = (soccod: string | null) => {
  return useQuery<Compenser[], Error>({
    queryKey: ["compensations", soccod],
    queryFn: () => CompensationService.getAllWithParams(`${soccod}`),
    enabled: !!soccod, // Ensure query runs only if soccod is defined
  });
};

export default useGetCompensations;
