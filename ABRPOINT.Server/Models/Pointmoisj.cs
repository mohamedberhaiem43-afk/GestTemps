using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("pointmoisj")]
public partial class Pointmoisj : BaseEntity
{
    [Column("modcod")]
    [StringLength(20)]
    public string? Modcod { get; set; }

    [Column("uticod")]
    [StringLength(20)]
    public string? Uticod { get; set; }

    [Column("soccod")]
    [StringLength(10)]
    public string? Soccod { get; set; }

    [Column("ordre")]
    public int? Ordre { get; set; }

    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("empmat")]
    [StringLength(12)]
    public string? Empmat { get; set; }

    [Column("emplib")]
    [StringLength(50)]
    public string? Emplib { get; set; }

    [Column("empreg")]
    [StringLength(1)]
    public string? Empreg { get; set; }

    [Column("preconge")]
    public float? Preconge { get; set; }

    [Column("pre25hre")]
    [StringLength(8)]
    public string? Pre25hre { get; set; }

    [Column("pre50hre")]
    [StringLength(8)]
    public string? Pre50hre { get; set; }

    [Column("pre75")]
    [StringLength(8)]
    public string? Pre75 { get; set; }

    [Column("pre100")]
    [StringLength(8)]
    public string? Pre100 { get; set; }

    [Column("totret")]
    [StringLength(8)]
    public string? Totret { get; set; }

    [Column("tothre")]
    [StringLength(8)]
    public string? Tothre { get; set; }

    [Column("allait")]
    public int? Allait { get; set; }

    [Column("jours")]
    public float? Jours { get; set; }

    [Column("j01")]
    [StringLength(6)]
    public string? J01 { get; set; }

    [Column("j02")]
    [StringLength(6)]
    public string? J02 { get; set; }

    [Column("j03")]
    [StringLength(6)]
    public string? J03 { get; set; }

    [Column("j04")]
    [StringLength(6)]
    public string? J04 { get; set; }

    [Column("j05")]
    [StringLength(6)]
    public string? J05 { get; set; }

    [Column("j06")]
    [StringLength(6)]
    public string? J06 { get; set; }

    [Column("j07")]
    [StringLength(6)]
    public string? J07 { get; set; }

    [Column("j08")]
    [StringLength(6)]
    public string? J08 { get; set; }

    [Column("j09")]
    [StringLength(6)]
    public string? J09 { get; set; }

    [Column("j10")]
    [StringLength(6)]
    public string? J10 { get; set; }

    [Column("j11")]
    [StringLength(6)]
    public string? J11 { get; set; }

    [Column("j12")]
    [StringLength(6)]
    public string? J12 { get; set; }

    [Column("j13")]
    [StringLength(6)]
    public string? J13 { get; set; }

    [Column("j14")]
    [StringLength(6)]
    public string? J14 { get; set; }

    [Column("j15")]
    [StringLength(6)]
    public string? J15 { get; set; }

    [Column("j16")]
    [StringLength(6)]
    public string? J16 { get; set; }

    [Column("j17")]
    [StringLength(6)]
    public string? J17 { get; set; }

    [Column("j18")]
    [StringLength(6)]
    public string? J18 { get; set; }

    [Column("j19")]
    [StringLength(6)]
    public string? J19 { get; set; }

    [Column("j20")]
    [StringLength(6)]
    public string? J20 { get; set; }

    [Column("j21")]
    [StringLength(6)]
    public string? J21 { get; set; }

    [Column("j22")]
    [StringLength(6)]
    public string? J22 { get; set; }

    [Column("j23")]
    [StringLength(6)]
    public string? J23 { get; set; }

    [Column("j24")]
    [StringLength(6)]
    public string? J24 { get; set; }

    [Column("j25")]
    [StringLength(6)]
    public string? J25 { get; set; }

    [Column("j26")]
    [StringLength(6)]
    public string? J26 { get; set; }

    [Column("j27")]
    [StringLength(6)]
    public string? J27 { get; set; }

    [Column("j28")]
    [StringLength(6)]
    public string? J28 { get; set; }

    [Column("j29")]
    [StringLength(6)]
    public string? J29 { get; set; }

    [Column("j30")]
    [StringLength(6)]
    public string? J30 { get; set; }

    [Column("j31")]
    [StringLength(6)]
    public string? J31 { get; set; }

    [Column("j32")]
    [StringLength(6)]
    public string? J32 { get; set; }

    [Column("j33")]
    [StringLength(6)]
    public string? J33 { get; set; }

    [Column("j34")]
    [StringLength(6)]
    public string? J34 { get; set; }

    [Column("j35")]
    [StringLength(6)]
    public string? J35 { get; set; }

    [Column("j36")]
    [StringLength(6)]
    public string? J36 { get; set; }

    [Column("j37")]
    [StringLength(6)]
    public string? J37 { get; set; }

    [Column("j38")]
    [StringLength(6)]
    public string? J38 { get; set; }

    [Column("j39")]
    [StringLength(6)]
    public string? J39 { get; set; }

    [Column("j40")]
    [StringLength(6)]
    public string? J40 { get; set; }

    [Column("j41")]
    [StringLength(6)]
    public string? J41 { get; set; }

    [Column("c01")]
    [StringLength(8)]
    public string? C01 { get; set; }

    [Column("c02")]
    [StringLength(8)]
    public string? C02 { get; set; }

    [Column("c03")]
    [StringLength(8)]
    public string? C03 { get; set; }

    [Column("c04")]
    [StringLength(8)]
    public string? C04 { get; set; }

    [Column("c05")]
    [StringLength(8)]
    public string? C05 { get; set; }

    [Column("c06")]
    [StringLength(8)]
    public string? C06 { get; set; }

    [Column("c07")]
    [StringLength(8)]
    public string? C07 { get; set; }

    [Column("c08")]
    [StringLength(8)]
    public string? C08 { get; set; }

    [Column("c09")]
    [StringLength(8)]
    public string? C09 { get; set; }

    [Column("c10")]
    [StringLength(8)]
    public string? C10 { get; set; }

    [Column("c11")]
    [StringLength(8)]
    public string? C11 { get; set; }

    [Column("c12")]
    [StringLength(8)]
    public string? C12 { get; set; }

    [Column("c13")]
    [StringLength(8)]
    public string? C13 { get; set; }

    [Column("c14")]
    [StringLength(8)]
    public string? C14 { get; set; }

    [Column("c15")]
    [StringLength(8)]
    public string? C15 { get; set; }

    [Column("c16")]
    [StringLength(8)]
    public string? C16 { get; set; }

    [Column("c17")]
    [StringLength(8)]
    public string? C17 { get; set; }

    [Column("c18")]
    [StringLength(8)]
    public string? C18 { get; set; }

    [Column("c19")]
    [StringLength(8)]
    public string? C19 { get; set; }

    [Column("c20")]
    [StringLength(8)]
    public string? C20 { get; set; }

    [Column("c21")]
    [StringLength(8)]
    public string? C21 { get; set; }

    [Column("c22")]
    [StringLength(8)]
    public string? C22 { get; set; }

    [Column("c23")]
    [StringLength(8)]
    public string? C23 { get; set; }

    [Column("c24")]
    [StringLength(8)]
    public string? C24 { get; set; }

    [Column("c25")]
    [StringLength(8)]
    public string? C25 { get; set; }

    [Column("c26")]
    [StringLength(8)]
    public string? C26 { get; set; }

    [Column("c27")]
    [StringLength(8)]
    public string? C27 { get; set; }

    [Column("c28")]
    [StringLength(8)]
    public string? C28 { get; set; }

    [Column("c29")]
    [StringLength(8)]
    public string? C29 { get; set; }

    [Column("c30")]
    [StringLength(8)]
    public string? C30 { get; set; }

    [Column("c31")]
    [StringLength(8)]
    public string? C31 { get; set; }

    [Column("c32")]
    [StringLength(8)]
    public string? C32 { get; set; }

    [Column("c33")]
    [StringLength(8)]
    public string? C33 { get; set; }

    [Column("c34")]
    [StringLength(8)]
    public string? C34 { get; set; }

    [Column("c35")]
    [StringLength(8)]
    public string? C35 { get; set; }

    [Column("c36")]
    [StringLength(8)]
    public string? C36 { get; set; }

    [Column("c37")]
    [StringLength(8)]
    public string? C37 { get; set; }

    [Column("c38")]
    [StringLength(8)]
    public string? C38 { get; set; }

    [Column("c39")]
    [StringLength(8)]
    public string? C39 { get; set; }

    [Column("c40")]
    [StringLength(8)]
    public string? C40 { get; set; }

    [Column("c41")]
    [StringLength(8)]
    public string? C41 { get; set; }

    [Column("annee")]
    [StringLength(4)]
    public string? Annee { get; set; }

    [Column("mois")]
    [StringLength(2)]
    public string? Mois { get; set; }

    [Column("chantier")]
    public int? Chantier { get; set; }

    [Column("semaine1")]
    [StringLength(8)]
    public string? Semaine1 { get; set; }

    [Column("semaine2")]
    [StringLength(8)]
    public string? Semaine2 { get; set; }

    [Column("semaine3")]
    [StringLength(8)]
    public string? Semaine3 { get; set; }

    [Column("semaine4")]
    [StringLength(8)]
    public string? Semaine4 { get; set; }

    [Column("semaine5")]
    [StringLength(8)]
    public string? Semaine5 { get; set; }

    [Column("totsem")]
    [StringLength(8)]
    public string? Totsem { get; set; }

    [Column("absnj")]
    public float? Absnj { get; set; }

    [Column("renvoi")]
    public float? Renvoi { get; set; }

    [Column("absjust")]
    public float? Absjust { get; set; }

    [Column("nsemaine")]
    public int? Nsemaine { get; set; }

    [Column("tothren")]
    [StringLength(7)]
    public string? Tothren { get; set; }

    [Column("totcsf")]
    public float? Totcsf { get; set; }

    [Column("totfer")]
    public float? Totfer { get; set; }

    [Column("totrepos")]
    public float? Totrepos { get; set; }

    [Column("totnuit")]
    [StringLength(7)]
    public string? Totnuit { get; set; }

    [Column("sitcod")]
    [StringLength(6)]
    public string? Sitcod { get; set; }

    [Column("sitlib")]
    [StringLength(50)]
    public string? Sitlib { get; set; }

    [Column("tothrep")]
    [StringLength(7)]
    public string? Tothrep { get; set; }

    [Column("tothfertrv")]
    [StringLength(7)]
    public string? Tothfertrv { get; set; }

    [Column("tothfer2trv")]
    [StringLength(7)]
    public string? Tothfer2trv { get; set; }

    [Column("totimp")]
    [StringLength(7)]
    public string? Totimp { get; set; }

    [Column("jourabs")]
    public double? Jourabs { get; set; }

    [Column("jfertrv")]
    public double? Jfertrv { get; set; }

    [Column("tothabs")]
    [StringLength(7)]
    public string? Tothabs { get; set; }

    [Column("tothaut")]
    [StringLength(7)]
    public string? Tothaut { get; set; }

    [Column("preconga")]
    public float? Preconga { get; set; }

    [Column("preabsa")]
    public float? Preabsa { get; set; }

    [Column("rephaut")]
    [StringLength(7)]
    public string? Rephaut { get; set; }

    [Column("rephret")]
    [StringLength(7)]
    public string? Rephret { get; set; }

    [Column("abspaye")]
    public double? Abspaye { get; set; }

    [Column("jourequis")]
    public double? Jourequis { get; set; }

    [Column("tothauta")]
    [StringLength(7)]
    public string? Tothauta { get; set; }

    [Column("tothreta")]
    [StringLength(7)]
    public string? Tothreta { get; set; }

    [Column("empnuit")]
    [StringLength(1)]
    public string? Empnuit { get; set; }

    [Column("totjpanier")]
    public double? Totjpanier { get; set; }

    [Column("totjpoint")]
    public double? Totjpoint { get; set; }

    [Column("totjnuit")]
    public double? Totjnuit { get; set; }

    [Column("empsbase")]
    public double? Empsbase { get; set; }

    [Column("totjact")]
    public double? Totjact { get; set; }

    [Column("totjaj")]
    public double? Totjaj { get; set; }

    [Column("totjfm")]
    public double? Totjfm { get; set; }

    [Column("totjart")]
    public double? Totjart { get; set; }

    [Column("totjmal")]
    public double? Totjmal { get; set; }

    [Column("totjanj")]
    public double? Totjanj { get; set; }

    [Column("totjcss")]
    public double? Totjcss { get; set; }

    [Column("totjmap")]
    public double? Totjmap { get; set; }

    [Column("tothferie")]
    [StringLength(8)]
    public string? Tothferie { get; set; }

    [Column("tothcsf")]
    [StringLength(8)]
    public string? Tothcsf { get; set; }

    [Column("tothconge")]
    [StringLength(8)]
    public string? Tothconge { get; set; }

    [Column("hallait")]
    [StringLength(8)]
    public string? Hallait { get; set; }

    [Column("caltype")]
    [StringLength(10)]
    public string? Caltype { get; set; }

    [Column("semaine6")]
    [StringLength(8)]
    public string? Semaine6 { get; set; }

    [Column("catcod")]
    [StringLength(10)]
    public string? Catcod { get; set; }

    [Column("cathsup")]
    [StringLength(1)]
    public string? Cathsup { get; set; }

    [Column("empniv")]
    [StringLength(1)]
    public string? Empniv { get; set; }

    [Column("tothart")]
    [StringLength(8)]
    public string? Tothart { get; set; }

    [Column("totjdouche")]
    public double? Totjdouche { get; set; }
}
