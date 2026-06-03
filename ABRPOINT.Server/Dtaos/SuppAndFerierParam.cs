namespace ABRPOINT.Server.Dtaos
{
    public class SuppAndFerierParam
    {
        public bool HasSupp { get; set; }
        public float? MaxFerier { get; set; }
        public string? EliminerFerier { get; set; }
        public string? Parreptrv { get; set; }
        public float? MajNuitNorm { get; set; }
        /// <summary>
        /// Mode de gestion des heures supplémentaires (parametre.parhsupmode) :
        /// "A" = calcul automatique (l'excédent présence/contrat compte directement) ;
        /// null/"V" = sur demande + validation (seules les demandes [HEURES SUP]
        /// approuvées comptent — comportement par défaut historique).
        /// </summary>
        public string? Hsupmode { get; set; }
    }
}
