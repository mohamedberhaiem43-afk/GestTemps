using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("presencej")]
public partial class Presencej : BaseEntity
{
    [Column("modcod")]
    [StringLength(20)]
    public string? Modcod { get; set; }

    [Column("uticod")]
    [StringLength(20)]
    public string? Uticod { get; set; }

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
    [StringLength(10)]
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

    [Column("preretmate")]
    [StringLength(8)]
    public string? Preretmate { get; set; }

    [Column("preretmats")]
    [StringLength(8)]
    public string? Preretmats { get; set; }

    [Column("preretame")]
    [StringLength(8)]
    public string? Preretame { get; set; }

    [Column("preretams")]
    [StringLength(8)]
    public string? Preretams { get; set; }

    [Column("preretmateup")]
    [StringLength(8)]
    public string? Preretmateup { get; set; }

    [Column("preretmatsup")]
    [StringLength(8)]
    public string? Preretmatsup { get; set; }

    [Column("preretameup")]
    [StringLength(8)]
    public string? Preretameup { get; set; }

    [Column("preretamsup")]
    [StringLength(50)]
    public string? Preretamsup { get; set; }

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
    [StringLength(10)]
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

    [Column("preconge")]
    public float? Preconge { get; set; }

    [Column("pre25hre")]
    [StringLength(6)]
    public string? Pre25hre { get; set; }

    [Column("pre50hre")]
    [StringLength(6)]
    public string? Pre50hre { get; set; }

    [Column("pre75")]
    [StringLength(6)]
    public string? Pre75 { get; set; }

    [Column("pre100")]
    [StringLength(6)]
    public string? Pre100 { get; set; }

    [Column("totret")]
    [StringLength(6)]
    public string? Totret { get; set; }

    [Column("allait")]
    public float? Allait { get; set; }

    [Column("motif")]
    [StringLength(100)]
    public string? Motif { get; set; }

    [Column("nbhre")]
    [StringLength(6)]
    public string? Nbhre { get; set; }

    [Column("emptype")]
    [StringLength(20)]
    public string? Emptype { get; set; }

    [Column("nbhjour")]
    [StringLength(6)]
    public string? Nbhjour { get; set; }

    [Column("nbhsem")]
    [StringLength(6)]
    public string? Nbhsem { get; set; }

    [Column("tothaut")]
    [StringLength(6)]
    public string? Tothaut { get; set; }

    [Column("hferie")]
    [StringLength(6)]
    public string? Hferie { get; set; }

    [Column("rubtype")]
    [StringLength(10)]
    public string? Rubtype { get; set; }

    [Column("tothrepas")]
    [StringLength(6)]
    public string? Tothrepas { get; set; }

    [Column("tothavance")]
    [StringLength(6)]
    public string? Tothavance { get; set; }

    [Column("tothretrepas")]
    [StringLength(6)]
    public string? Tothretrepas { get; set; }

    [Column("jourtrv")]
    public float? Jourtrv { get; set; }

    [Column("emplib")]
    [StringLength(100)]
    public string? Emplib { get; set; }

    [Column("hentm")]
    [StringLength(5)]
    public string? Hentm { get; set; }

    [Column("hsortm")]
    [StringLength(5)]
    public string? Hsortm { get; set; }

    [Column("henta")]
    [StringLength(5)]
    public string? Henta { get; set; }

    [Column("hsorta")]
    [StringLength(5)]
    public string? Hsorta { get; set; }

    [Column("retsanc")]
    public float? Retsanc { get; set; }

    [Column("retmin")]
    public float? Retmin { get; set; }

    [Column("retsancam")]
    public float? Retsancam { get; set; }

    [Column("retminam")]
    public float? Retminam { get; set; }

    [Column("avabon")]
    public float? Avabon { get; set; }

    [Column("avamn")]
    public float? Avamn { get; set; }

    [Column("avabonam")]
    public float? Avabonam { get; set; }

    [Column("avamnam")]
    public float? Avamnam { get; set; }

    [Column("nbhmaxjour")]
    [StringLength(5)]
    public string? Nbhmaxjour { get; set; }

    [Column("hdrepas")]
    [StringLength(5)]
    public string? Hdrepas { get; set; }

    [Column("hfrepas")]
    [StringLength(5)]
    public string? Hfrepas { get; set; }

    [Column("hentmdeb")]
    [StringLength(5)]
    public string? Hentmdeb { get; set; }

    [Column("hentadeb")]
    [StringLength(5)]
    public string? Hentadeb { get; set; }

    [Column("hentmfin")]
    [StringLength(5)]
    public string? Hentmfin { get; set; }

    [Column("hentafin")]
    [StringLength(5)]
    public string? Hentafin { get; set; }

    [Column("hconge")]
    [StringLength(5)]
    public string? Hconge { get; set; }

    [Column("habsj")]
    [StringLength(5)]
    public string? Habsj { get; set; }

    [Column("jouralt")]
    [StringLength(1)]
    public string? Jouralt { get; set; }

    [Column("repas")]
    public float? Repas { get; set; }

    [Column("jourfer")]
    public float? Jourfer { get; set; }

    [Column("empemb", TypeName = "timestamp without time zone")]
    public DateTime? Empemb { get; set; }

    [Column("empsort", TypeName = "timestamp without time zone")]
    public DateTime? Empsort { get; set; }

    [Column("jourreptrv")]
    public float? Jourreptrv { get; set; }

    [Column("hrepostrv")]
    [StringLength(8)]
    public string? Hrepostrv { get; set; }

    [Column("nbhrepos")]
    [StringLength(8)]
    public string? Nbhrepos { get; set; }

    [Column("hallait")]
    [StringLength(8)]
    public string? Hallait { get; set; }

    [Column("tothcmp")]
    [StringLength(8)]
    public string? Tothcmp { get; set; }

    [Column("tothplus")]
    [StringLength(8)]
    public string? Tothplus { get; set; }

    [Column("nbjabs")]
    public float? Nbjabs { get; set; }

    [Column("nbhabs")]
    [StringLength(8)]
    public string? Nbhabs { get; set; }

    [Column("abscng")]
    [StringLength(1)]
    public string? Abscng { get; set; }

    [Column("abspayer")]
    [StringLength(1)]
    public string? Abspayer { get; set; }

    [Column("abssanc")]
    [StringLength(1)]
    public string? Abssanc { get; set; }
}
