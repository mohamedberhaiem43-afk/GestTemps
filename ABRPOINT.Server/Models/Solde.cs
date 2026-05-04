using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[PrimaryKey("Empcod", "Soccod")]
[Table("solde")]
public partial class Solde : BaseEntity
{
    [Required]
    [Key]
    [Column("empcod")]
    [StringLength(12)]
    public string Empcod { get; set; } = null!;
    [Required]
    [Key]
    [Column("soccod")]
    [StringLength(4)]
    public string Soccod { get; set; } = null!;

    [Column("annee")]
    [StringLength(4)]
    public string? Annee { get; set; }

    [Column("conge")]
    public float? Conge { get; set; }

    [Column("empconge")]
    public float? Empconge { get; set; }

    /// <summary>
    /// Compte Épargne Temps cumulé (en jours). Alimenté par le transfert automatique
    /// des congés payés non pris à la date limite paramétrée (Parcetdatelim / Parcetmaxjours).
    /// </summary>
    [Column("cetjours")]
    public float? Cetjours { get; set; }

    /// <summary>Droit annuel RTT acquis pour l'année courante (en jours).
    /// Renseigné par RttCalculationService selon la méthode définie sur Employe.</summary>
    [Column("rtt_jours")]
    public float? RttJours { get; set; }

    /// <summary>Jours RTT déjà consommés sur l'année courante.
    /// Incrémenté automatiquement à chaque acceptation d'une demande de congé Abscng='R'.</summary>
    [Column("rtt_utilises")]
    public float? RttUtilises { get; set; }
}
