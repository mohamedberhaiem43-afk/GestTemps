import { Moduser } from "./moduser";

export default interface UtilisateurDto {
  uticod: string | null;
  utinom: string | null;
  utiprn: string | null;
  utimps: string | null;
  utiactif: string | null;
  utiadm: string | null;
  utimail: string | null;
  utirole: string | null;
  uti2fa_enabled: string | null;
  soccod: string | null;
  sitcod: string | null;
  sercod?: string | null;
}
export interface User {
  uticod: string | null;
  utinom: string | null;
  utiprn: string | null;
  utimps: string | null;
  utiactif: string | null;
  utiadm: string | null;
  utimail: string | null;
  utirole?: string | null;
  uti2fa_enabled?: string | null;
}
export interface UtilisateurUpdate {
  Utilisateur: User
  Moduser: Moduser[];
}

export interface PasswordUpdate {
  uticod: string
  currentPassword: string
  newPassword: string
}

export interface TwoFAResponse {
  secret: string;
  qrCodeBase64: string;
  manualEntryKey: string;
}

// Labels affichés dans l'UI par roleName. Inclut :
//   - Les 3 rôles système modernes (Administrator/Manager/Employee), source de vérité backend.
//   - Les anciens alias minuscules pour rétrocompat avec les utilisateurs legacy.
//   - D'autres alias historiques (rh, superviseur) qui peuvent encore exister en base.
export const ROLE_LABELS: Record<string, string> = {
  Administrator: "Administrateur",
  ResponsableRH: "Responsable RH",
  Manager: "Manager",
  Employee: "Employé",
  // Aliases legacy
  admin: "Administrateur",
  rh: "Responsable RH",
  superviseur: "Superviseur Pointage",
  manager: "Manager",
  standard: "Employé",
  // Ancien libellé "Utilisateur Standard" stocké en base sur des fiches existantes :
  // on continue de l'afficher comme "Employé" dans l'UI sans toucher à la donnée.
  "Utilisateur Standard": "Employé",
};

// Options proposées dans les dropdowns de création/édition d'utilisateur :
// on présente uniquement les 3 rôles système modernes.
export const ROLE_OPTIONS = [
  { value: "Administrator", label: "Administrateur" },
  { value: "Manager", label: "Manager" },
  { value: "Employee", label: "Employé" },
];