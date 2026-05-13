import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import NoteDeFraisService from "../../services/NoteDeFraisService";

const useGetAllNotesDeFrais = () => {
    const { soccod, isEmp } = useAuth();

    return useQuery({
        queryKey: ["allNotesDeFrais", soccod],
        queryFn: async () => {
            if (isEmp) return [];
            return await NoteDeFraisService.getBySoc(soccod || '');
        },
        enabled: !!soccod && !isEmp,
        refetchInterval: 30000, // Refetch every 30 seconds for real-time notifications
        refetchOnWindowFocus: true,
        staleTime: 1000 * 60 * 2, // 2 minutes stale time
    });
};

export default useGetAllNotesDeFrais;