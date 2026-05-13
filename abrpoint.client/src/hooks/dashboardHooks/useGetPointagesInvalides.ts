import { useQuery } from '@tanstack/react-query';
import { DashboardRequest, PointageInvalideDto } from '../../models/DashboardModels';
import apiInstance from '../../components/API/apiInstance';

const useGetPointagesInvalides = (
  request: DashboardRequest | null,
  enabled: boolean = true
) => {

  return useQuery<PointageInvalideDto[]>({
    queryKey: ['pointages-invalides', request?.soccod, request?.dateDebut, request?.dateFin, request?.departement],
    queryFn: async () => {
      if (!request) return [];
      const response = await apiInstance.post(
        '/Dashboard/get-pointage-invalides',
        request
      );
      return response.data;
    },
    enabled: !!request && !!request.soccod && !!request.dateDebut && !!request.dateFin && enabled,
    retry: false,
  });
};

export default useGetPointagesInvalides;
