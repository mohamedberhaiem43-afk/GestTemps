export type RubriqueDto = {
    rubcod: string,
    soccod: string,
    rublib: string,
    // Le backend renvoie désormais ces champs dans GET /api/Rubriques/{soccod} (cf. RubriqueDto.cs).
    // Indispensable pour que la liste et le formulaire d'édition affichent l'unité et la
    // variable de pointage rattachées — sans quoi un clic « Modifier » montrerait des selects
    // vides et un Save aurait écrasé les valeurs en base.
    rubunite?: string,
    vartype?: string,
    rubregime?: string,
    rubtaux?: number,
}
export type Rubrique = {
    rubcod:string,
    soccod:string,
    rubunite:string,
    rublib:string
    rubtaux?:number,
    rubregime?:string,
    vartype?:string
}
export type RubriquePaire = {
    rubcod:string,
    soccod:string,
    rubunite:string,
    rublib:string
    rubregime?:string,
    vartype?:string
}