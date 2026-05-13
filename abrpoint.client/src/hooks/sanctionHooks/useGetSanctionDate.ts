// useGetSanctionDate.ts
import { useQuery } from "@tanstack/react-query";
import SanctionService from "../../services/SanctionService/SanctionService";
import { Sanction } from "../../models/Sanction";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetSanctionDate = (date: string, empcod: string) => {
  const { soccod } = useAuth();
  return useQuery<Sanction, Error>({
    queryKey: ["sanction", soccod, date, empcod],
    queryFn: () => SanctionService.getWithParams(`get-date-sanction/${soccod}/${encodeURIComponent(date)}/${empcod}`),
    enabled: !!soccod && !!date && !!empcod,
    retry: false,
    refetchOnWindowFocus: false,
  });
};

export default useGetSanctionDate;