export type Sanction = {
    concod?: string;        // N° Ordre
    soccod?: string|null;        // Company Code
    empcod?: string;        // Employee Code
    condat?: Date|null;          // Date of the sanction (congé)
    conjour?: string;       // Full/half day (e.g. 'J' for full day)
    condep?: Date|null;          // Departure Date
    conamdep?: string;      // Departure Morning/Afternoon Indicator (optional)
    conret?: Date|null;          // Return Date
    conamret?: string;      // Return Morning/Afternoon Indicator (optional)
    abscod?: string;        // Absence code (e.g. leave type)
    conmotif?: string;      // Motif (reason for the sanction)
    consanc?: string;       // Sanction type (e.g. warning, dismissal)
    connbjour?: number;     // Number of days
    conref?: string;        // Reference number of the sanction
  }
  