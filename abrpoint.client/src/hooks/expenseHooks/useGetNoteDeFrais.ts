import { useQuery } from '@tanstack/react-query';
import NoteDeFraisService from '../../services/NoteDeFraisService';

export const useGetNoteDeFraisByEmp = (soccod: string, empcod: string) => {
    return useQuery({
        queryKey: ['noteDeFrais', soccod, empcod],
        queryFn: () => NoteDeFraisService.getByEmp(soccod, empcod),
        enabled: !!soccod && !!empcod,
    });
};

export const useGetNoteDeFraisBySoc = (soccod: string) => {
    return useQuery({
        queryKey: ['noteDeFrais', soccod],
        queryFn: () => NoteDeFraisService.getBySoc(soccod),
        enabled: !!soccod,
    });
};
