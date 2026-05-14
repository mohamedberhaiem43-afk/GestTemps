import apiInstance from "../../components/API/apiInstance";
import { useMutation } from "@tanstack/react-query";
import { Ferier } from "../../models/Ferier";

const useDeleteRepos = () => {
    return useMutation({
        mutationFn: (ferier: Ferier) =>
            apiInstance.delete(`/Feriers/${ferier.soccod}/${ferier.ferdate}`)
                .then(res => res.data),
    });
};

export default useDeleteRepos;
