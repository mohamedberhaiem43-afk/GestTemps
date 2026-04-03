import { useQuery } from "react-query";
import SanctionService from "../../services/SanctionService/SanctionService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetSanction = () => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["sanction",soccod],
    queryFn:(concod)=> SanctionService.getAllWithParams(`get-sanction/${soccod}/${concod}`),
    enabled:!!soccod
  });
};

export default useGetSanction;
