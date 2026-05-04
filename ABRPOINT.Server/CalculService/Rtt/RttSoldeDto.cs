namespace ABRPOINT.Server.CalculService.Rtt;

/// <summary>
/// Solde RTT d'un employé pour l'année courante.
/// </summary>
public class RttSoldeDto
{
    /// <summary>Méthode d'acquisition : 'N' / 'M' / 'H' / 'F'.</summary>
    public string Methode { get; set; } = "N";

    /// <summary>Droit annuel calculé / saisi (jours).</summary>
    public float DroitAnnuel { get; set; }

    /// <summary>Jours déjà consommés sur l'année (jours).</summary>
    public float Pris { get; set; }

    /// <summary>Solde net = DroitAnnuel - Pris (jours).</summary>
    public float Solde => DroitAnnuel - Pris;

    /// <summary>Année concernée par ce solde (ex: "2026").</summary>
    public string Annee { get; set; } = "";
}
