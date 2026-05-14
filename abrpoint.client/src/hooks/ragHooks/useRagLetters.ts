import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import RagService from '../../services/RagService';
import {
  RagLetterTemplateUpsert,
  RagLetterGenerateRequest,
} from '../../models/RagLetterTemplate';

const KEY = ['rag', 'letters'];

export const useLetterTemplates = () =>
  useQuery({ queryKey: KEY, queryFn: () => RagService.listTemplates() });

export const useCreateLetterTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: RagLetterTemplateUpsert) => RagService.createTemplate(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useUpdateLetterTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, req }: { id: number; req: RagLetterTemplateUpsert }) =>
      RagService.updateTemplate(id, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useDeleteLetterTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => RagService.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useGenerateLetter = () =>
  useMutation({ mutationFn: (req: RagLetterGenerateRequest) => RagService.generateLetter(req) });
