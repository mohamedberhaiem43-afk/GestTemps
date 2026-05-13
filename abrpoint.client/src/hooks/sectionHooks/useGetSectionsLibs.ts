import { useQuery } from "@tanstack/react-query";
import GetSectionsLibs from "../../services/SectionService/GetSectionsLibs";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetSectionsLibs = () => {
  const { soccod } = useAuth();

  return useQuery({
    queryKey: ["sec-libs",soccod],
    queryFn: GetSectionsLibs.getAll
  });
};

export default useGetSectionsLibs;
