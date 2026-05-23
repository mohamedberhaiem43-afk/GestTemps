export default interface EmpEtat {
  jour: string;
  concod: string;
  poicod: string;
  tothsup: string;
  arrhsup: number;
  arrondi: number;
  predat: string;
  prerepos: string;
  preentmatup: string;
  presortmatup: string;
  prerepas: string;
  preentamidiup: string;
  presortamidiup: string;
  preentsupup: string;
  presortsupup: string;
  etat: string;
  TotalHeure: string;
  tothabs: string;
  tothre: string;
  totret: string;
  tothnuit: string;
  totcmp: string;
  empcod: string;
  codposte: string;
  preobs: string;
  hreaut: number;
  // Flags from backend for reliable classification
  hasAutorisation: boolean;
  hasConge: boolean;
  hasFerie: boolean;
  autDebut: string;
  autFin: string;
  // État de la demande d'heures supplémentaires pour ce jour (table autoriser /
  // marker [HEURES SUP]). Null si l'employé n'a fait aucune demande — l'UI
  // affiche alors les h.supp telles que calculées depuis le pointage. Si une
  // demande existe et a été refusée, l'UI affiche une mention "h.supp refusées"
  // à côté de la cellule pour expliquer pourquoi elles ne sont plus prises en
  // compte côté paie.
  overtimeRequestStatus?: 'Approved' | 'Pending' | 'Rejected' | 'Mixed' | null;
  overtimeApprovedHours?: number | null;
  overtimePendingHours?: number | null;
  overtimeRejectedHours?: number | null;
  overtimeDecisionComment?: string | null;
};
