import { useQuery } from "react-query";
import PosteService from "../../services/PosteService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetEmployePosteByDate = (empcod:string,date:any,day:string) => {
  const { soccod } = useAuth();
  return useQuery({
  queryKey: ["postes", soccod, empcod, day, date],
  queryFn: () =>
    PosteService.getWithParams(
      `get-employe-poste-by-date/${soccod}/${empcod}/${date}/${day}`
    ),
  enabled: !!soccod && !!date && !!day && !!empcod,
});

};

export default useGetEmployePosteByDate;
