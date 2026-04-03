import { useQuery } from 'react-query';
import EmpEtatService from '../../services/PersenceService/EmpEtatService';

interface UseGetEmpEtatParams {
  soccod: string | null;
  selectedEmpMat: string;
  dateRange: { dateDebut: Date; dateFin: Date } | null;
}

const useGetEmpEtat = ({ soccod, selectedEmpMat, dateRange }: UseGetEmpEtatParams) => {
  // Format dates to ISO strings
  const formatDate = (date: Date) => date.toISOString().replace('Z', '');

  const formattedDateDebut = dateRange?.dateDebut ? formatDate(new Date(dateRange.dateDebut)) : null;
  const formattedDateFin = dateRange?.dateFin ? formatDate(new Date(dateRange.dateFin)) : null;

  return useQuery({
    queryKey: [
      'emp-etat',
      soccod,
      selectedEmpMat,
      formattedDateDebut,
      formattedDateFin
    ],
    queryFn: () =>
      EmpEtatService.getAllWithParams(
        `emp-point-filtrer/${soccod}/${selectedEmpMat}/${formattedDateDebut}/${formattedDateFin}`
      ),
    enabled: !!soccod && !!selectedEmpMat && !!formattedDateDebut && !!formattedDateFin,
    staleTime: 1000 * 60 * 5, // 5 minutes - data is considered fresh
    cacheTime: 1000 * 60 * 30, // 30 minutes - keep in cache
    refetchInterval: 10000, // Refetch every 10 seconds (adjust as needed)
    refetchIntervalInBackground: true,
    retry: 2,
    onError: (error) => {
      console.error('Error fetching EmpEtat data:', error);
    }
  });
};

export default useGetEmpEtat;