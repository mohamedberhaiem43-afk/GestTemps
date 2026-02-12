import { useQuery } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import { dashboardService } from "../../services/DashboardService";

const useGetEvolution = (request: any) => {
  const { soccod } = useAuth();
  return useQuery({
    queryKey: ["evolution", soccod, request],
    queryFn: () => dashboardService.postWithParams('evolution', request),
    enabled: !!soccod && !!request,
  });
};

export default useGetEvolution;