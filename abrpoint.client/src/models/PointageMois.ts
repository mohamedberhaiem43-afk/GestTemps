export type HeuresSupplementairesResultat =
{
    weekStartDate?: string;
    weekEndDate?: string;
    panier?: number;
    jourFerier: number;
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
    fm :number;
    maladie :number;
    weekDetails:Record<string, string>;
}
export interface PointageMois {
    empCod: string;
    empMat: string;
    empLib: string;
    empReg: string;
    empSite: string;
    heuresSupplementairesResultats: HeuresSupplementairesResultat[];
}