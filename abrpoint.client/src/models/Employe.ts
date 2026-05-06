export default interface Employe {
    empcod: string;
    soccod: string;
    sitcod: string;
    emplib: string;
    empmat: string | null;
    empsexe: string | null;
    sercod: string | null;
    empfonc: string;
    empferepos: string;
    empreg: string | null;
    catcod: string | null;
    empnbp: number | null;
    natcod: string | null;
    vilcod: string | null;
    empadr: string | null;
    emptel: string | null;
    empmob: string | null;
    empemb: Date | null;
    empsort: Date | null;
    empmotif: string | null;
    actif: string | null;
    empdnais: string | null;
    emplnais: string | null;
    empcin: string;
    empdcin: Date | null;
    empacin: string;
    empsbase: string | null;
    empsbrut: string | null;
    empdir: string | null;
    emptype: string | null;
    empniv: string | null; // Changed from string to string | null
    emplibar: string | null;
    empadrar: string | null;
    empfoncar: string | null;
    foncod: string | null;
    quacod: string | null;
    empmaxhre: number | null;
    empoptim: Date | null;
    dircod: string | null;
    empretraite: Date | null;
    caltype: string | null;
    empmaxjour: number | null;
    empretard: string | null;
    empemail: string | null;
    empresp: string | null;
    empsnet: string | null;
    empcontrat: string | null;
    empsitfam: string | null;
    empech: string | null;
    empelon: string | null;
    empcat: string | null;
    empscat: string | null;
    empnuit: string | null;
    empminhjour: number | null;
    emppanier: string | null;
    seccod: string | null;
    poscod: string | null;
    parmois: string | null;
    /** Méthode RTT : 'N' non éligible, 'M' manuel, 'H' horaire, 'F' forfait jours. */
    empRttMethode?: string | null;
    /** Méthode 'M' : nombre annuel de jours RTT saisi par l'admin. */
    empRttJoursAnnuel?: number | null;
    /** Méthode 'H' : heures hebdomadaires contractuelles (ex: 39). */
    empRttHeuresContrat?: number | null;
    /** Méthode 'F' : nombre de jours du forfait annuel (218 par défaut). */
    empRttForfaitJours?: number | null;
    utirole?: string;
    /** Photo de profil de l'utilisateur lié (Utilisateurs.Utiimg). Renseigné
     *  par la jointure server-side dans GET /Employes/{soccod}/{uticod}. */
    utiimg?: string | null;
}