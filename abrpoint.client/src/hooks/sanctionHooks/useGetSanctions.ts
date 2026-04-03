import { useQuery } from "react-query";
import SanctionService from "../../services/SanctionService/SanctionService";
import { Sanction } from "../../models/Sanction";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetSanctions = (soccod: string | null) => {
  const { uticod } = useAuth();
    return useQuery<Sanction[],Error>({
      queryKey:["sanctions", soccod, uticod],
      queryFn: () => SanctionService.getAllWithParams(`get-sanctions/${soccod}/${uticod}`),
      enabled: !!soccod && !!uticod,
    });
};

export default useGetSanctions;
