import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import GetQualification from "../../services/QualificationService/GetQualification";

const useGetQualifications = () => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["qualifications",soccod],
    queryFn:()=> GetQualification.getAllWithParams(`${soccod}`),
    enabled: !!soccod ,
  });
};

export default useGetQualifications;
