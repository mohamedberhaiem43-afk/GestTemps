import axios from "axios";
import { useMutation, useQueryClient } from "react-query";
import { Absence } from "../../models/Absence";

const useAddAbsence = () => {
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };
    const queryClient = useQueryClient(); // Access the QueryClient for cache updates
    
    return useMutation(
        (absence: Absence) =>
            axios
                .post(
                    `${import.meta.env.VITE_REACT_APP_API_URL}/Absences`,
                    absence,
                    { headers }
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
