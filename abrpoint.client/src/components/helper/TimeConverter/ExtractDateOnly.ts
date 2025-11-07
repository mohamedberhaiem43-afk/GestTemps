export default function getDatePart(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return "-";

  if (timestamp instanceof Date) {
    return timestamp.toISOString().split("T")[0];
  }

  if (typeof timestamp === "string") {
    return timestamp.split("T")[0];
  }

  return "-";
}

export function getDatePartFromDate(timestamp: Date | string | null): string {
  if (!timestamp) return '';
  
  // Si c'est déjà une string au format ISO, extraire directement la partie date
  if (typeof timestamp === 'string') {
    return timestamp.split("T")[0];
  }
  
  // Si c'est un objet Date, convertir en ISO puis extraire la partie date
  return timestamp.toISOString().split("T")[0];
}
  