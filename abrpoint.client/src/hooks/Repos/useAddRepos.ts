import apiInstance from "../../components/API/apiInstance";
import { useMutation } from "@tanstack/react-query";
import { Ferier } from "../../models/Ferier";

const useAddRepos = () => {
    return useMutation({
        mutationFn: (ferier: Ferier) =>
            apiInstance.post(`/Feriers`, ferier).then(res => res.data),
    });
};

export default useAddRepos;
