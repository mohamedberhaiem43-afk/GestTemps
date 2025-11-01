import { useQuery } from "@tanstack/react-query";
import GetQualificationLibs from "../../services/QualificationService/GetQualificationLibs";



const useGetQualificationsLibs = () => {
    return useQuery({
      queryKey:["qualifs"], 
      queryFn:GetQualificationLibs.getAll,
});
};

export default useGetQualificationsLibs;
