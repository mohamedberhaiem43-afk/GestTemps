import apiInstance from '../components/API/apiInstance';
import { NoteDeFrais, NoteDeFraisRequest } from '../models/NoteDeFrais';

const API_URL = '/NoteDeFrais';

const NoteDeFraisService = {
    getBySoc: async (soccod: string): Promise<NoteDeFrais[]> => {
        const response = await apiInstance.get(`${API_URL}/by-soc/${soccod}`);
        return response.data;
    },

    getByEmp: async (soccod: string, empcod: string): Promise<NoteDeFrais[]> => {
        const response = await apiInstance.get(`${API_URL}/by-emp/${soccod}/${empcod}`);
        return response.data;
    },

    add: async (request: NoteDeFraisRequest): Promise<NoteDeFrais> => {
        const formData = new FormData();
        formData.append('soccod', request.soccod);
        formData.append('empcod', request.empcod);
        formData.append('titre', request.titre);
        formData.append('categorie', request.categorie);
        formData.append('montant', request.montant.toString());
        if (request.projet) formData.append('projet', request.projet);
        formData.append('dateDepense', request.dateDepense);
        if (request.file) formData.append('file', request.file);

        const response = await apiInstance.post(`${API_URL}/add`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    updateStatus: async (id: number, status: string): Promise<NoteDeFrais> => {
        const response = await apiInstance.put(`${API_URL}/update-status/${id}/${status}`);
        return response.data;
    },

    delete: async (id: number): Promise<void> => {
        await apiInstance.delete(`${API_URL}/${id}`);
    }
};

export default NoteDeFraisService;
