import { useMutation } from '@tanstack/react-query';
import apiInstance from '../../components/API/apiInstance';

const useDeleteDemConge = () => {
  return useMutation({
    mutationFn: async ({ soccod, concod }: { soccod: string; concod: string }) => {
      const response = await apiInstance.delete(`/DemConges/${soccod}/${concod}`);
      return response.data;
    },
  });
};

export default useDeleteDemConge;
