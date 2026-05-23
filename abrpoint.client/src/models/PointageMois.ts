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
    // Validation des heures supplémentaires (table autoriser, marker [HEURES SUP]).
    // - hreSupCalcule : montant brut calculé depuis les pointages (avant filtrage).
    // - hreSupApprouvees / hreSupEnAttente / hreSupRefusees : agrégats par état
    //   pour la semaine.
    // - hreSupHasRequests : true s'il existe au moins une demande pour la semaine.
    //   Quand false, hreSupSemaine = calcul brut (mode legacy). Quand true,
    //   hreSupSemaine = hreSupApprouvees uniquement (mode strict) — l'UI affiche
    //   alors un badge si des heures ont été refusées.
    hreSupCalcule?: number;
    hreSupApprouvees?: number;
    hreSupEnAttente?: number;
    hreSupRefusees?: number;
    hreSupHasRequests?: boolean;
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
    // Backend DTO field is `EmpCode` (sérialisé en `empCode`). On expose
    // aussi un alias `empCod` pour les anciens consommateurs.
    empCode: string;
    empCod?: string;
    empMat: string;
    empLib: string;
    empReg: string;
    empSite: string;
    heuresSupplementairesResultats: HeuresSupplementairesResultat[];
}