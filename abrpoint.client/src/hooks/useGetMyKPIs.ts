import { useQuery } from 'react-query';
import ApiClient from '../services/apiClient';

export interface EmployeeKpi {
  soldeConge: number;
  congeAcquis: number;
  heuresTravailleesSemaine: number;
  objectifHebdomadaire: number;
  pourcentageObjectif: number;
  demandesEnAttente: number;
  suiviPointageSemaine: Record<string, number>;
  suiviPointageMois: Record<string, number>;
  emplib: string;
  empcod: string;
  empreg: string;
}

const employeApi = new ApiClient<EmployeeKpi>('/Employes');

const useGetMyKPIs = (soccod: string | undefined | null, uticod: string | undefined | null) => {
  return useQuery({
    queryKey: ['myKPIs', soccod, uticod],
    queryFn: () => employeApi.getWithParams(`get-my-kpis/${soccod}/${uticod}`),
    enabled: !!soccod && !!uticod,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
};

export default useGetMyKPIs;