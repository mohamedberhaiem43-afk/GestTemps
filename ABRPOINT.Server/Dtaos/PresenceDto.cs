namespace ABRPOINT.Server.Dtaos
{
    public class PresenceDto
    {
        public string? Soccod { get; set; }
        public string? Catcod { get; set; }
        public string? Empcod { get; set; }
        public DateTime? Predat { get; set; }
        public string? Empmat { get; set; }
        public string? Codposte { get; set; }
        public string? Sercod { get; set; }
        public string? Preentmatup { get; set; }
        public string? Presortmatup { get; set; }
        public string? Preentamidiup { get; set; }
        public string? Presortamidiup { get; set; }
        public string? Preentsupup { get; set; }
        public string? Presortsupup { get; set; }
        public string? Preentasupup { get; set; }
        public string? Presortasupup { get; set; }
        public string? Prerepos { get; set; }
        public float? Prerepas { get; set; }
        public DateTime? Preretmateup { get; set; }
        public DateTime? Preretmatsup { get; set; }
        public DateTime? Preretameup { get; set; }
        public DateTime? Preretamsup { get; set; }
        public DateTime? Preretmate { get; set; }
        public DateTime? Preretmats { get; set; }
        public DateTime? Preretame { get; set; }
        public DateTime? Preretams { get; set; }
        public float? Preavantent { get; set; }
        public float? Preapresent { get; set; }
        public float? Preavantsort { get; set; }
        public float? Preapressort { get; set; }
        public string? Sitcod { get; set; }
        public string? Preobs { get; set; }
        public DateTime? Dmdate { get; set; }
        public float? TotalHeure { get; set; }
        public string? Tothre { get; set; }
        public string? Tothabs { get; set; }
        public string? Avance { get; set; }
        public string? Tothsup { get; set; }
        public string? Tothnuit { get; set; }
        public string? Totret { get; set; }
        public float? Totcmp { get; set; }
        public string? Etat { get; set; }
        public float? Hreaut { get; set; }
        public string? Poicod { get; set; }
        public float? Arrondi { get; set; }
        public int? Arrhsup { get; set; }
        public float? Predouche { get; set; }
        public double? Jour { get; set; }

        // Flags for reliable frontend classification
        public bool HasAutorisation { get; set; }
        public bool HasConge { get; set; }
        public bool HasFerie { get; set; }
        // Autorisation time range for display
        public string? AutDebut { get; set; }
        public string? AutFin { get; set; }

        // ─── État de validation des heures supplémentaires (table autoriser / [HEURES SUP]) ───
        // Renseigné par PresenceRepository.GetEmpEtatPeriodiqueAsync via
        // IautoriserRepository.GetOvertimeApprovalBatchAsync. Permet à l'UI État
        // périodique d'afficher une mention "h.supp refusées" quand l'employé
        // a pointé des h.supp mais que le manager a refusé sa demande.
        /// <summary>"Approved", "Pending", "Rejected", "Mixed" ou null si aucune demande pour ce jour.</summary>
        public string? OvertimeRequestStatus { get; set; }
        public float? OvertimeApprovedHours { get; set; }
        public float? OvertimePendingHours { get; set; }
        public float? OvertimeRejectedHours { get; set; }
        /// <summary>Commentaire du manager — affiché en tooltip côté UI sur les jours refusés.</summary>
        public string? OvertimeDecisionComment { get; set; }
    }
}