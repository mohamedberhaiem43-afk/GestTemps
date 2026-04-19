using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[PrimaryKey("Sitcod", "Soccod")]
[Table("site")]
public partial class Site : BaseEntity
{
    [Column("sitcod")]
    [StringLength(2)]
    public string Sitcod { get; set; } = null!;

    [Column("soccod")]
    [StringLength(4)]
    public string Soccod { get; set; } = null!;

    [Column("sitlib")]
    [StringLength(30)]
    public string? Sitlib { get; set; }

    [Column("sitadr")]
    [StringLength(30)]
    public string? Sitadr { get; set; }

    [Column("sittel")]
    [StringLength(20)]
    public string? Sittel { get; set; }

    [Column("sitfax")]
    [StringLength(20)]
    public string? Sitfax { get; set; }

    [Column("sitemail")]
    [StringLength(30)]
    public string? Sitemail { get; set; }

    [Column("sitmois")]
    public int? Sitmois { get; set; }

    [Column("sitconge")]
    public float? Sitconge { get; set; }

    [Column("sitsoc")]
    [StringLength(1)]
    public string? Sitsoc { get; set; }

    [Column("sitpaie")]
    [StringLength(6)]
    public string? Sitpaie { get; set; }

    [Column("sitcongem")]
    public float? Sitcongem { get; set; }

    [Column("sitsanch")]
    [StringLength(1)]
    public string? Sitsanch { get; set; }

    [Column("sitsancm")]
    [StringLength(1)]
    public string? Sitsancm { get; set; }
}
