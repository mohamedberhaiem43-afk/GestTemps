import apiInstance from "../../components/API/apiInstance";
import { useMutation, useQueryClient } from "react-query";
import { Absence } from "../../models/Absence";

const useAddAbsence = () => {
    const queryClient = useQueryClient(); // Access the QueryClient for cache updates

    return useMutation(
        (absence: Absence) =>
            apiInstance
                .post(
                    `/Absences`,
                    absence
                )
                .then(res => res.data),
        {
            onSuccess: (variables) => {
                const soccod = sessionStorage.getItem("soccod");

                // Update the cache directly
                queryClient.setQueryData(['repos', soccod], (oldData: Absence[] | undefined) =>
                    oldData ? [...oldData, variables] : [variables]
                );

                // Alternatively, invalidate the cache to refetch data
                // queryClient.invalidateQueries(['repos', soccod]);
            },
            onError: (err) => {
                console.error("Error adding new data:", err);
            },
        }
    );
};

export default useAddAbsence;
