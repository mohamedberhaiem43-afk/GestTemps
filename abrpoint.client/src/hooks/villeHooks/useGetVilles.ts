import { useQuery } from "react-query";
import GetVilles from "../../services/VilleService/GetVilles";

const useGetVilles = () => {

  return useQuery({
    queryKey: ["villes"],
    queryFn: GetVilles.getAll
  });
};

export default useGetVilles;
