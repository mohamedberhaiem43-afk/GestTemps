/**
 * Convertit un timestamp (Date ou string) en date locale "YYYY-MM-DD"
 * Retourne "-" si invalide.
 */
export default function getDatePart(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return "-";

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(date.getTime())) return "-";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Variante identique mais retourne une chaîne vide "" au lieu de "-"
 * (utile pour les champs <input type="date">)
 */
export function getDatePart1(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return "";

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Même logique mais pensée pour un paramètre Date ou string (pas undefined)
 */
export function getDatePartFromDate(timestamp: Date | string | null): string {
  if (!timestamp) return "";

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
