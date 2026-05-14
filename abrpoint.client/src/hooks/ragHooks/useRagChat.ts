import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import RagService from '../../services/RagService';

const KEY_AUDIT = ['rag', 'audit'];

export const useAskRag = () =>
  useMutation({
    mutationFn: (req: { question: string; topK?: number }) =>
      RagService.ask(req.question, req.topK ?? 5),
  });

export const useRagFeedback = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: { logId: number; score: number; comment?: string }) =>
      RagService.feedback(req.logId, req.score, req.comment),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_AUDIT }),
  });
};

export const useRagAudit = (skip = 0, take = 50) =>
  useQuery({
    queryKey: [...KEY_AUDIT, skip, take],
    queryFn: () => RagService.audit(skip, take),
    placeholderData: keepPreviousData,
  });
