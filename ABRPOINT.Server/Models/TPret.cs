using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("t_pret")]
public partial class TPret : BaseEntity
{
    public int? IdPret { get; set; }

    public int? NoPret { get; set; }

    public int? NumSalarie { get; set; }

    [StringLength(10)]
    public string? TypeDePret { get; set; }

    [StringLength(100)]
    public string? LibelleDuPret { get; set; }

    public int? NoDeDecision { get; set; }

    [Column(TypeName = "datetime")]
    public DateTime? DateDecision { get; set; }

    public int? DureeDuPret { get; set; }

    [StringLength(2)]
    public string? PeriodiciteEcheance { get; set; }

    public int? NbPaliers { get; set; }

    [Column(TypeName = "datetime")]
    public DateTime? DatePremiereEcheance { get; set; }

    public double? MontantEcheance { get; set; }

    public int? MontantDuPret { get; set; }

    public int? NbEcheance { get; set; }

    public float? TauxTva { get; set; }

    public double? DifferentielMontant { get; set; }

    [StringLength(1)]
    public string? EtabPreteur { get; set; }

    public double? GarantieSalarie { get; set; }

    [StringLength(100)]
    public string? ObjetPret { get; set; }

    [Column(TypeName = "datetime")]
    public DateTime? DateDeblocage { get; set; }

    public int? Franchise { get; set; }

    public int? Bareme { get; set; }

    [Column(TypeName = "datetime")]
    public DateTime? FinFranchise { get; set; }

    [StringLength(1)]
    public string? PretDebloque { get; set; }

    public double? PretSolde { get; set; }

    [Column(TypeName = "datetime")]
    public DateTime? DateProchaineEcheance { get; set; }

    public double? MontantAmortissement { get; set; }

    public int? NbEcheancesRestantes { get; set; }

    public double? MontantRestant { get; set; }

    public float? TauxInteret { get; set; }

    [StringLength(1)]
    public string? ModePaiement { get; set; }

    [Column(TypeName = "datetime")]
    public DateTime? DateRemboursementAnticipe { get; set; }

    public double? MontantGarantie { get; set; }

    [StringLength(10)]
    public string? RubriqueRemboursement { get; set; }

    [StringLength(10)]
    public string? TypeDeTable { get; set; }

    [StringLength(1)]
    public string? FlagInfosGenerales { get; set; }

    [StringLength(1)]
    public string? CalculAutomatique { get; set; }
}
