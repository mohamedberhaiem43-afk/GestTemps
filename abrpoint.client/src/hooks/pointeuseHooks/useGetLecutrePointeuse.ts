import { useQuery } from "@tanstack/react-query";
import GetPointeuses from "../../services/PointeuseService/GetPointeuses";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetLecturePointeuses = () => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["pointeuses",soccod],
    queryFn: () => GetPointeuses.getAllWithParams(`lecture-pointeuse/${soccod}`),
  });
};

export default useGetLecturePointeuses;
