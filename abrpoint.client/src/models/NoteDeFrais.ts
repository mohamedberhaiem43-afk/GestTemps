export interface NoteDeFrais {
    id: number;
    soccod: string;
    empcod: string;
    titre: string;
    categorie: string;
    montant: number;
    projet?: string;
    missionId: number;
    dateDepense: string;
    justificatif?: string;
    etat: string;
    createdAt: string;
}

export interface NoteDeFraisRequest {
    soccod: string;
    empcod: string;
    titre: string;
    categorie: string;
    montant: number;
    projet?: string;
    missionId: number;
    dateDepense: string;
    file?: File;
}
