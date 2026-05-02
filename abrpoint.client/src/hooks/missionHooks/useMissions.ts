import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import MissionService from '../../services/MissionService';
import { MissionUpsertRequest } from '../../models/Mission';

export const useMissionsBySoc = (soccod: string | null | undefined) =>
  useQuery({
    queryKey: ['missions', 'soc', soccod],
    queryFn: () => MissionService.getBySoc(soccod!),
    enabled: !!soccod,
  });

export const useMissionsByEmp = (soccod: string | null | undefined, empcod: string | null | undefined) =>
  useQuery({
    queryKey: ['missions', 'emp', soccod, empcod],
    queryFn: () => MissionService.getByEmp(soccod!, empcod!),
    enabled: !!soccod && !!empcod,
  });

export const useFormationMissionNatures = (soccod: string | null | undefined) =>
  useQuery({
    queryKey: ['missions', 'natures', soccod],
    queryFn: () => MissionService.getFormationMissionNatures(soccod!),
    enabled: !!soccod,
  });

export const useCreateMission = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: MissionUpsertRequest) => MissionService.create(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['missions'] }),
  });
};

export const useUpdateMission = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, req }: { id: number; req: MissionUpsertRequest }) => MissionService.update(id, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['missions'] }),
  });
};

export const useDeleteMission = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => MissionService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['missions'] }),
  });
};
