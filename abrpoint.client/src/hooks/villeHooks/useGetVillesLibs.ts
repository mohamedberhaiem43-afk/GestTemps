import { useQuery } from "react-query";
import GetVillesLibs from "../../services/VilleService/GetVillesLibs";

const useGetVillesLibs = () => {

  return useQuery({
    queryKey: ["villibs"],
    queryFn: GetVillesLibs.getAll
  });
};

export default useGetVillesLibs;
