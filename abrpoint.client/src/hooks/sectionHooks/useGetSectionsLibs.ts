import { useQuery } from "@tanstack/react-query";
import GetSectionsLibs from "../../services/SectionService/GetSectionsLibs";

const useGetSectionsLibs = () => {
  const soccod = sessionStorage.getItem('soccod');

  return useQuery({
    queryKey: ["sec-libs",soccod],
    queryFn: GetSectionsLibs.getAll
  });
};

export default useGetSectionsLibs;
