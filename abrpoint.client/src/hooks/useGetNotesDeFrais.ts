import { useQuery } from "react-query";
import { useAuth } from "../components/helper/AuthProvider";
import NoteDeFraisService from "../services/NoteDeFraisService";

const useGetNotesDeFrais = () => {
    const { soccod, uticod, isEmp } = useAuth();

    return useQuery({
        queryKey: ["notesDeFrais", soccod, uticod, isEmp],
        queryFn: async () => {
            if (!isEmp) return [];
            return await NoteDeFraisService.getByEmp(soccod || '', uticod || '');
        },
        enabled: !!soccod && !!uticod && isEmp,
        refetchInterval: 30000, // Refetch every 30 seconds for real-time notifications
        refetchOnWindowFocus: true,
        staleTime: 1000 * 60 * 2, // 2 minutes stale time
    });
};

export default useGetNotesDeFrais;
