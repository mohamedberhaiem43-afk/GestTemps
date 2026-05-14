import apiInstance from "../../components/API/apiInstance";
import { useMutation } from "@tanstack/react-query";

const useAddBulkConges = () => {
    return useMutation({
        mutationFn: (conge: any) =>
            apiInstance.post(`/Conges/bulk`, conge).then(res => res.data),
    });
};

export default useAddBulkConges;
