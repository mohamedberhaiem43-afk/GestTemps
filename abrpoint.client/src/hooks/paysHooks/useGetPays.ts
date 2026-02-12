import { useQuery } from "react-query";
import GetPays from "../../services/PaysService/GetPays";
import { PaysModel } from "../../models/Pays";

const useGetPays = () => {

  return useQuery<PaysModel[]>({
    queryKey: ["pays"],
    queryFn: GetPays.getAll
  });
};

export default useGetPays;
