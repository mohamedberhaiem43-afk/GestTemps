import apiInstance from "../../components/API/apiInstance";
import { useMutation } from "react-query";

const useAddBulkConges = () => {
    return useMutation((conge:any) =>
        apiInstance.post(
            `/Conges/bulk`,
            conge
        ).then(res=>res.data)
    );
};
export default useAddBulkConges;