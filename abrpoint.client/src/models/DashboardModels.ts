// Requêtes
export type DashboardRequest = {
  soccod: string;
  date?: string | Date;
  departement?: string | null;
  empcods?: string[] | null;
};
export interface EvolutionRequest {
  soccod: string;
  dateDebut: Date | string;
  dateFin: Date | string;
  departement?: string | null;
  empcods?: string[] | null;
}

// Réponses
export interface DashboardData {
  evolutionAbsences: any;
  evolutionRetards: any;
  evolutionHeures: any | number;
  date: string;
  effectifPresent: number;
  effectifTotal: number;
  pourcentagePresence: number;
  heuresTravaillees: number;
  nombreRetards: number;
  totalAbsences: number;
  totalDemandesEnAttente: number;
  pointagesIncomplets: number;
  donneesDepartements?: DepartementData[];
  alertes?: AlerteDashboard[];

}

export interface DepartementData {
  departement: string;
  effectifTotal: number;
  effectifPresent: number;
  pourcentagePresence: number;
  heuresTravaillees: number;
}

export interface AlerteDashboard {
  type: 'critical' | 'warning' | 'info';
  titre: string;
  message: string;
  date?: string;
}

export interface EvolutionJournaliere {
  date: string;
  effectifPresent: number;
  effectifTotal: number;
  pourcentagePresence: number;
  heuresTravaillees: number;
  nombreRetards: number;
  totalAbsences: number;
}

export interface EmployeStatut {
  empcod: string;
  emplib: string;
  prenom: string;
  departement: string;
  heureArrivee?: string | null;
  heureDepart?: string | null;
  heuresTravaillees?: number | null;
  statut: 'present' | 'absent' | 'conge' | 'retard';
  estEnRetard: boolean;
}

export interface ResumeDuJour {
  date: string;
  effectifPresent: number;
  effectifTotal: number;
  tauxPresence: number;
  heuresTravaillees: number;
  retards: number;
  absences: number;
  demandesEnAttente: number;
  anomalies: number;
}

export interface KpiDepartement {
  departement: string;
  effectifTotal: number;
  effectifPresent: number;
  tauxPresence: number;
}

export interface DashboardFilters {
  dateRange: 'today' | 'week' | 'month' | 'custom';
  departement?: string | null;
  dateDebut?: Date | null;
  dateFin?: Date | null;
}
