using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
namespace ABRPOINT.Server.Models;

[Table("utilisateur")]
public partial class Utilisateur
{
    [Key]
    [Column("uticod")]
    [StringLength(2)]
    public string? Uticod { get; set; }

    [Column("utinom")]
    [StringLength(20)]
    public string? Utinom { get; set; }

    [Column("utiprn")]
    [StringLength(20)]
    public string? Utiprn { get; set; }

    [Column("utimps")]
    [StringLength(100)]
    public string? Utimps { get; set; }

    [Column("utiactif")]
    [StringLength(1)]
    public string? Utiactif { get; set; }
    [Column("utiadm")]
    [StringLength(150)]
    public string? Utiadm { get; set; }
    [StringLength(100)]
    public string? Utimail { get; set; }
    [Column("utiimg")]
    [StringLength(500)]
    public string? Utiimg { get; set; }
}
