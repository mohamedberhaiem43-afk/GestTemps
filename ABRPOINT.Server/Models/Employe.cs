using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[PrimaryKey("Empcod", "Soccod", "Sitcod")]
[Table("employe")]
public partial class Employe
{
    [Required]
    [Column("empcod")]
    [StringLength(12)]
    public string Empcod { get; set; } = null!;

    [Required]
    [Column("soccod")]
    [StringLength(6)]
    public string Soccod { get; set; } = null!;

    [Column("sitcod")]
    [StringLength(2)]
    public string Sitcod { get; set; } = null!;

    [Column("emplib")]
    [StringLength(100)]
    public string? Emplib { get; set; }

    [Column("empmat")]
    [StringLength(12)]
    public string? Empmat { get; set; }

    [Column("empsexe")]
    [StringLength(1)]
    public string? Empsexe { get; set; }

    [Column("sercod")]
    [StringLength(4)]
    public string? Sercod { get; set; }

    [Column("empfonc")]
    [StringLength(40)]
    public string? Empfonc { get; set; }

    [Column("empreg")]
    [StringLength(1)]
    public string? Empreg { get; set; }

    [Column("catcod")]
    [StringLength(2)]
    public string? Catcod { get; set; }

    [Column("empnbp")]
    public int? Empnbp { get; set; }

    [Column("natcod")]
    [StringLength(4)]
    public string? Natcod { get; set; }

    [Column("vilcod")]
    [StringLength(4)]
    public string? Vilcod { get; set; }

    [Column("empadr")]
    [StringLength(100)]
    [Unicode(false)]
    public string? Empadr { get; set; }

    [Column("emptel")]
    [StringLength(50)]
    [Unicode(false)]
    public string? Emptel { get; set; }

    [Column("empmob", TypeName = "text")]
    public string? Empmob { get; set; }

    [Column("empemb", TypeName = "datetime")]
    public DateTime? Empemb { get; set; }

    [Column("empsort", TypeName = "datetime")]
    public DateTime? Empsort { get; set; }

    [Column("empmotif")]
    [StringLength(20)]
    public string? Empmotif { get; set; }

    [Column("actif")]
    [StringLength(1)]
    public string? Actif { get; set; }

    [Column("empdnais")]
    [StringLength(20)]
    public string? Empdnais { get; set; }

    [Column("emplnais")]
    [StringLength(20)]
    public string? Emplnais { get; set; }

    [Column("empcin")]
    [StringLength(15)]
    public string? Empcin { get; set; }

    [Column("empdcin", TypeName = "datetime")]
    public DateTime? Empdcin { get; set; }

    [Column("empacin")]
    [StringLength(20)]
    public string? Empacin { get; set; }

    [Column("empsbase")]
    public double? Empsbase { get; set; }

    [Column("empsbrut")]
    public double? Empsbrut { get; set; }

    [Column("empdir")]
    [StringLength(1)]
    public string? Empdir { get; set; }

    [Column("emptype")]
    [StringLength(1)]
    public string? Emptype { get; set; }

    [Column("empniv")]
    [StringLength(1)]
    public string? Empniv { get; set; }

    [Column("emplibar")]
    [StringLength(50)]
    public string? Emplibar { get; set; }

    [Column("empadrar")]
    [StringLength(50)]
    public string? Empadrar { get; set; }

    [Column("empfoncar")]
    [StringLength(50)]
    public string? Empfoncar { get; set; }

    [Column("foncod")]
    [StringLength(6)]
    public string? Foncod { get; set; }

    [Column("quacod")]
    [StringLength(6)]
    public string? Quacod { get; set; }

    [Column("empmaxhre")]
    public double? Empmaxhre { get; set; }

    [Column("empoptim", TypeName = "datetime")]
    public DateTime? Empoptim { get; set; }

    [Column("dircod")]
    [StringLength(10)]
    public string? Dircod { get; set; }

    [Column("empretraite", TypeName = "datetime")]
    public DateTime? Empretraite { get; set; }

    [Column("caltype")]
    [StringLength(2)]
    public string? Caltype { get; set; }

    [Column("empmaxjour")]
    public double? Empmaxjour { get; set; }

    [Column("empretard")]
    [StringLength(1)]
    public string? Empretard { get; set; }

    [Column("empemail")]
    [StringLength(30)]
    public string? Empemail { get; set; }

    [Column("empresp")]
    [StringLength(12)]
    public string? Empresp { get; set; }

    [Column("empsnet")]
    public double? Empsnet { get; set; }

    [Column("empcontrat")]
    [StringLength(50)]
    public string? Empcontrat { get; set; }

    [Column("empsitfam")]
    [StringLength(1)]
    public string? Empsitfam { get; set; }

    [Column("empech")]
    [StringLength(3)]
    public string? Empech { get; set; }

    [Column("empelon")]
    [StringLength(2)]
    public string? Empelon { get; set; }

    [Column("empcat")]
    [StringLength(4)]
    public string? Empcat { get; set; }

    [Column("empscat")]
    [StringLength(4)]
    public string? Empscat { get; set; }

    [Column("empnuit")]
    [StringLength(1)]
    public string? Empnuit { get; set; }

    [Column("empminhjour")]
    public int? Empminhjour { get; set; }

    [Column("emppanier")]
    [StringLength(1)]
    public string? Emppanier { get; set; }

    [Column("seccod")]
    [StringLength(10)]
    public string? Seccod { get; set; }

    [Column("poscod")]
    [StringLength(10)]
    public string? Poscod { get; set; }
    [Column("empferepos")]
    [StringLength(1)]
    public string? Empferepos { get; set; }
    [Column("empcmp")]
    [StringLength(1)]
    public string? Empcmp { get; set; }

}
