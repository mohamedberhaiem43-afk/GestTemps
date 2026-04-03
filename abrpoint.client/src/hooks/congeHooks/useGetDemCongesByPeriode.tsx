import { useQuery } from "react-query";
import { useAuth } from "../../components/helper/AuthProvider";
import apiInstance from "../../components/API/apiInstance";

const useGetDemCongesByPeriode = (datedebut: string, datefin: string, enabled: boolean = true) => {
    const { soccod, uticod } = useAuth();

    return useQuery({
        queryKey: ["demconges", soccod, uticod, datedebut, datefin],
        queryFn: async () => {
            const encodedDateDebut = encodeURIComponent(datedebut);
            const encodedDateFin = encodeURIComponent(datefin);
            const response = await apiInstance.get(
                `/DemConges/get-demconge-by-periode/${soccod}/${uticod}/${encodedDateDebut}/${encodedDateFin}`
            );
            return response.data;
        },
        enabled: enabled && !!soccod && !!uticod
    })
};

export default useGetDemCongesByPeriode;
