import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const isValidDate = (dateString: string): boolean => {
  if (!dateString) return true; // Allow empty date strings
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.getTime() >= new Date("1753-01-01T00:00:00Z").getTime();
};

const useGetContrats = (req: string, filters: { srvcod?: string; sitcod?: string; echdeb?: string; echfin?: string }) => {
  const token = localStorage.getItem("authToken");
  const headers = { Authorization: `Bearer ${token}` };
  const soccod = sessionStorage.getItem("soccod");

  const isQueryEnabled =
  !!soccod &&
  !!filters?.srvcod &&
  !!filters?.echdeb &&
  !!filters?.echfin &&
  isValidDate(filters?.echdeb || "") &&
  isValidDate(filters?.echfin || "");

  return useQuery({
    queryKey: ["contrats", req, soccod, filters],
    queryFn: async () => {
      try {
        const url = `${import.meta.env.VITE_REACT_APP_API_URL}/Contrats/${soccod}/${filters?.srvcod || ''}/${filters?.sitcod || ''}/${filters?.echdeb || ''}/${filters?.echfin || ''}`;
        const response = await axios.get(url, { headers });
        return response.data;
      } catch (error) {
        console.error("Error fetching contracts:", error);
        throw error;
      }
    },
    enabled:isQueryEnabled
  });
};

export default useGetContrats;
