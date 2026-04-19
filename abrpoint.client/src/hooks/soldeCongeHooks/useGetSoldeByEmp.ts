import { useQuery } from "react-query";
import apiInstance from "../../components/API/apiInstance";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetSoldeByEmp = (empcod: string) => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["solde-emp", soccod, empcod],
    queryFn: async () => {
      const res = await apiInstance.get(`/Soldes/by-emp/${soccod}/${empcod}`);
      return res.data;
    },
    enabled: !!soccod && !!empcod,
  });
};

export default useGetSoldeByEmp;
