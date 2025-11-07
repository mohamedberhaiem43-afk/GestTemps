import { useMutation } from '@tanstack/react-query';
import ApiClient from '../../services/apiClient';

export type PurgeParams = {
  soccod: string;
  poicod: string;
  ip: string;
  port?: number;
  pswd?: number;
};


const client = new ApiClient<any>('/Pointeuse');

const usePurgePointeuse = () => {
  return useMutation({
    mutationFn: (params: PurgeParams) => client.purgePointeuseApi(params),
  });
};

export default usePurgePointeuse;
