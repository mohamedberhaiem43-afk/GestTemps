using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

[Table("direction")]
public partial class Direction : BaseEntity
{
    [Column("dircod")]
    [StringLength(4)]
    public string? Dircod { get; set; }

    [Column("soccod")]
    [StringLength(4)]
    public string? Soccod { get; set; }

    [Column("dirlib")]
    [StringLength(30)]
    public string? Dirlib { get; set; }

    [Column("dirloc")]
    [StringLength(100)]
    public string? Dirloc { get; set; }

    [Column("dirtitre")]
    [StringLength(50)]
    public string? Dirtitre { get; set; }

    [Column("dirresp")]
    [StringLength(100)]
    public string? Dirresp { get; set; }

    [Column("dirrespar")]
    [StringLength(100)]
    public string? Dirrespar { get; set; }

    [Column("diremail")]
    [StringLength(30)]
    public string? Diremail { get; set; }
}
