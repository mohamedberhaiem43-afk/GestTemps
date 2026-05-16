using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("postemploye")]
public partial class Postemploye : BaseEntity
{
    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("catdeb", TypeName = "timestamp without time zone")]
    public DateTime? Catdeb { get; set; }

    [Column("catfin", TypeName = "timestamp without time zone")]
    public DateTime? Catfin { get; set; }

    [Column("codposte")]
    [StringLength(10)]
    public string? Codposte { get; set; }

    [Column("avantent")]
    public int? Avantent { get; set; }

    [Column("apresent")]
    public int? Apresent { get; set; }

    [Column("avantsort")]
    public int? Avantsort { get; set; }

    [Column("apressort")]
    public int? Apressort { get; set; }

    [Column("retsanc")]
    public int? Retsanc { get; set; }

    [Column("retmin")]
    public int? Retmin { get; set; }

    [Column("retsancam")]
    public int? Retsancam { get; set; }

    [Column("retminam")]
    public int? Retminam { get; set; }

    [Column("avabon")]
    public int? Avabon { get; set; }

    [Column("avamn")]
    public int? Avamn { get; set; }

    [Column("avabonam")]
    public int? Avabonam { get; set; }

    [Column("avamnam")]
    public int? Avamnam { get; set; }

    [Column("hredmat")]
    [StringLength(5)]
    public string? Hredmat { get; set; }

    [Column("hrefmat")]
    [StringLength(5)]
    public string? Hrefmat { get; set; }

    [Column("hredam")]
    [StringLength(5)]
    public string? Hredam { get; set; }

    [Column("hrefam")]
    [StringLength(5)]
    public string? Hrefam { get; set; }

    [Column("jourrepos")]
    [StringLength(3)]
    public string? Jourrepos { get; set; }

    [Column("hrerepas")]
    public int? Hrerepas { get; set; }

    [Column("samhdmat")]
    [StringLength(5)]
    public string? Samhdmat { get; set; }

    [Column("samhfmat")]
    [StringLength(5)]
    public string? Samhfmat { get; set; }

    [Column("samhdam")]
    [StringLength(5)]
    public string? Samhdam { get; set; }

    [Column("samhfam")]
    [StringLength(5)]
    public string? Samhfam { get; set; }

    [Column("samrepos")]
    [StringLength(1)]
    public string? Samrepos { get; set; }

    [Column("samrepas")]
    public int? Samrepas { get; set; }

    [Column("hredrep")]
    [StringLength(5)]
    public string? Hredrep { get; set; }

    [Column("hrefrep")]
    [StringLength(5)]
    public string? Hrefrep { get; set; }

    [Column("samhdrep")]
    [StringLength(5)]
    public string? Samhdrep { get; set; }

    [Column("samhfrep")]
    [StringLength(5)]
    public string? Samhfrep { get; set; }

    [Column("hredematin")]
    [StringLength(5)]
    public string? Hredematin { get; set; }

    [Column("hrefematin")]
    [StringLength(5)]
    public string? Hrefematin { get; set; }

    [Column("samhdematin")]
    [StringLength(5)]
    public string? Samhdematin { get; set; }

    [Column("samhfematin")]
    [StringLength(5)]
    public string? Samhfematin { get; set; }

    [Column("hredeamidi")]
    [StringLength(5)]
    public string? Hredeamidi { get; set; }

    [Column("hrefeamidi")]
    [StringLength(5)]
    public string? Hrefeamidi { get; set; }

    [Column("samhdeamidi")]
    [StringLength(5)]
    public string? Samhdeamidi { get; set; }

    [Column("samhfeamidi")]
    [StringLength(5)]
    public string? Samhfeamidi { get; set; }

    [Column("maxhre")]
    [StringLength(5)]
    public string? Maxhre { get; set; }

    [Column("maxhresam")]
    [StringLength(5)]
    public string? Maxhresam { get; set; }

    [Column("minhjour")]
    public int? Minhjour { get; set; }

    [Column("minhdemijour")]
    public int? Minhdemijour { get; set; }

    [Column("minhjoursam")]
    public int? Minhjoursam { get; set; }

    [Column("minhdemijoursam")]
    public int? Minhdemijoursam { get; set; }
}
