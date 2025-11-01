export interface DroitConge {
empmat:string
emplib:string
empreg:string
empemb:Date
annee:string
soldeinit:number
droitconge:number
jourancien:number
nbconges:number
nbcongerecu:number
nbabsences:number
droitrestant:number
nbcongerecuparmois:Record<string,number>
nbabsenceparmois:Record<string,number>
}