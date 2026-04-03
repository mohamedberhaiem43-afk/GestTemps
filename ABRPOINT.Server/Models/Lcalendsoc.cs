using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[PrimaryKey("Soccod","Caltype","CalDate")]
[Table("lcalendsoc")]
public partial class Lcalendsoc
{
    [Column("cal_date", TypeName = "datetime")]
    public DateTime? CalDate { get; set; }

    [Column("soccod")]
    [StringLength(4)]
    public string? Soccod { get; set; }

    [Column("caltype")]
    [StringLength(2)]
    public string? Caltype { get; set; }

    [Column("cal_an")]
    [StringLength(4)]
    public string? CalAn { get; set; }

    [Column("cal_mois")]
    [StringLength(2)]
    public string? CalMois { get; set; }

    [Column("cal_sem")]
    public int? CalSem { get; set; }

    [Column("cal_nbh")]
    public float? CalNbh { get; set; }

    [Column("cal_trav")]
    public float? CalTrav { get; set; }

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
