using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("t_remboursement")]
public partial class TRemboursement : BaseEntity
{
    public int? IdAmortis { get; set; }

    public int? NoPret { get; set; }

    public int? NoEcheance { get; set; }

    [Column(TypeName = "datetime")]
    public DateTime? DateEcheance { get; set; }

    public double? MontantCapitalDu { get; set; }

    public double? MontantDesInterets { get; set; }

    public double? InteretsIntercalaires { get; set; }

    public double? Annuite { get; set; }

    public double? CapitalAmorti { get; set; }

    public int? NombreDeReports { get; set; }

    [Column(TypeName = "datetime")]
    public DateTime? DateEcheancePrevue { get; set; }

    public int? FlagagePret { get; set; }

    public double? EcartArrondiSurEcheance { get; set; }

    [StringLength(1)]
    public string? TypeRemboursement { get; set; }

    [Column(TypeName = "datetime")]
    public DateTime? DateRemboursement { get; set; }

    [StringLength(10)]
    public string? NoQuittnce { get; set; }
}
