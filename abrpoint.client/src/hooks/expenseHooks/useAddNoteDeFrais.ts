import { useMutation, useQueryClient } from '@tanstack/react-query';
import NoteDeFraisService from '../../services/NoteDeFraisService';
import { NoteDeFraisRequest } from '../../models/NoteDeFrais';

export const useAddNoteDeFrais = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (request: NoteDeFraisRequest) => NoteDeFraisService.add(request),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['noteDeFrais', variables.soccod] });
            queryClient.invalidateQueries({ queryKey: ['noteDeFrais', variables.soccod, variables.empcod] });
        },
    });
};

export const useUpdateNoteDeFraisStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) => 
            NoteDeFraisService.updateStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['noteDeFrais'] });
        },
    });
};

export const useDeleteNoteDeFrais = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => NoteDeFraisService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['noteDeFrais'] });
        },
    });
};
