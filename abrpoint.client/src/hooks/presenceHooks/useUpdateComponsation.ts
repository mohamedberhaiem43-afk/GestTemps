import { useMutation, useQueryClient } from 'react-query';
import axios from 'axios';

interface Params {
  soccod: string;
  empcod: string;
  date: string;
  totcmp: number;
}

const updateCompensation = async ({ soccod, empcod, date, totcmp }: Params) => {
    const token = sessionStorage.getItem('authToken');
    const headers = {
      Authorization: `Bearer ${token}`,
    };
  const res = await axios.put(
    `${import.meta.env.VITE_REACT_APP_API_URL}/Presences/update-compensation/${soccod}/${empcod}/${date}/${totcmp}`,
    null,
    { headers }
  );
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
