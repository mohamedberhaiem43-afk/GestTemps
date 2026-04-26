using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[PrimaryKey("Soccod", "Concod")]
[Table("contrat")]
public partial class Contrat : BaseEntity
{
    [Key]
    [Column("soccod")]
    [StringLength(4)]
    public string Soccod { get; set; } = null!;

    [Key]
    [Column("concod")]
    [StringLength(9)]
    public string Concod { get; set; } = null!;

    [Column("empcod")]
    [StringLength(12)]
    public string Empcod { get; set; } = null!;

    [Column("condat", TypeName = "datetime")]
    public DateTime? Condat { get; set; }

    [Column("contype")]
    [StringLength(1)]
    public string? Contype { get; set; }

    [Column("sitcod")]
    [StringLength(2)]
    public string? Sitcod { get; set; }

    [Column("sercod")]
    [StringLength(4)]
    public string? Sercod { get; set; }

    [Column("empreg")]
    [StringLength(1)]
    public string? Empreg { get; set; }

    [Column("catcod")]
    [StringLength(2)]
    public string? Catcod { get; set; }

    [Column("vilcod")]
    [StringLength(4)]
    public string? Vilcod { get; set; }

    [Column("empadr")]
    [StringLength(100)]
    public string? Empadr { get; set; }

    [Column("emppost")]
    [StringLength(60)]
    public string? Emppost { get; set; }

    [Column("emptel")]
    [StringLength(256)]
    [Unicode(false)]
    public string? Emptel { get; set; }

    [Column("empemb", TypeName = "datetime")]
    public DateTime? Empemb { get; set; }

    [Column("empsort", TypeName = "datetime")]
    public DateTime? Empsort { get; set; }

    [Column("condg")]
    [StringLength(1)]
    public string? Condg { get; set; }

    [Column("empmotif")]
    [StringLength(100)]
    public string? Empmotif { get; set; }

    [Column("empdcin", TypeName = "datetime")]
    public DateTime? Empdcin { get; set; }

    [Column("empacin")]
    [StringLength(8)]
    public string? Empacin { get; set; }

    [Column("quacod")]
    [StringLength(4)]
    public string? Quacod { get; set; }

    [Column("empech")]
    [StringLength(3)]
    public string? Empech { get; set; }

    [Column("empelon")]
    [StringLength(2)]
    public string? Empelon { get; set; }

    [Column("empcat")]
    [StringLength(100)]
    public string? Empcat { get; set; }

    [Column("empscat")]
    [StringLength(100)]
    public string? Empscat { get; set; }

    [Column("cnscod")]
    [StringLength(6)]
    public string? Cnscod { get; set; }

    [Column("empsbase")]
    public float? Empsbase { get; set; }

    [Column("empsbrut")]
    public float? Empsbrut { get; set; }

    [Column("socresp")]
    [StringLength(80)]
    public string? Socresp { get; set; }

    [Column("dircod")]
    [StringLength(10)]
    public string? Dircod { get; set; }

    [Column("empcontrat")]
    [StringLength(100)]
    public string? Empcontrat { get; set; }
    
    [Column("conmois")]
    public float? Conmois { get; set; }
}
