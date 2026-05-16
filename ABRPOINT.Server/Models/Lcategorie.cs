using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;


[Table("lcategorie")]
public partial class Lcategorie : BaseEntity
{
    [Key]
    [Column("ordre")]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Ordre { get; set; }

    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("catcod")]
    [StringLength(2)]
    public string? Catcod { get; set; }

    [Column("codposte")]
    [StringLength(2)]
    public string? Codposte { get; set; }

    [Column("catdu", TypeName = "timestamp without time zone")]
    public DateTime? Catdu { get; set; }

    [Column("catau", TypeName = "timestamp without time zone")]
    public DateTime? Catau { get; set; }

    [Column("catfixe")]
    [StringLength(1)]
    public string? Catfixe { get; set; }

    [Column("cat25de")]
    [StringLength(8)]
    public string? Cat25de { get; set; }

    [Column("cat25a")]
    [StringLength(8)]
    public string? Cat25a { get; set; }

    [Column("cattaux25")]
    public float? Cattaux25 { get; set; }

    [Column("catjour25")]
    [StringLength(1)]
    public string? Catjour25 { get; set; }

    [Column("cat50de")]
    [StringLength(8)]
    public string? Cat50de { get; set; }

    [Column("cat50a")]
    [StringLength(8)]
    public string? Cat50a { get; set; }

    [Column("cattaux50")]
    public float? Cattaux50 { get; set; }

    [Column("catjour50")]
    [StringLength(1)]
    public string? Catjour50 { get; set; }

    [Column("cat75de")]
    [StringLength(8)]
    public string? Cat75de { get; set; }

    [Column("cat75a")]
    [StringLength(8)]
    public string? Cat75a { get; set; }

    [Column("cattaux75")]
    public float? Cattaux75 { get; set; }

    [Column("catjour75")]
    [StringLength(1)]
    public string? Catjour75 { get; set; }

    [Column("cat100de")]
    [StringLength(8)]
    public string? Cat100de { get; set; }

    [Column("cat100a")]
    [StringLength(8)]
    public string? Cat100a { get; set; }

    [Column("cattaux100")]
    public float? Cattaux100 { get; set; }

    [Column("catjour100")]
    [StringLength(1)]
    public string? Catjour100 { get; set; }

    [Column("cat100rde")]
    [StringLength(8)]
    public string? Cat100rde { get; set; }

    [Column("cat100ra")]
    [StringLength(8)]
    public string? Cat100ra { get; set; }

    [Column("cattauxr100")]
    public float? Cattauxr100 { get; set; }

    [Column("catjourr100")]
    [StringLength(1)]
    public string? Catjourr100 { get; set; }
}
