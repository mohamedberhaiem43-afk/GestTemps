using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[PrimaryKey("Empcod", "Soccod", "Sitcod")]
[Table("employe")]
public partial class Employe : BaseEntity
{
    [Required]
    [Column("empcod")]
    [StringLength(12)]
    public string Empcod { get; set; } = null!;

    [Required]
    [Column("soccod")]
    [StringLength(6)]
    public string Soccod { get; set; } = null!;

    [Required]
    [Column("sitcod")]
    [StringLength(2)]
    public string Sitcod { get; set; } = null!;

    [Column("emplib")]
    [StringLength(100)]
    public string? Emplib { get; set; }

    [Column("empmat")]
    [StringLength(12)]
    public string? Empmat { get; set; }

    [Column("empsexe")]
    [StringLength(1)]
    public string? Empsexe { get; set; }

    [Column("sercod")]
    [StringLength(4)]
    public string? Sercod { get; set; }

    [Column("empfonc")]
    [StringLength(40)]
    public string? Empfonc { get; set; }

    [Column("empreg")]
    [StringLength(1)]
    public string? Empreg { get; set; }

    [Column("catcod")]
    [StringLength(2)]
    public string? Catcod { get; set; }

    [Column("empnbp")]
    public int? Empnbp { get; set; }

    [Column("natcod")]
    [StringLength(4)]
    public string? Natcod { get; set; }

    [Column("vilcod")]
    [StringLength(6)]
    public string? Vilcod { get; set; }

    [Column("empadr")]
    [StringLength(100)]
    [Unicode(false)]
    public string? Empadr { get; set; }

    [Column("emptel")]
    [StringLength(256)]
    [Unicode(false)]
    public string? Emptel { get; set; }

    [Column("empmob", TypeName = "text")]
    public string? Empmob { get; set; }

    [Column("empemb", TypeName = "timestamp without time zone")]
    public DateTime? Empemb { get; set; }

    [Column("empsort", TypeName = "timestamp without time zone")]
    public DateTime? Empsort { get; set; }

    [Column("empmotif")]
    [StringLength(20)]
    public string? Empmotif { get; set; }

    [Column("actif")]
    [StringLength(1)]
    public string? Actif { get; set; }

    [Column("empdnais")]
    [StringLength(20)]
    public string? Empdnais { get; set; }

    [Column("emplnais")]
    [StringLength(20)]
    public string? Emplnais { get; set; }

    [Column("empcin")]
    [StringLength(256)]
    public string? Empcin { get; set; }

    [Column("empdcin", TypeName = "timestamp without time zone")]
    public DateTime? Empdcin { get; set; }

    [Column("empacin")]
    [StringLength(20)]
    public string? Empacin { get; set; }

    [Column("empsbase")]
    [StringLength(256)]
    public string? Empsbase { get; set; }

    [Column("empsbrut")]
    [StringLength(256)]
    public string? Empsbrut { get; set; }

    [Column("empdir")]
    [StringLength(1)]
    public string? Empdir { get; set; }

    [Column("emptype")]
    [StringLength(1)]
    public string? Emptype { get; set; }

    [Column("empniv")]
    [StringLength(1)]
    public string? Empniv { get; set; }

    [Column("emplibar")]
    [StringLength(50)]
    public string? Emplibar { get; set; }

    [Column("empadrar")]
    [StringLength(50)]
    public string? Empadrar { get; set; }

    [Column("empfoncar")]
    [StringLength(50)]
    public string? Empfoncar { get; set; }

    [Column("foncod")]
    [StringLength(6)]
    public string? Foncod { get; set; }

    [Column("quacod")]
    [StringLength(6)]
    public string? Quacod { get; set; }

    [Column("empmaxhre")]
    public double? Empmaxhre { get; set; }

    [Column("empoptim", TypeName = "timestamp without time zone")]
    public DateTime? Empoptim { get; set; }

    [Column("dircod")]
    [StringLength(10)]
    public string? Dircod { get; set; }

    [Column("empretraite", TypeName = "timestamp without time zone")]
    public DateTime? Empretraite { get; set; }

    [Column("caltype")]
    [StringLength(2)]
    public string? Caltype { get; set; }

    [Column("empmaxjour")]
    public double? Empmaxjour { get; set; }

    [Column("empretard")]
    [StringLength(1)]
    public string? Empretard { get; set; }

    [Column("empemail")]
    [StringLength(30)]
    public string? Empemail { get; set; }

    [Column("empresp")]
    [StringLength(12)]
    public string? Empresp { get; set; }

    [Column("empsnet")]
    [StringLength(256)]
    public string? Empsnet { get; set; }

    [Column("empcontrat")]
    [StringLength(50)]
    public string? Empcontrat { get; set; }

    [Column("empsitfam")]
    [StringLength(1)]
    public string? Empsitfam { get; set; }

    [Column("empech")]
    [StringLength(3)]
    public string? Empech { get; set; }

    [Column("empelon")]
    [StringLength(2)]
    public string? Empelon { get; set; }

    [Column("empcat")]
    [StringLength(4)]
    public string? Empcat { get; set; }

    [Column("empscat")]
    [StringLength(4)]
    public string? Empscat { get; set; }

    [Column("empnuit")]
    [StringLength(1)]
    public string? Empnuit { get; set; }

    [Column("empminhjour", TypeName = "double precision")]
    public double? Empminhjour { get; set; }

    [Column("emppanier")]
    [StringLength(1)]
    public string? Emppanier { get; set; }

    [Column("seccod")]
    [StringLength(10)]
    public string? Seccod { get; set; }

    [Column("poscod")]
    [StringLength(10)]
    public string? Poscod { get; set; }
    [Column("empferepos")]
    [StringLength(1)]
    public string? Empferepos { get; set; }
    [Column("empcmp")]
    [StringLength(1)]
    public string? Empcmp { get; set; }

    /// <summary>
    /// Méthode d'acquisition des jours de RTT (loi française).
    /// 'N' = non éligible (défaut), 'M' = saisie manuelle, 'H' = calcul horaire (>35h/sem),
    /// 'F' = forfait jours.
    /// </summary>
    [Column("emp_rtt_methode")]
    [StringLength(1)]
    public string? EmpRttMethode { get; set; }

    /// <summary>Méthode 'M' : nombre annuel de jours RTT saisi par l'admin.</summary>
    [Column("emp_rtt_jours_annuel")]
    public float? EmpRttJoursAnnuel { get; set; }

    /// <summary>Méthode 'H' : heures hebdomadaires contractuelles (ex 39).
    /// Le crédit RTT est calculé sur l'écart avec les 35h légales.</summary>
    [Column("emp_rtt_heures_contrat")]
    public float? EmpRttHeuresContrat { get; set; }

    /// <summary>Méthode 'F' : nombre de jours du forfait jours annuel
    /// (218 par défaut en France pour un cadre).</summary>
    [Column("emp_rtt_forfait_jours")]
    public int? EmpRttForfaitJours { get; set; }

    [NotMapped]
    public string? Utirole { get; set; }

    [NotMapped]
    public string? _plainCin { get; set; }

    /// <summary>Photo de profil du compte utilisateur lié (Utilisateurs.Utiimg).
    /// Rempli par les endpoints qui font la jointure Empcod=Uticod — la fiche
    /// collaborateur l'utilise pour afficher l'avatar plutôt que les initiales.</summary>
    [NotMapped]
    public string? Utiimg { get; set; }

    /// <summary>Libellé ville résolu via la table `ville` à partir de `Vilcod`.
    /// Côté UI on préfère afficher "Casablanca" plutôt que "CAS" — le code
    /// reste utile pour les imports mais est techniquement opaque.</summary>
    [NotMapped]
    public string? Villib { get; set; }

}

