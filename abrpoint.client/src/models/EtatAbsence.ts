export default interface EtatAbsence {
  empcod: string | null;
  empmat: string | null;
  emplib: string | null;
  empreg: string | null;
  date: Date | null;
  abscod: string | null;
  motif: string | null;
  congepaye?: number | null;
  acctrav?: number | null;
  csf?: number | null;
  absjust?: number | null;
  fm?: number | null;
  arrtech?: number | null;
  absmal?: number | null;
  absnj?: number | null;
  map?: number | null;
  autsp?: number | null;
  autsnp?: number | null;
  css?: number | null;
  absjourretard?: string | null;
  absence?: number | null;
}
