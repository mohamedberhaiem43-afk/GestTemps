using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;


[Table("presence")]
[PrimaryKey("Empcod","Predat")]
public partial class Presence : BaseEntity
{
    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("predat", TypeName = "timestamp without time zone")]
    public DateTime? Predat { get; set; }

    [Column("ordre")]
    public int? Ordre { get; set; }

    [Column("empmat")]
    [StringLength(12)]
    public string? Empmat { get; set; }

    [Column("sercod")]
    [StringLength(4)]
    public string? Sercod { get; set; }

    [Column("codposte")]
    [StringLength(10)]
    public string? Codposte { get; set; }

    [Column("preentmat")]
    [StringLength(8)]
    public string? Preentmat { get; set; }

    [Column("presortmat")]
    [StringLength(8)]
    public string? Presortmat { get; set; }

    [Column("preentamidi")]
    [StringLength(8)]
    public string? Preentamidi { get; set; }

    [Column("presortamidi")]
    [StringLength(8)]
    public string? Presortamidi { get; set; }

    [Column("preentmatup")]
    [StringLength(8)]
    public string? Preentmatup { get; set; }

    [Column("presortmatup")]
    [StringLength(8)]
    public string? Presortmatup { get; set; }

    [Column("preentamidiup")]
    [StringLength(8)]
    public string? Preentamidiup { get; set; }

    [Column("presortamidiup")]
    [StringLength(8)]
    public string? Presortamidiup { get; set; }

    [Column("preentsup")]
    [StringLength(8)]
    public string? Preentsup { get; set; }

    [Column("presortsup")]
    [StringLength(8)]
    public string? Presortsup { get; set; }

    [Column("preentasup")]
    [StringLength(8)]
    public string? Preentasup { get; set; }

    [Column("presortasup")]
    [StringLength(8)]
    public string? Presortasup { get; set; }

    [Column("preentsupup")]
    [StringLength(8)]
    public string? Preentsupup { get; set; }

    [Column("presortsupup")]
    [StringLength(8)]
    public string? Presortsupup { get; set; }

    [Column("preentasupup")]
    [StringLength(8)]
    public string? Preentasupup { get; set; }

    [Column("presortasupup")]
    [StringLength(8)]
    public string? Presortasupup { get; set; }

    [Column("presem")]
    public float? Presem { get; set; }

    [Column("prerepos")]
    [StringLength(1)]
    public string? Prerepos { get; set; }

    [Column("prerepas")]
    public float? Prerepas { get; set; }

    [Column("preretmate", TypeName = "timestamp without time zone")]
    public DateTime? Preretmate { get; set; }

    [Column("preretmats", TypeName = "timestamp without time zone")]
    public DateTime? Preretmats { get; set; }

    [Column("preretame", TypeName = "timestamp without time zone")]
    public DateTime? Preretame { get; set; }

    [Column("preretams", TypeName = "timestamp without time zone")]
    public DateTime? Preretams { get; set; }

    [Column("preretmateup", TypeName = "timestamp without time zone")]
    public DateTime? Preretmateup { get; set; }

    [Column("preretmatsup", TypeName = "timestamp without time zone")]
    public DateTime? Preretmatsup { get; set; }

    [Column("preretameup", TypeName = "timestamp without time zone")]
    public DateTime? Preretameup { get; set; }

    [Column("preretamsup", TypeName = "timestamp without time zone")]
    public DateTime? Preretamsup { get; set; }

    [Column("preavantent")]
    public float? Preavantent { get; set; }

    [Column("preapresent")]
    public float? Preapresent { get; set; }

    [Column("preavantsort")]
    public float? Preavantsort { get; set; }

    [Column("preapressort")]
    public float? Preapressort { get; set; }

    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("sitcod")]
    [StringLength(6)]
    public string? Sitcod { get; set; }

    [Column("empreg")]
    [StringLength(1)]
    public string? Empreg { get; set; }

    [Column("empcharge")]
    [StringLength(1)]
    public string? Empcharge { get; set; }

    [Column("preobs")]
    [StringLength(20)]
    public string? Preobs { get; set; }

    [Column("dmdate", TypeName = "timestamp without time zone")]
    public DateTime? Dmdate { get; set; }

    [Column("catcod")]
    [StringLength(2)]
    public string? Catcod { get; set; }

    [Column("tothre")]
    [StringLength(6)]
    public string? Tothre { get; set; }

    [Column("tothabs")]
    [StringLength(6)]
    public string? Tothabs { get; set; }

    [Column("tothsup")]
    [StringLength(6)]
    public string? Tothsup { get; set; }

    [Column("tothnuit")]
    [StringLength(6)]
    public string? Tothnuit { get; set; }

    [Column("optimise")]
    [StringLength(1)]
    public string? Optimise { get; set; }

    [Column("totcmp")]
    public float? Totcmp { get; set; }
    [Column("predouche")]
    public float? Predouche { get; set; }

    // ─── Position GPS du pointage ───
    // Renseignés par PresencesController.MarkPresence quand le mobile envoie
    // les coordonnées en query string (?lat=&lon=&acc=). Utilisés ensuite par
    // la page admin /dashboard/suivi-positions pour afficher la trace géo.
    // Précision DECIMAL(10,7) ≈ 1 cm à l'équateur — largement suffisant et
    // aligné sur Site.Sitlat/Sitlon (cf. BaseDataSchemaMigrator ligne ~93).
    // Nullable : un pointage badgeuse / web sans GPS doit rester valide.
    [Column("prelat", TypeName = "decimal(10,7)")]
    public decimal? Prelat { get; set; }

    [Column("prelon", TypeName = "decimal(10,7)")]
    public decimal? Prelon { get; set; }

    /// <summary>Précision GPS reportée par l'appareil, en mètres.</summary>
    [Column("preacc")]
    public int? Preacc { get; set; }
}
