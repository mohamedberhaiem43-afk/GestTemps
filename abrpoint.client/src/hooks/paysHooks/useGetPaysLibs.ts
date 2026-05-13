import { useQuery } from "@tanstack/react-query";
import GetPaysLibs from "../../services/PaysService/GetPaysLibs";

const useGetPaysLibs = () => {

  return useQuery({
    queryKey: ["pays-libs"],
    queryFn: GetPaysLibs.getAll
  });
};

export default useGetPaysLibs;
