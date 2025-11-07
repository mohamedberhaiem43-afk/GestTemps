import { useQuery } from "@tanstack/react-query";
import EmployeService from "../../services/EmployeService/EmployeService";

const useGetAllEmployees = (soccod: string | null, uticod: string | null) => {
  


  return useQuery({
    queryKey: ["employees", soccod],
    queryFn:()=> EmployeService.getAllWithParams(`${soccod}/${uticod}`),
  });
};

export default useGetAllEmployees;
