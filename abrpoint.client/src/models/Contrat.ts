export interface Contrat {
    soccod: string; // Required, length 4
    concod: string; // Required, length 9
    empcod: string; // Required, length 12
    condat?: Date; // Optional, datetime
    contype?: string; // Optional, length 1
    sitcod?: string; // Optional, length 2
    sercod?: string; // Optional, length 4
    empreg?: string; // Optional, length 1
    catcod?: string; // Optional, length 2
    vilcod?: string; // Optional, length 4
    empadr?: string; // Optional, length 100
    emppost?: string; // Optional, length 60
    emptel?: string; // Optional, length 20
    empemb?: Date; // Optional, datetime
    empsort?: Date; // Optional, datetime
    condg?: string; // Optional, length 1
    empmotif?: string; // Optional, length 100
    empdcin?: Date; // Optional, datetime
    empacin?: string; // Optional, length 8
    quacod?: string; // Optional, length 4
    empech?: string; // Optional, length 3
    empelon?: string; // Optional, length 2
    empcat?: string; // Optional, length 100
    empscat?: string; // Optional, length 100
    cnscod?: string; // Optional, length 6
    empsbase?: number; // Optional, float
    empsbrut?: number; // Optional, float
    socresp?: string; // Optional, length 80
    dircod?: string; // Optional, length 10
    empcontrat?: string; // Optional, length 100
    conmois?: number; // Optional, float
}
