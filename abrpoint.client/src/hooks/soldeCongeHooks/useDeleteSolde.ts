import apiInstance from "../../components/API/apiInstance";
import { useMutation } from "react-query";
import { Solde } from "../../models/Solde";

const useDeleteSolde= () => {
    return useMutation((solde:Solde) =>
        apiInstance.delete(
            `/Soldes/${solde.soccod}/${solde.empcod}`
        ).then(res=>res.data)
    );
};
export default useDeleteSolde