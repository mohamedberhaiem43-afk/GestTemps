import { useQuery } from 'react-query';
import apiInstance from '../../components/API/apiInstance';

interface ExpiringContract {
  concod: string;
  empcod: string;
  emplib: string;
  empsort: string;
  contype: string;
  empemb: string;
}

const useGetExpiringContracts = (soccod: string | null) => {
  return useQuery<ExpiringContract[]>(
    ['expiring-contracts', soccod],
    async () => {
      if (!soccod) return [];
      const { data } = await apiInstance.get(`/Contrats/expiring/${soccod}`);
      return data;
    },
    { enabled: !!soccod, staleTime: 5 * 60 * 1000 }
  );
};

export default useGetExpiringContracts;
export type { ExpiringContract };