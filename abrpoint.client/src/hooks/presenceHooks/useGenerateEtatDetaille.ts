import { useMutation } from 'react-query';
import apiInstance from '../../components/API/apiInstance';
import EmpEtat from '../../models/EmpEtat';

interface EtatDetailleParams {
  soccod: string;
  empcod: string;
  emplib: string;
  dateDebut: string;
  dateFin: string;
  rows: EmpEtat[];   // on envoie les données déjà chargées
}

const useGenerateEtatDetaille = () => {
  return useMutation({
    mutationFn: async (params: EtatDetailleParams) => {
  const payload = {
  Soccod: "01",
  Empcod: "100434",
  Emplib: "ALOUI HASSEN",
  DateDebut: "2025-06-26",
  DateFin: "2025-07-25",
  Rows: params.rows.map(row => ({
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
    Jour: row.jour
  }))
};

  const response = await apiInstance.post(
    `/Presences/etat-detaille`,
    payload,
    {
      responseType: 'blob',
    }
  );

  return response.data;
}

  });
};

export default useGenerateEtatDetaille;