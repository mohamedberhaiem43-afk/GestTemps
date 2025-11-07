using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[PrimaryKey("Catcod","Soccod")]
[Table("categorie")]
public partial class Categorie
{
    [Column("catcod")]
    [StringLength(2)]
    public string? Catcod { get; set; }

    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("catlib")]
    [StringLength(30)]
    public string? Catlib { get; set; }

    [Column("cathsup")]
    [StringLength(1)]
    public string? Cathsup { get; set; }

    [Column("catperiode")]
    [StringLength(1)]
    public string? Catperiode { get; set; }

    [Column("catsem2")]
    [StringLength(2)]
    public string? Catsem2 { get; set; }

    [Column("catsem3")]
    [StringLength(2)]
    public string? Catsem3 { get; set; }

    [Column("catsem4")]
    [StringLength(2)]
    public string? Catsem4 { get; set; }

    [Column("catsem5")]
    [StringLength(2)]
    public string? Catsem5 { get; set; }

    [Column("catsem6")]
    [StringLength(2)]
    public string? Catsem6 { get; set; }

    [Column("catsem7")]
    [StringLength(2)]
    public string? Catsem7 { get; set; }

    [Column("catsem8")]
    [StringLength(2)]
    public string? Catsem8 { get; set; }

    [Column("catsem9")]
    [StringLength(2)]
    public string? Catsem9 { get; set; }

    [Column("catsem10")]
    [StringLength(2)]
    public string? Catsem10 { get; set; }

    [Column("catsem11")]
    [StringLength(2)]
    public string? Catsem11 { get; set; }

    [Column("catsem12")]
    [StringLength(2)]
    public string? Catsem12 { get; set; }
}
