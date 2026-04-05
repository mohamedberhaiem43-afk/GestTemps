using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

[Table("moduser")]
public partial class Moduser
{
    [Key]
    [Column("ordre")]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int? Ordre { get; set; }

    [Column("modcod")]
    [StringLength(15)]
    public string? Modcod { get; set; }

    [Column("uticod")]
    [StringLength(20)]
    public string? Uticod { get; set; }

    [Column("appcod")]
    [StringLength(3)]
    public string? Appcod { get; set; }

    [Column("modsais")]
    [StringLength(1)]
    public string? Modsais { get; set; }

    [Column("modupd")]
    [StringLength(1)]
    public string? Modupd { get; set; }

    [Column("modsupp")]
    [StringLength(1)]
    public string? Modsupp { get; set; }

    [Column("modconsult")]
    [StringLength(1)]
    public string? Modconsult { get; set; }

    [Column("description")]
    [StringLength(50)]
    public string? Description { get; set; }
}
