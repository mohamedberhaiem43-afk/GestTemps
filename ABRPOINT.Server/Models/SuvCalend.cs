using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("suv_calend")]
public partial class SuvCalend : BaseEntity
{
    [Column("cal_date", TypeName = "datetime")]
    public DateTime? CalDate { get; set; }

    [Column("cal_an")]
    [StringLength(4)]
    public string? CalAn { get; set; }

    [Column("cal_mois")]
    [StringLength(2)]
    public string? CalMois { get; set; }

    [Column("cal_sem")]
    public int? CalSem { get; set; }

    [Column("cal_nbh")]
    public int? CalNbh { get; set; }

    [Column("cal_trav")]
    public int? CalTrav { get; set; }

    [Column("cal_col")]
    public int? CalCol { get; set; }

    [Column("cal_row")]
    public int? CalRow { get; set; }

    [Column("motif")]
    [StringLength(20)]
    public string? Motif { get; set; }

    [Column("payer")]
    [StringLength(1)]
    public string? Payer { get; set; }
}
