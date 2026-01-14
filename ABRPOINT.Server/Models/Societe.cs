using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

[Table("societe")]
public partial class Societe
{
    [Key]
    [Column("soccod")]
    [StringLength(2)]
    public string Soccod { get; set; } = null!;

    [Column("soclib")]
    [StringLength(30)]
    public string? Soclib { get; set; }

    [Column("socresp")]
    [StringLength(30)]
    public string? Socresp { get; set; }

    [Column("socadr")]
    [StringLength(40)]
    public string? Socadr { get; set; }

    [Column("soctel")]
    [StringLength(20)]
    public string? Soctel { get; set; }

    [Column("socfax")]
    [StringLength(20)]
    public string? Socfax { get; set; }

    [Column("socemail")]
    [StringLength(30)]
    public string? Socemail { get; set; }

    [Column("socccb")]
    [StringLength(1)]
    public string? Socccb { get; set; }

    [Column("soctva")]
    [StringLength(10)]
    public string? Soctva { get; set; }

    [Column("soctva1")]
    [StringLength(1)]
    public string? Soctva1 { get; set; }

    [Column("soctva2")]
    [StringLength(1)]
    public string? Soctva2 { get; set; }

    [Column("soctva3")]
    [StringLength(1)]
    public string? Soctva3 { get; set; }

    [Column("soctva000")]
    [StringLength(3)]
    public string? Soctva000 { get; set; }

    [Column("socreg")]
    public int? Socreg { get; set; }

    [Column("socmois")]
    public int? Socmois { get; set; }

    [Column("soctype")]
    [StringLength(1)]
    public string? Soctype { get; set; }

    [Column("socpresence")]
    [StringLength(1)]
    public string? Socpresence { get; set; }

    [Column("sochsup")]
    [StringLength(1)]
    public string? Sochsup { get; set; }

    [Column("socmere")]
    [StringLength(6)]
    public string? Socmere { get; set; }

    [Column("socsmig")]
    public double? Socsmig { get; set; }

    [Column("soclibar")]
    [StringLength(100)]
    public string? Soclibar { get; set; }

    [Column("socadrar")]
    [StringLength(100)]
    public string? Socadrar { get; set; }

    [Column("socrespar")]
    [StringLength(30)]
    public string? Socrespar { get; set; }

    //[Column("socimg")]
    //[StringLength(150)]
    //public string? Socimg { get; set; }
}
