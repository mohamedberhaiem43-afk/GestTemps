import { useMutation } from '@tanstack/react-query';
import apiInstance from '../../components/API/apiInstance';

export interface EtatGlobalRow {
  empmat: string;
  emplib: string;
  empreg: string;
  jourtrv: number;
  tothre: string;
  jferier: number;
  jftrv: number;
  hftrv: string;
  hnuit: string;
  jconge: number;
  hs50: string;
  hs25: string;
  csf: string;
}

interface EtatGlobalParams {
  soccod: string;
  soclib?: string;
  datedebut: string;
  datefin: string;
  data: EtatGlobalRow[];
}

// Appelle l'endpoint serveur /Presences/etat-global qui rend le PDF FastReport
// (template Reports/EtatGlobalPresence.frx). Utilisé pour imprimer le récapitulatif
// de l'écran « État périodique » quand aucun employé n'est sélectionné — remplace
// la génération jsPDF locale par le vrai rapport FastReport.
const useGenerateEtatGlobal = () => {
  return useMutation({
    mutationFn: async (params: EtatGlobalParams) => {
      const payload = {
        soccod: params.soccod,
        soclib: params.soclib ?? '',
        datedebut: params.datedebut,
        datefin: params.datefin,
        data: params.data,
      };
      const response = await apiInstance.post(
        `/Presences/etat-global`,
        payload,
        { responseType: 'blob' },
      );
      return response.data as Blob;
    },
  });
};

export default useGenerateEtatGlobal;
