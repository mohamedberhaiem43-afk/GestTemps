import { useQuery } from 'react-query';
import EmpEtatService from '../../services/PersenceService/EmpEtatService';

interface UseGetEmpEtatParams {
  soccod: string | null;
  selectedEmpMat: string;
  dateRange: { dateDebut: Date; dateFin: Date } | null;
}

const useGetEmpEtat = ({ soccod, selectedEmpMat, dateRange }: UseGetEmpEtatParams) => {
  // Format dates to local ISO strings (avoiding timezone shifts from toISOString)
  const formatDateToLocal = (date: Date): string => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  const formattedDateDebut = dateRange?.dateDebut ? formatDateToLocal(new Date(dateRange.dateDebut)) : null;
  const formattedDateFin = dateRange?.dateFin ? formatDateToLocal(new Date(dateRange.dateFin)) : null;

  return useQuery({
    queryKey: [
      'emp-etat',
      soccod,
      selectedEmpMat,
      formattedDateDebut,
      formattedDateFin
    ],
    queryFn: async () => {
      const encodedDebut = encodeURIComponent(formattedDateDebut!);
      const encodedFin = encodeURIComponent(formattedDateFin!);
      return EmpEtatService.getAllWithParams(
        `emp-point-filtrer/${soccod}/${selectedEmpMat}/${encodedDebut}/${encodedFin}`
      );
    },
    enabled: !!soccod && !!selectedEmpMat && !!formattedDateDebut && !!formattedDateFin,
    staleTime: 1000 * 60 * 5, // 5 minutes - data is considered fresh
    cacheTime: 1000 * 60 * 30, // 30 minutes - keep in cache
    retry: 2,
    refetchOnWindowFocus: true,
  });
};

export default useGetEmpEtat;
