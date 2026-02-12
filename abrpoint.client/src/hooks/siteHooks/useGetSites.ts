import { useQuery } from "react-query";
import GetFiliales from "../../services/FilialeService/GetFiliales";

const useGetSites = () => {
  

  return useQuery({
    queryKey: ["sites"],
    queryFn: GetFiliales.getAll
  });
};

export default useGetSites;
