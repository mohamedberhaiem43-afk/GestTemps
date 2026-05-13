import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import apiInstance from "../../components/API/apiInstance";

const useGetPendingDemCongesByPeriode = (datedebut: string, datefin: string, enabled: boolean = true) => {
    const { soccod, uticod } = useAuth();

    return useQuery({
        queryKey: ["pending-demconges", soccod, uticod, datedebut, datefin],
        queryFn: async () => {
            const encodedDateDebut = encodeURIComponent(datedebut);
            const encodedDateFin = encodeURIComponent(datefin);
            const response = await apiInstance.get(
                `/DemConges/get-pending-demconge-by-periode/${soccod}/${uticod}/${encodedDateDebut}/${encodedDateFin}`
            );
            return response.data;
        },
        enabled: enabled && !!soccod && !!uticod
    })
};

export default useGetPendingDemCongesByPeriode;
