import apiInstance from "../../components/API/apiInstance";
import { useMutation } from "react-query";
import { Conge } from "../../models/Conge";

const useAddConge = () => {
    return useMutation((conge: Conge) =>
        apiInstance.post(
            `/Conges`,
            conge
        ).then(res => res.data)
    );
};
export default useAddConge;