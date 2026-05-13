import { useQuery } from "@tanstack/react-query";
import GetFonctionLibs from "../../services/FonctionService/GetFonctionLibs";

const useGetFonctionsLibs = () => {
    return useQuery({
      queryKey:["fonlibs"], 
      queryFn:GetFonctionLibs.getAll,
});
};

export default useGetFonctionsLibs;
