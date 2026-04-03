import { useQuery } from "react-query";
import PointdroitsService from "../../services/PointeuseService/PointdroitsService";

const useGetPoidroits = (uticod: string | null) => {
  const soccod = sessionStorage.getItem('soccod');

return useQuery({
  queryKey: ["pointdroits", soccod, uticod],
  queryFn: () => {
    return PointdroitsService.getAllWithParams(`${soccod}/${uticod}`);
  },
  enabled: !!uticod,
});

};

export default useGetPoidroits;
