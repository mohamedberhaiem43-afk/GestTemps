import { useQuery } from "@tanstack/react-query";
import CalendriersService from "../../services/CalendrierService/CalendriersService";

const useGetCalendrier = () => {
  const soccod = sessionStorage.getItem('soccod');

  return useQuery({
    queryKey: ["calendriers", soccod],
    queryFn: () => CalendriersService.getWithParams(`get-calendrier/${soccod}`),
    enabled: !!soccod
  });
};

export default useGetCalendrier;
