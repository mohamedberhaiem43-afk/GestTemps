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
            onSuccess: () => {
                const soccod = sessionStorage.getItem("soccod");
                // Invalide toutes les listes d'absences consommées ailleurs : la liste
                // principale (IntituleDesAbsenceList), la version "all-absences" et la
                // combo box "nature mission" (Abscng='6') de la page Missions.
                // Avant : seul `['repos', soccod]` était modifié → la nouvelle nature
                // n'apparaissait dans le dropdown mission qu'après un refresh manuel.
                queryClient.invalidateQueries(['absences', soccod]);
                queryClient.invalidateQueries(['all-absences', soccod]);
                queryClient.invalidateQueries(['missions', 'natures', soccod]);
            },
            onError: (err) => {
                console.error("Error adding new data:", err);
            },
        }
    );
};

export default useAddAbsence;
