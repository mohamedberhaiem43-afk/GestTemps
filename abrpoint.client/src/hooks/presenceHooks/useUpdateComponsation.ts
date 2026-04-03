import { useMutation, useQueryClient } from 'react-query';
import apiInstance from '../../components/API/apiInstance';
interface Params {
  soccod: string;
  empcod: string;
  date: string;
  totcmp: number;
}
const updateCompensation = async ({ soccod, empcod, date, totcmp }: Params) => {
  const res = await apiInstance.put(`/Presences/update-compensation/${soccod}/${empcod}/${date}/${totcmp}`, null);
  return res.data;
};
export default function useUpdateCompensation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateCompensation,
    onSuccess: () => {
      // refresh tableau
      queryClient.invalidateQueries({ queryKey: ['empEtat'] });
    },
  });
}
