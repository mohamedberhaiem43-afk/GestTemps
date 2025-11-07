import { useQuery } from "@tanstack/react-query";
import GetSections from "../../services/SectionService/GetSections";

const useGetSections = () => {
  const soccod = sessionStorage.getItem('soccod');

  return useQuery({
    queryKey: ["sections",soccod],
    queryFn: GetSections.getAll
  });
};

export default useGetSections;
