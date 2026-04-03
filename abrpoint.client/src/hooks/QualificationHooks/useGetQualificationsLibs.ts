import { useQuery } from "react-query";
import GetQualificationLibs from "../../services/QualificationService/GetQualificationLibs";
import { useAuth } from "../../components/helper/AuthProvider";



const useGetQualificationsLibs = () => {
  const { soccod } = useAuth();
    return useQuery({
      queryKey:["qualifs", soccod], 
      queryFn:() => GetQualificationLibs.getAllWithParams(`${soccod}`),
});
};
export default useGetQualificationsLibs;
