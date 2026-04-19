using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace ABRPOINT.Server.Models;

[Table("utilisateur")]
public partial class Utilisateur : BaseEntity
{
    [Key]
    [Column("uticod")]
    [StringLength(20)]
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

    [Column("utirole")]
    [StringLength(50)]
    public string? Utirole { get; set; }

    [Column("uti2fa_enabled")]
    [StringLength(1)]
    public string? UtiTwoFactorEnabled { get; set; }

    [Column("uti2fa_secret")]
    [StringLength(200)]
    public string? UtiTwoFactorSecret { get; set; }
    public string? UtiResetCode { get; set; }
    public DateTime? UtiResetCodeExpiry { get; set; }
}
