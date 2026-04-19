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

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  rh: "Responsable RH",
  superviseur: "Superviseur Pointage",
  manager: "Manager",
  standard: "Utilisateur Standard",
};

export const ROLE_OPTIONS = [
  { value: "admin", label: "Administrateur" },
  { value: "rh", label: "Responsable RH" },
  { value: "superviseur", label: "Superviseur Pointage" },
  { value: "manager", label: "Manager" },
  { value: "standard", label: "Utilisateur Standard" },
];