import { useQuery } from "react-query";
import AllaitementService from "../../services/AllaitementService";
import { useAuth } from "../../components/helper/AuthProvider";

export default function useGetAllaitement() {
  const { soccod, uticod } = useAuth();
  return useQuery({
    queryKey:["allaitement", soccod, uticod],
    queryFn: () => AllaitementService.getAllWithParams(`get-allaitements/${soccod}/${uticod}`),
    enabled: !!soccod && !!uticod,
  });
};
