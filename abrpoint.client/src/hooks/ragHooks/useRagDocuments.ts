import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import RagService from '../../services/RagService';

const KEY_DOCS = ['rag', 'documents'];
const KEY_HEALTH = ['rag', 'health'];

export const useRagDocuments = () =>
  useQuery({
    queryKey: KEY_DOCS,
    queryFn: () => RagService.list(),
    // Auto-refresh tant qu'au moins un doc est en pending — l'indexation peut prendre 30-60 s.
    refetchInterval: (query) => {
      const data = query.state.data;
      return Array.isArray(data) && data.some((d: any) => d.status === 'pending') ? 5000 : false;
    },
  });

export const useRagHealth = () =>
  useQuery({
    queryKey: KEY_HEALTH,
    queryFn: () => RagService.health(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

export const useUploadRagDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, category }: { file: File; category: string }) =>
      RagService.upload(file, category),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_DOCS }),
  });
};

export const useDeleteRagDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => RagService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_DOCS }),
  });
};

export const useReindexRagDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => RagService.reindex(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_DOCS }),
  });
};
