import { useQuery } from "@tanstack/react-query";
import EmployeService from "../../services/EmployeService/EmployeService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetEmloye = (empcod:string) => {
  const soccod = useAuth();

  return useQuery({
    queryKey: ["employe", soccod,empcod],
    queryFn: () => EmployeService.getAllWithParams(`${soccod}/${empcod}`),
    enabled: !!soccod && !!empcod && empcod!='null',
  });
};

export default useGetEmloye;
