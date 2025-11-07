import axios from "axios";
import { useMutation } from "react-query";
import { NewContractData } from "../../components/gestionEmploye/GestionContrats/Renouvellement/FiltrageRenouvellement";

const useRenouvellementContrat = () => {
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };
    
    return useMutation((contrat:NewContractData) =>
            axios
                .post(
                    `${import.meta.env.VITE_REACT_APP_API_URL}/Contrats`,
                    contrat,
                    { headers }
                )
                .then(res => res.data),
        
    );
};

export default useRenouvellementContrat;
