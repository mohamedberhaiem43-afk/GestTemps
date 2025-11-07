import { useQuery } from "@tanstack/react-query";
import ModuleService from "../../services/ModuleService/ModuleService";

const useGetModules = () => {
  return useQuery({
    queryKey: ["modules"],
    queryFn: () => ModuleService.getAllWithParams('get-modules'),
  });
};

export default useGetModules;
