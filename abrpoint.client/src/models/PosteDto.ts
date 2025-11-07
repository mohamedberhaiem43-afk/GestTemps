export interface PosteDto{
    codposte: string,
    soccod: string,
    libposte: string,
    avantent: number,
    apresent: number,
    avantsort: number,
    apressort: number,
    jourhdmat: string,
    jourhfmat: string,
    jourhdam: string,
    jourhfam: string,
    jourrepos: string,
    jourrepas: number,
    jourhdrep: string,
    jourhfrep: string,
    jourhdematin: string,
    jourhfematin: string,
    jourhdeamidi: string,
    jourhfeamidi: string,
    arrondi: number,
    maxhrejour: string,
    minhjour: number,
    minhdemijour: number,
    jourdouche: number
}
export interface UpdatePoste{
    apresent:number
    apressort:number
    avabon:number
    avamn:number
    avantent:number
    avantsort:number
    soccod:string
    codposte:string
    libposte:string
    reposApres:string
    reposAvant:string
    retmin:number
    retminam:number
    retsanc:number
    retsancam:number
}
