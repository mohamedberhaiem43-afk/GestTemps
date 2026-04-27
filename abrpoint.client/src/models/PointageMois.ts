export type HeuresSupplementairesResultat =
{
    nbhFerierTrv: number;
    weekStartDate?: string;
    weekEndDate?: string;
    panier?: number;
    jourFerier: number;
    jourSamediTrv: number;
    hreSamediTrv: number;
    heureFerier: number;
    nbJours: number;
    nbhCalendSem : string;
    heuresNormales :number;
    retard :number;
    totalAbsence :number;
    hreNuits :number;
    nbNuits :number;
    heuresSupTranche1 :number;
    heuresSupTranche2 :number;
    hreSupSemaine :number;
    hreFerier :number;
    hreFerieTrv :number;
    hreFerieTrv2 :number;
    nbJourFerier :number;
    hreAllaitement :number;
    nbJourPointer :number;
    nbJourCngPaye :number;
    nbHeureConge :number;
    tothre :number;
    jourRepos: number;
    heureRepos :number;
    deplacement :number;
    act :number;
    ct :number;
    css :number;
    csf :number;
    hcsf :number;
    map :number;
    absj :number;
    absnj :number;
    absnp :number;
    caltype :string;
    fm :number;
    maladie :number;
    weekDetails:Record<string, string>;
    missingPosteDates?: string[];
}
export interface PointageMois {
    empCod: string;
    empMat: string;
    empLib: string;
    empReg: string;
    empSite: string;
    heuresSupplementairesResultats: HeuresSupplementairesResultat[];
}