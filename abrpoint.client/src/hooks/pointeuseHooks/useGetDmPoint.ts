import { useQuery } from "react-query";
import GetDmpoint from "../../services/PointeuseService/GetDmpoint";

export default function useGetDmPoint() {
  return useQuery({
    queryKey: ["logs"],
    queryFn: () => GetDmpoint.postWithoutParams(),
    refetchInterval: 5000,
    refetchIntervalInBackground: true, // continue polling even if tab is inactive
  });
}
