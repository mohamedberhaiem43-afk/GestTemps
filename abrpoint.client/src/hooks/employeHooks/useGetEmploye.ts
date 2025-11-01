import { useQuery } from "@tanstack/react-query";
import EmployeService from "../../services/EmployeService/EmployeService";

const useGetEmloye = (empcod:string) => {
  const soccod = sessionStorage.getItem('soccod');

  return useQuery({
    queryKey: ["employe", soccod,empcod],
    queryFn: () => EmployeService.getAllWithParams(`${soccod}/${empcod}`),
    enabled: !!soccod && !!empcod && empcod!='null',
  });
};

export default useGetEmloye;
