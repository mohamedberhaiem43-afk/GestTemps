import { useQuery } from "@tanstack/react-query";
import GetPointeuses from "../../services/PointeuseService/GetPointeuses";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetPointeuses = () => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["pointeuses",soccod],
    queryFn: () => GetPointeuses.getAllWithParams(`${soccod}`),
  });
};

export default useGetPointeuses;
