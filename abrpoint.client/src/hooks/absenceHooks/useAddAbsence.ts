import apiInstance from "../../components/API/apiInstance";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Absence } from "../../models/Absence";

const useAddAbsence = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (absence: Absence) =>
            apiInstance.post(`/Absences`, absence).then(res => res.data),
        onSuccess: () => {
            const soccod = sessionStorage.getItem("soccod");
            queryClient.invalidateQueries({ queryKey: ['absences', soccod] });
            queryClient.invalidateQueries({ queryKey: ['all-absences', soccod] });
            queryClient.invalidateQueries({ queryKey: ['missions', 'natures', soccod] });
        },
        onError: (err) => {
            console.error("Error adding new data:", err);
        },
    });
};

export default useAddAbsence;
