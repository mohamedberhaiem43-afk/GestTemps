import { useQuery } from "react-query";
import ModuserService from "../../services/ModuserService/ModuserService";

const useGetModusers = () => {
  return useQuery({
    queryKey: ["modusers"],
    queryFn: () => ModuserService.getAllWithParams('get-modusers'),
  });
};

export default useGetModusers;
