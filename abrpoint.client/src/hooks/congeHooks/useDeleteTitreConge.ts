import apiInstance from "../../components/API/apiInstance";
import { useMutation } from "@tanstack/react-query";
import { Conge } from "../../models/Conge";

const useDeleteTitreConge = () => {
    return useMutation({
        mutationFn: (conge: Conge) =>
            apiInstance.delete(`/Conges/${conge.soccod}/${conge.concod}`)
                .then(res => res.data),
    });
};

export default useDeleteTitreConge;
