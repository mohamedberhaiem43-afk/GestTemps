import { useQuery } from "react-query";
import CahierCongeService from "../../services/CongeService/CahierCongeService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetCahierConge = (datedebut:Date,datefin:Date,empcods:string[]|null) => {
  const { soccod } = useAuth();
  const queryParams = new URLSearchParams();
  empcods?.forEach(code => queryParams.append("empcods", code));
  const queryString = queryParams.toString();

  const formatDate = (date: Date) => date.toISOString().split('T')[0]; // yyyy-MM-dd
  const formattedDebut = formatDate(datedebut)+"T00:00:00";
  const formattedFin = formatDate(datefin)+"T00:00:00";
  return useQuery({
    queryKey: ["cahier-conge", soccod,datedebut, datefin,empcods],
    queryFn: () => CahierCongeService.getAllWithParams(`get-cahier-conge/${soccod}/${formattedDebut}/${formattedFin}?${queryString}`),
    enabled: !!soccod && !!datedebut && !!datefin && !!empcods,
  });
};

export default useGetCahierConge;
