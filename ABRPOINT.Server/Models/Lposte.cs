using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Table("lposte")]
[PrimaryKey("Codposte","Soccod")]
public partial class Lposte
{

    [Column("codposte")]
    [StringLength(2)]
    public string? Codposte { get; set; }

    [Column("ordre")]
    public int? Ordre { get; set; }

    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("posjour")]
    [StringLength(20)]
    public string? Posjour { get; set; }

    [Column("poshredeb")]
    [StringLength(5)]
    public string? Poshredeb { get; set; }

    [Column("poshrefin")]
    [StringLength(5)]
    public string? Poshrefin { get; set; }

    [Column("postaux")]
    public float? Postaux { get; set; }

    [Column("postxrepos")]
    public float? Postxrepos { get; set; }

    //[Column("minhjour")]
    //public float? Minhjour { get; set; }

    //[Column("minhdemijour")]
    //public float? Minhdemijour { get; set; }
}
