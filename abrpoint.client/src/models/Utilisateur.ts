import { Moduser } from "./moduser";

export default interface UtilisateurDto {
  uticod: string | null;
  utinom: string | null;
  utiprn: string | null;
  utimps: string | null;
  utiactif: string | null;
  utiadm: string | null;
  utimail: string | null;
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