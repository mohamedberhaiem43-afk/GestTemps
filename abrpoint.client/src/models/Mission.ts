export interface Mission {
  id: number;
  soccod: string;
  empcod: string;
  misobj: string;
  misdest?: string | null;
  misdatedeb: string;
  misdatefin: string;
  misnote?: string | null;
  misetat: string; // Pending | Approved | InProgress | Completed | Cancelled
  misbudget?: number | null;
  abscod: string;
  createdAt?: string | null;
}

export interface MissionUpsertRequest {
  soccod: string;
  empcod: string;
  misobj: string;
  misdest?: string | null;
  misdatedeb: string;
  misdatefin: string;
  misnote?: string | null;
  misetat?: string;
  misbudget?: number | null;
  abscod: string;
}

export interface FormationMissionNature {
  abscod: string;
  abslib: string;
}
