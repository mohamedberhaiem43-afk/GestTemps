import { useQuery } from "react-query";
import apiInstance from "../../components/API/apiInstance";
import { useAuth } from "../../components/helper/AuthProvider";

const isValidDate = (dateString: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.getTime() >= new Date("1753-01-01T00:00:00Z").getTime();
};

const useGetContrats = (req: string, filters?: { srvcod?: string; sitcod?: string; echdeb?: string; echfin?: string }) => {
  const { soccod, uticod } = useAuth();
  const normalizedFilters = {
    srvcod: filters?.srvcod || undefined,
    sitcod: filters?.sitcod || undefined,
    echdeb: isValidDate(filters?.echdeb || "") ? filters?.echdeb : undefined,
    echfin: isValidDate(filters?.echfin || "") ? filters?.echfin : undefined,
  };

  return useQuery({
    queryKey: ["contrats", req, soccod, uticod, normalizedFilters],
    queryFn: async () => {
      try {
        const response = await apiInstance.get("/Contrats/search", {
          params: {
            soccod,
            uticod,
            ...normalizedFilters,
          },
        });
        return response.data;
      } catch (error) {
        console.error("Error fetching contracts:", error);
        throw error;
      }
    },
    enabled: !!filters && !!soccod && !!uticod,
  });
};

export default useGetContrats;