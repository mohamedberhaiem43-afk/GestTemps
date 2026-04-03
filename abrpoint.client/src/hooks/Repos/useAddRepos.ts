import apiInstance from "../../components/API/apiInstance";
import { useMutation } from "react-query";
import { Ferier } from "../../models/Ferier";

const useAddRepos = () => {
    return useMutation((ferier: Ferier) =>
            apiInstance
                .post(
                    `/Feriers`,
                    ferier
                )
                .then(res => res.data),

    );
};

export default useAddRepos;
