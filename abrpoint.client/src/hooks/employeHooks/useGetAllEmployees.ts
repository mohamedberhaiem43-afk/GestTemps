import { useQuery } from "@tanstack/react-query";
import EmployeService from "../../services/EmployeService/EmployeService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetAllEmployees = (uticod: string | null) => {
  const { soccod } = useAuth();


  return useQuery({
    queryKey: ["employees", soccod],
    queryFn:()=> EmployeService.getAllWithParams(`${soccod}/${uticod}`),
  });
};

export default useGetAllEmployees;
