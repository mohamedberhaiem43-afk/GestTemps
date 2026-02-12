import { useQuery } from "react-query";
import GetPaysLibs from "../../services/PaysService/GetPaysLibs";

const useGetPaysLibs = () => {

  return useQuery({
    queryKey: ["pays-libs"],
    queryFn: GetPaysLibs.getAll
  });
};

export default useGetPaysLibs;
