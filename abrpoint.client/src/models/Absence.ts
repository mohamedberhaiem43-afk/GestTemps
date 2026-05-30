export type Absence = {
        soccod:string|null;
        abscod: string;
        abslib: string;
        abscng: string;
        abspayer: string;
        absaut: number;
        abspar: string;
        abssanc: string;
        absunite: string;
        absferier: string;
        // CET (Compte Épargne Temps)
        abspeutcet?: string | null;
        absmaxcet?: number | null;
        absprendcet?: string | null;
}

export type AbsenceDto = {
        soccod:string;
        abscod: string;
        abslib: string;
        abscng: string;
        abssan: string;
        abspayer: string;
        absaut: number;
        abspar: string;
        absferier: string;
        absrepos: string;
        abssanc: string;
        absunite: string;
        // CET (Compte Épargne Temps)
        abspeutcet?: string | null;
        absmaxcet?: number | null;
        absprendcet?: string | null;
}