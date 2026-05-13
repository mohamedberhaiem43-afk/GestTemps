import { useQuery } from "@tanstack/react-query";
import GetSections from "../../services/SectionService/GetSections";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetSections = () => {
  const { soccod } = useAuth()

  return useQuery({
    queryKey: ["sections",soccod],
    queryFn: GetSections.getAll
  });
};

export default useGetSections;
