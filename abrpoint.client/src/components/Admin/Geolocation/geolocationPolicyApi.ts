import apiInstance from '../../API/apiInstance';

export interface GeolocationPolicy {
  enabledForClockIn: boolean;
  enabledForMissions: boolean;
  windowStartTime: string;
  windowEndTime: string;
  allowedDays: string;
  updatedAt: string;
  updatedBy: string | null;
}

export const GeolocationPolicyApi = {
  get: async (): Promise<GeolocationPolicy> => {
    const res = await apiInstance.get('/admin/geolocation-policy');
    return res.data;
  },
  update: async (input: Omit<GeolocationPolicy, 'updatedAt' | 'updatedBy'>): Promise<GeolocationPolicy> => {
    const res = await apiInstance.put('/admin/geolocation-policy', input);
    return res.data;
  },
};
