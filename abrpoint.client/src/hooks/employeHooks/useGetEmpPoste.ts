import { useQuery } from "@tanstack/react-query";
import PosteService from "../../services/PosteService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetEmployePosteByDate = (empcod:string,date:any,day:string) => {
    console.log(date);
  const { soccod } = useAuth();
  return useQuery({
    queryKey: ["postes", soccod,empcod,day],
    queryFn: () => PosteService.getWithParams(`get-employe-poste-by-date/${soccod}/${empcod}/${date}/${day}`),
    enabled: !!soccod && !! date && !!day,
  });
};

export default useGetEmployePosteByDate;
