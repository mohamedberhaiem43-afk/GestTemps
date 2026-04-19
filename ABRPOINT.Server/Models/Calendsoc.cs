
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Table("calendsoc")]
[PrimaryKey("Soccod","CalAn", "CalMois", "CalSem")]
public partial class Calendsoc : BaseEntity
{
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

    [Column("cal_hjour")]
    public float? CalHjour { get; set; }

    [Column("cal_houv")]
    public float? CalHouv { get; set; }

    [Column("callib")]
    [StringLength(30)]
    public string? Callib { get; set; }

    [Column("cal_hsem")]
    public float? CalHsem { get; set; }
}
