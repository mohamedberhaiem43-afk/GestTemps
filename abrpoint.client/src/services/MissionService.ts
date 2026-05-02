import apiInstance from '../components/API/apiInstance';
import { Mission, MissionUpsertRequest, FormationMissionNature } from '../models/Mission';

const API_URL = '/Missions';

const MissionService = {
  getBySoc: async (soccod: string): Promise<Mission[]> => {
    const res = await apiInstance.get(`${API_URL}/by-soc/${soccod}`);
    return res.data;
  },
  getByEmp: async (soccod: string, empcod: string): Promise<Mission[]> => {
    const res = await apiInstance.get(`${API_URL}/by-emp/${soccod}/${empcod}`);
    return res.data;
  },
  getById: async (id: number): Promise<Mission> => {
    const res = await apiInstance.get(`${API_URL}/${id}`);
    return res.data;
  },
  getFormationMissionNatures: async (soccod: string): Promise<FormationMissionNature[]> => {
    const res = await apiInstance.get(`${API_URL}/natures-formation-mission/${soccod}`);
    return res.data;
  },
  create: async (req: MissionUpsertRequest): Promise<Mission> => {
    const res = await apiInstance.post(API_URL, req);
    return res.data;
  },
  update: async (id: number, req: MissionUpsertRequest): Promise<Mission> => {
    const res = await apiInstance.put(`${API_URL}/${id}`, req);
    return res.data;
  },
  remove: async (id: number): Promise<void> => {
    await apiInstance.delete(`${API_URL}/${id}`);
  },
};

export default MissionService;
