// models/Solde.ts
export type Solde = {
    empcod: string;
    soccod: string;
    annee?: string;
    conge?: number;
    empconge?: number;
    /** Compte Épargne Temps cumulé (jours) — alimenté par le transfert auto des CP non pris. */
    cetjours?: number;
    /** Droit annuel RTT acquis (jours) — calculé par RttCalculationService selon la méthode (M/H/F). */
    rttJours?: number;
    /** Jours RTT déjà consommés sur l'année courante. */
    rttUtilises?: number;
  }
