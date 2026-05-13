import { useQuery } from "@tanstack/react-query";
import CalendriersService from "../../services/CalendrierService/CalendriersService";

const useGetCalendrier = () => {
  const soccod = localStorage.getItem('soccod') || "01";

  return useQuery({
    queryKey: ["calendriers", soccod],
    queryFn: () => CalendriersService.getWithParams(`get-calendrier/${soccod}`),
    enabled: !!soccod
  });
};

export default useGetCalendrier;
