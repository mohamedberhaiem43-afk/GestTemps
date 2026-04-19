using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("~TMPCLP651021")]
public partial class Tmpclp651021 : BaseEntity
{
    [Column("uticod")]
    [StringLength(10)]
    public string? Uticod { get; set; }

    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("predat", TypeName = "datetime")]
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
    public int? Presem { get; set; }

    [Column("prerepos")]
    [StringLength(1)]
    public string? Prerepos { get; set; }

    [Column("prerepas")]
    public int? Prerepas { get; set; }

    [Column("preretmate", TypeName = "datetime")]
    public DateTime? Preretmate { get; set; }

    [Column("preretmats", TypeName = "datetime")]
    public DateTime? Preretmats { get; set; }

    [Column("preretame", TypeName = "datetime")]
    public DateTime? Preretame { get; set; }

    [Column("preretams", TypeName = "datetime")]
    public DateTime? Preretams { get; set; }

    [Column("preretmateup", TypeName = "datetime")]
    public DateTime? Preretmateup { get; set; }

    [Column("preretmatsup", TypeName = "datetime")]
    public DateTime? Preretmatsup { get; set; }

    [Column("preretameup", TypeName = "datetime")]
    public DateTime? Preretameup { get; set; }

    [Column("preretamsup", TypeName = "datetime")]
    public DateTime? Preretamsup { get; set; }

    [Column("preavantent")]
    public int? Preavantent { get; set; }

    [Column("preapresent")]
    public int? Preapresent { get; set; }

    [Column("preavantsort")]
    public int? Preavantsort { get; set; }

    [Column("preapressort")]
    public int? Preapressort { get; set; }

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

    [Column("dmdate", TypeName = "datetime")]
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
    public int? Totcmp { get; set; }

    [Column("emptype")]
    [StringLength(255)]
    public string? Emptype { get; set; }

    [Column("nbhjour")]
    [StringLength(255)]
    public string? Nbhjour { get; set; }

    [Column("totnuit")]
    [StringLength(255)]
    public string? Totnuit { get; set; }

    [Column("catcod1")]
    [StringLength(255)]
    public string? Catcod1 { get; set; }

    [Column("nbhsem")]
    [StringLength(255)]
    public string? Nbhsem { get; set; }

    [Column("hferie")]
    [StringLength(255)]
    public string? Hferie { get; set; }

    [Column("rubtype")]
    [StringLength(255)]
    public string? Rubtype { get; set; }

    [Column("soccod1")]
    [StringLength(255)]
    public string? Soccod1 { get; set; }

    [Column("tothabs1")]
    [StringLength(255)]
    public string? Tothabs1 { get; set; }

    [Column("tothaut")]
    [StringLength(255)]
    public string? Tothaut { get; set; }

    [Column("tothrepas")]
    [StringLength(255)]
    public string? Tothrepas { get; set; }

    [Column("tothavance")]
    [StringLength(255)]
    public string? Tothavance { get; set; }

    [Column("tothsup1")]
    [StringLength(255)]
    public string? Tothsup1 { get; set; }

    [Column("tothretrepas")]
    [StringLength(255)]
    public string? Tothretrepas { get; set; }

    [Column("preobs1")]
    [StringLength(255)]
    public string? Preobs1 { get; set; }

    [Column("optimise1")]
    [StringLength(255)]
    public string? Optimise1 { get; set; }

    [Column("totcmp1")]
    public double? Totcmp1 { get; set; }
}
