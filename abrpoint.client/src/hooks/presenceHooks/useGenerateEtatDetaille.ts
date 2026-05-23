import { useMutation } from '@tanstack/react-query';
import apiInstance from '../../components/API/apiInstance';
import EmpEtat from '../../models/EmpEtat';

interface EtatDetailleParams {
  soccod: string;
  empcod: string;
  emplib: string;
  dateDebut: string;
  dateFin: string;
  rows: EmpEtat[];
}

// Appelle l'endpoint serveur /Presences/etat-detaille qui rend le PDF FastReport
// (template Reports/EtatDetaille.frx). On envoie les paramètres réels du contexte
// utilisateur — auparavant le hook contenait des valeurs hard-codées de test
// (Soccod="01", Empcod="100434"…) qui généraient toujours le même rapport.
const useGenerateEtatDetaille = () => {
  return useMutation({
    mutationFn: async (params: EtatDetailleParams) => {
      const payload = {
        Soccod: params.soccod,
        Empcod: params.empcod,
        Emplib: params.emplib,
        DateDebut: params.dateDebut,
        DateFin: params.dateFin,
        Rows: (params.rows ?? []).map((row) => ({
          Empcod: row.empcod,
          Predat: row.predat,
          Prerepos: row.prerepos,
          Preentmatup: row.preentmatup,
          Presortmatup: row.presortmatup,
          Prerepas: row.prerepas,
          Preentamidiup: row.preentamidiup,
          Presortamidiup: row.presortamidiup,
          Preentsupup: row.preentsupup,
          Presortsupup: row.presortsupup,
          Tothnuit: row.tothnuit,
          Tothsup: row.tothsup,
          Tothre: row.tothre,
          TotalHeure: row.TotalHeure,
          Etat: row.etat,
          Preobs: row.preobs,
          Totret: row.totret,
          Tothabs: row.tothabs,
          Poicod: row.poicod,
          Jour: row.jour,
        })),
      };

      const response = await apiInstance.post(
        `/Presences/etat-detaille`,
        payload,
        { responseType: 'blob' },
      );
      return response.data as Blob;
    },
  });
};

export default useGenerateEtatDetaille;
