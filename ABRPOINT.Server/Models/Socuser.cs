using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Table("socuser")]
[PrimaryKey("Soccod","Uticod","Sitcod")]
public partial class Socuser : BaseEntity
{

    [Column("soccod")]
    [StringLength(15)]
    public string? Soccod { get; set; }

    [Column("uticod")]
    [StringLength(20)]
    public string? Uticod { get; set; }

    [Column("sitcod")]
    [StringLength(2)]
    public string? Sitcod { get; set; }

    [Column("exercice")]
    [StringLength(4)]
    public string? Exercice { get; set; }

    // Service affecté à l'utilisateur sur cette société (ex. manager scopé à son service).
    // Nullable : la plupart des comptes n'ont pas de service. Cf. BaseDataSchemaMigrator.
    [Column("sercod")]
    [StringLength(4)]
    public string? Sercod { get; set; }
}
