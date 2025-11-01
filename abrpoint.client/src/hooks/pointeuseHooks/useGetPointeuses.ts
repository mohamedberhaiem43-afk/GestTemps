import { useQuery } from "@tanstack/react-query";
import GetPointeuses from "../../services/PointeuseService/GetPointeuses";

const useGetPointeuses = () => {
  const soccod = sessionStorage.getItem('soccod');

  return useQuery({
    queryKey: ["pointeuses",soccod],
    queryFn: GetPointeuses.getAll
  });
};

export default useGetPointeuses;
