using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace ABRPOINT.Server.Models;

[Table("parametre")]
public partial class Parametre : BaseEntity
{
    [Required]
    [Key]
    [Column("soccod")]
    [StringLength(4)]
    public string Soccod { get; set; } = null!;

    [Column("paie")]
    [StringLength(1)]
    public string? Paie { get; set; }

    [Column("point")]
    [StringLength(1)]
    public string? Point { get; set; }

    [Column("separe")]
    [StringLength(1)]
    public string? Separe { get; set; }

    [Column("longbdg")]
    public short? Longbdg { get; set; }

    [Column("ncom")]
    [StringLength(1)]
    public string? Ncom { get; set; }

    [Column("vitesse")]
    public float? Vitesse { get; set; }

    [Column("parite")]
    public float? Parite { get; set; }

    [Column("nbdigit")]
    public int? Nbdigit { get; set; }

    [Column("xonoff")]
    [StringLength(1)]
    public string? Xonoff { get; set; }

    [Column("arrondi")]
    public int? Arrondi { get; set; }

    [Column("nbhconge")]
    public float? Nbhconge { get; set; }

    [Column("nbhrepos")]
    public int? Nbhrepos { get; set; }

    [Column("nbhferier")]
    public int? Nbhferier { get; set; }

    [Column("fertrv")]
    public int? Fertrv { get; set; }

    [Column("joudeb")]
    [StringLength(2)]
    public string? Joudeb { get; set; }

    [Column("moisdeb")]
    [StringLength(1)]
    public string? Moisdeb { get; set; }

    [Column("joufin")]
    [StringLength(2)]
    public string? Joufin { get; set; }

    [Column("moisfin")]
    [StringLength(1)]
    public string? Moisfin { get; set; }

    [Column("hsuphebd")]
    [StringLength(1)]
    public string? Hsuphebd { get; set; }

    [Column("nbhtr1")]
    public float? Nbhtr1 { get; set; }

    [Column("tauxtr1")]
    public float? Tauxtr1 { get; set; }

    [Column("nbhtr2")]
    public float? Nbhtr2 { get; set; }

    [Column("tauxtr2")]
    public float? Tauxtr2 { get; set; }

    [Column("nbhtr3")]
    public float? Nbhtr3 { get; set; }

    [Column("tauxtr3")]
    public float? Tauxtr3 { get; set; }

    [Column("nbhtr4")]
    public float? Nbhtr4 { get; set; }

    [Column("tauxtr4")]
    public float? Tauxtr4 { get; set; }

    [Column("billet")]
    [StringLength(1)]
    public string? Billet { get; set; }

    [Column("minuit")]
    [StringLength(1)]
    public string? Minuit { get; set; }

    [Column("parsom")]
    public int? Parsom { get; set; }

    [Column("parecart")]
    public int? Parecart { get; set; }

    [Column("nbhdemij")]
    public double? Nbhdemij { get; set; }

    [Column("arrhsup")]
    public int? Arrhsup { get; set; }

    [Column("parnuit")]
    [StringLength(1)]
    public string? Parnuit { get; set; }

    [Column("nuitdeb")]
    [StringLength(5)]
    public string? Nuitdeb { get; set; }

    [Column("nuitfin")]
    [StringLength(5)]
    public string? Nuitfin { get; set; }

    [Column("arrhsortie")]
    public int? Arrhsortie { get; set; }

    [Column("arrhsmajore")]
    public int? Arrhsmajore { get; set; }

    [Column("arrhentree")]
    public int? Arrhentree { get; set; }

    [Column("arrhemajore")]
    public int? Arrhemajore { get; set; }

    [Column("moinsrepas")]
    public int? Moinsrepas { get; set; }

    [Column("ajustupd")]
    [StringLength(1)]
    public string? Ajustupd { get; set; }

    [Column("sansferie")]
    [StringLength(1)]
    public string? Sansferie { get; set; }

    [Column("affech")]
    [StringLength(1)]
    public string? Affech { get; set; }

    [Column("parsem")]
    [StringLength(1)]
    public string? Parsem { get; set; }

    [Column("planhoraire")]
    [StringLength(1)]
    public string? Planhoraire { get; set; }

    [Column("jourrepos")]
    [StringLength(10)]
    public string? Jourrepos { get; set; }

    [Column("optimise", TypeName = "timestamp without time zone")]
    public DateTime? Optimise { get; set; }

    [Column("repasnuit")]
    [StringLength(1)]
    public string? Repasnuit { get; set; }

    [Column("dtepres")]
    [StringLength(1)]
    public string? Dtepres { get; set; }

    [Column("parferabs")]
    [StringLength(1)]
    public string? Parferabs { get; set; }

    [Column("pardroitnbj")]
    public float? Pardroitnbj { get; set; }

    [Column("parancemp")]
    [StringLength(1)]
    public string? Parancemp { get; set; }

    [Column("hsuphebdm")]
    [StringLength(1)]
    public string? Hsuphebdm { get; set; }

    [Column("nbhtr1M")]
    public float? Nbhtr1M { get; set; }

    [Column("tauxtr1M")]
    public float? Tauxtr1M { get; set; }

    [Column("nbhtr2M")]
    public float? Nbhtr2M { get; set; }

    [Column("tauxtr2M")]
    public float? Tauxtr2M { get; set; }

    [Column("nbhtr3M")]
    public float? Nbhtr3M { get; set; }

    [Column("tauxtr3M")]
    public float? Tauxtr3M { get; set; }

    [Column("nbhtr4M")]
    public float? Nbhtr4M { get; set; }

    [Column("tauxtr4M")]
    public float? Tauxtr4M { get; set; }

    [Column("nbhmax1")]
    public float? Nbhmax1 { get; set; }

    [Column("tauxmax1")]
    public float? Tauxmax1 { get; set; }

    [Column("nbhmax2")]
    public float? Nbhmax2 { get; set; }

    [Column("tauxmax2")]
    public float? Tauxmax2 { get; set; }

    [Column("nbhmax1m")]
    public float? Nbhmax1m { get; set; }

    [Column("tauxmax1m")]
    public float? Tauxmax1m { get; set; }

    [Column("nbhmax2m")]
    public float? Nbhmax2m { get; set; }

    [Column("tauxmax2m")]
    public float? Tauxmax2m { get; set; }

    [Column("parelimftrv")]
    [StringLength(1)]
    public string? Parelimftrv { get; set; }

    [Column("parmaxfer")]
    public int? Parmaxfer { get; set; }

    [Column("parminhjour")]
    public int? Parminhjour { get; set; }

    [Column("parmaxhjour")]
    public int? Parmaxhjour { get; set; }

    [Column("parpostlundi")]
    [StringLength(1)]
    public string? Parpostlundi { get; set; }

    [Column("paiearrondi")]
    public float? Paiearrondi { get; set; }

    [Column("parcadre")]
    [StringLength(1)]
    public string? Parcadre { get; set; }

    [Column("parmaitrise")]
    [StringLength(1)]
    public string? Parmaitrise { get; set; }

    [Column("parexec")]
    [StringLength(1)]
    public string? Parexec { get; set; }

    [Column("parjhnlibre")]
    public float? Parjhnlibre { get; set; }

    [Column("parjhslibre")]
    public float? Parjhslibre { get; set; }

    [Column("parjhnfixe")]
    public float? Parjhnfixe { get; set; }

    [Column("parjhsfixe")]
    public float? Parjhsfixe { get; set; }

    [Column("parreptrv")]
    [StringLength(1)]
    public string? Parreptrv { get; set; }

    [Column("parmanuel")]
    [StringLength(1)]
    public string? Parmanuel { get; set; }

    [Column("parpaquet")]
    public double? Parpaquet { get; set; }

    [Column("parreperiod")]
    [StringLength(1)]
    public string? Parreperiod { get; set; }

    [Column("parscomplet")]
    [StringLength(1)]
    public string? Parscomplet { get; set; }

    [Column("pardecimal")]
    [StringLength(1)]
    public string? Pardecimal { get; set; }

    [Column("parallaite")]
    [StringLength(12)]
    public string? Parallaite { get; set; }

    [Column("parpresence")]
    [StringLength(1)]
    public string? Parpresence { get; set; }

    [Column("parsaisconge")]
    public double? Parsaisconge { get; set; }

    [Column("parnrepas")]
    [StringLength(1)]
    public string? Parnrepas { get; set; }

    [Column("parabsconge")]
    [StringLength(1)]
    public string? Parabsconge { get; set; }

    [Column("parhnuitspec")]
    [StringLength(20)]
    public string? Parhnuitspec { get; set; }

    [Column("nuitsdeb")]
    [StringLength(5)]
    public string? Nuitsdeb { get; set; }

    [Column("nuitsfin")]
    [StringLength(5)]
    public string? Nuitsfin { get; set; }

    [Column("parretabs")]
    [StringLength(1)]
    public string? Parretabs { get; set; }

    /// <summary>
    /// Mode de génération automatique du code employé.
    ///   "S" → préfixe = 2 premiers caractères du libellé société + n° séquentiel
    ///   "N" → préfixe = 2 premiers caractères du nom employé + n° séquentiel
    ///   "X" ou null → pas de préfixe, code purement séquentiel sur 6 chiffres
    /// </summary>
    [Column("parmodemp")]
    [StringLength(1)]
    public string? Parmodemp { get; set; }

    /// <summary>
    /// Date limite (format "DD-MM") au-delà de laquelle les congés payés non pris sont
    /// transférés automatiquement vers le CET. Défaut : 31-05.
    /// </summary>
    [Column("parcetdatelim")]
    [StringLength(5)]
    public string? Parcetdatelim { get; set; }

    /// <summary>
    /// Plafond en jours du transfert CET annuel. Défaut : 10.
    /// </summary>
    [Column("parcetmaxjours")]
    public float? Parcetmaxjours { get; set; }

    /// <summary>
    /// Les demandes d'alimentation du CET par le salarié exigent-elles une validation
    /// RH/admin/manager ? "1" ou null = validation requise (défaut prudent), "0" =
    /// application immédiate. Cf. CetController alimentation.
    /// </summary>
    [Column("parcetvalidation")]
    [StringLength(1)]
    public string? Parcetvalidation { get; set; }

    /// <summary>
    /// Quota de jours de télétravail autorisés par semaine. 0/null = pas de quota.
    /// Contrôlé à la création d'une demande de télétravail.
    /// </summary>
    [Column("parttmaxsem")]
    public float? Parttmaxsem { get; set; }

    /// <summary>
    /// Délai de prévenance minimum (en jours) entre la soumission et le début d'une
    /// demande de télétravail. 0/null = aucune contrainte.
    /// </summary>
    [Column("parttprevenance")]
    public int? Parttprevenance { get; set; }

    /// <summary>
    /// Indemnité forfaitaire de télétravail par jour télétravaillé (montant). 0/null = aucune.
    /// Sert à alimenter une rubrique de paie : montant = jours TT × ce forfait.
    /// </summary>
    [Column("parttindemnite")]
    public float? Parttindemnite { get; set; }

    /// <summary>
    /// "1" = neutraliser le ticket-restaurant / panier les jours de télétravail
    /// (le panier n'est pas compté ces jours-là). null/"0" = comportement normal.
    /// </summary>
    [Column("parttneutralisetr")]
    [StringLength(1)]
    public string? Parttneutralisetr { get; set; }

    /// <summary>
    /// Mode de gestion des heures supplémentaires (pointage du mois) :
    ///   "A" = calcul AUTOMATIQUE — l'excédent présence/contrat hebdomadaire compte
    ///         directement comme heures sup.
    ///   null/"V" = sur DEMANDE + VALIDATION — seules les demandes d'heures sup
    ///         ([HEURES SUP]) approuvées par un manager comptent (défaut historique).
    /// Lu par HeuresSupplementaireHebdomadaireService pour activer/non le filtrage
    /// par approbation (ApplyApprovalFilterAsync).
    /// </summary>
    [Column("parhsupmode")]
    [StringLength(1)]
    public string? Parhsupmode { get; set; }
}
