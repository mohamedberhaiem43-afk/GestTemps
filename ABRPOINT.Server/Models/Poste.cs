using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Table("poste")]
[PrimaryKey("Codposte","Soccod")]
public partial class Poste : BaseEntity
{
    [Required]
    [Column("codposte")]
    [StringLength(10)]
    public string? Codposte { get; set; }

    [Required]
    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("libposte")]
    [StringLength(100)]
    public string? Libposte { get; set; }

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

    [Column("lunhdmat")]
    [StringLength(5)]
    public string? Lunhdmat { get; set; }

    [Column("lunhfmat")]
    [StringLength(5)]
    public string? Lunhfmat { get; set; }

    [Column("lunhdam")]
    [StringLength(5)]
    public string? Lunhdam { get; set; }

    [Column("lunhfam")]
    [StringLength(5)]
    public string? Lunhfam { get; set; }

    [Column("lunrepos")]
    [StringLength(1)]
    public string? Lunrepos { get; set; }

    [Column("lunrepas")]
    public int? Lunrepas { get; set; }

    [Column("marhdmat")]
    [StringLength(5)]
    public string? Marhdmat { get; set; }

    [Column("marhfmat")]
    [StringLength(5)]
    public string? Marhfmat { get; set; }

    [Column("marhdam")]
    [StringLength(5)]
    public string? Marhdam { get; set; }

    [Column("marhfam")]
    [StringLength(5)]
    public string? Marhfam { get; set; }

    [Column("marrepos")]
    [StringLength(1)]
    public string? Marrepos { get; set; }

    [Column("marrepas")]
    public int? Marrepas { get; set; }

    [Column("merhdmat")]
    [StringLength(5)]
    public string? Merhdmat { get; set; }

    [Column("merhfmat")]
    [StringLength(5)]
    public string? Merhfmat { get; set; }

    [Column("merhdam")]
    [StringLength(5)]
    public string? Merhdam { get; set; }

    [Column("merhfam")]
    [StringLength(5)]
    public string? Merhfam { get; set; }

    [Column("merrepos")]
    [StringLength(1)]
    public string? Merrepos { get; set; }

    [Column("merrepas")]
    public int? Merrepas { get; set; }

    [Column("jeuhdmat")]
    [StringLength(5)]
    public string? Jeuhdmat { get; set; }

    [Column("jeuhfmat")]
    [StringLength(5)]
    public string? Jeuhfmat { get; set; }

    [Column("jeuhdam")]
    [StringLength(5)]
    public string? Jeuhdam { get; set; }

    [Column("jeuhfam")]
    [StringLength(5)]
    public string? Jeuhfam { get; set; }

    [Column("jeurepos")]
    [StringLength(1)]
    public string? Jeurepos { get; set; }

    [Column("jeurepas")]
    public int? Jeurepas { get; set; }

    [Column("venhdmat")]
    [StringLength(5)]
    public string? Venhdmat { get; set; }

    [Column("venhfmat")]
    [StringLength(5)]
    public string? Venhfmat { get; set; }

    [Column("venhdam")]
    [StringLength(5)]
    public string? Venhdam { get; set; }

    [Column("venhfam")]
    [StringLength(5)]
    public string? Venhfam { get; set; }

    [Column("venrepos")]
    [StringLength(1)]
    public string? Venrepos { get; set; }

    [Column("venrepas")]
    public int? Venrepas { get; set; }

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

    [Column("dimhdmat")]
    [StringLength(5)]
    public string? Dimhdmat { get; set; }

    [Column("dimhfmat")]
    [StringLength(5)]
    public string? Dimhfmat { get; set; }

    [Column("dimhdam")]
    [StringLength(5)]
    public string? Dimhdam { get; set; }

    [Column("dimhfam")]
    [StringLength(5)]
    public string? Dimhfam { get; set; }

    [Column("dimrepos")]
    [StringLength(1)]
    public string? Dimrepos { get; set; }

    [Column("dimrepas")]
    public int? Dimrepas { get; set; }

    [Column("lunhdrep")]
    [StringLength(5)]
    public string? Lunhdrep { get; set; }

    [Column("lunhfrep")]
    [StringLength(5)]
    public string? Lunhfrep { get; set; }

    [Column("marhdrep")]
    [StringLength(5)]
    public string? Marhdrep { get; set; }

    [Column("marhfrep")]
    [StringLength(5)]
    public string? Marhfrep { get; set; }

    [Column("merhdrep")]
    [StringLength(5)]
    public string? Merhdrep { get; set; }

    [Column("merhfrep")]
    [StringLength(5)]
    public string? Merhfrep { get; set; }

    [Column("jeuhdrep")]
    [StringLength(5)]
    public string? Jeuhdrep { get; set; }

    [Column("jeuhfrep")]
    [StringLength(5)]
    public string? Jeuhfrep { get; set; }

    [Column("venhdrep")]
    [StringLength(5)]
    public string? Venhdrep { get; set; }

    [Column("venhfrep")]
    [StringLength(5)]
    public string? Venhfrep { get; set; }

    [Column("samhdrep")]
    [StringLength(5)]
    public string? Samhdrep { get; set; }

    [Column("samhfrep")]
    [StringLength(5)]
    public string? Samhfrep { get; set; }

    [Column("dimhdrep")]
    [StringLength(5)]
    public string? Dimhdrep { get; set; }

    [Column("dimhfrep")]
    [StringLength(5)]
    public string? Dimhfrep { get; set; }

    [Column("lunhdematin")]
    [StringLength(5)]
    public string? Lunhdematin { get; set; }

    [Column("lunhfematin")]
    [StringLength(5)]
    public string? Lunhfematin { get; set; }

    [Column("marhdematin")]
    [StringLength(5)]
    public string? Marhdematin { get; set; }

    [Column("marhfematin")]
    [StringLength(5)]
    public string? Marhfematin { get; set; }

    [Column("merhdematin")]
    [StringLength(5)]
    public string? Merhdematin { get; set; }

    [Column("merhfematin")]
    [StringLength(5)]
    public string? Merhfematin { get; set; }

    [Column("jeuhdematin")]
    [StringLength(5)]
    public string? Jeuhdematin { get; set; }

    [Column("jeuhfematin")]
    [StringLength(5)]
    public string? Jeuhfematin { get; set; }

    [Column("venhdematin")]
    [StringLength(5)]
    public string? Venhdematin { get; set; }

    [Column("venhfematin")]
    [StringLength(5)]
    public string? Venhfematin { get; set; }

    [Column("samhdematin")]
    [StringLength(5)]
    public string? Samhdematin { get; set; }

    [Column("samhfematin")]
    [StringLength(5)]
    public string? Samhfematin { get; set; }

    [Column("dimhdematin")]
    [StringLength(5)]
    public string? Dimhdematin { get; set; }

    [Column("dimhfematin")]
    [StringLength(5)]
    public string? Dimhfematin { get; set; }

    [Column("lunhdeamidi")]
    [StringLength(5)]
    public string? Lunhdeamidi { get; set; }

    [Column("lunhfeamidi")]
    [StringLength(5)]
    public string? Lunhfeamidi { get; set; }

    [Column("marhdeamidi")]
    [StringLength(5)]
    public string? Marhdeamidi { get; set; }

    [Column("marhfeamidi")]
    [StringLength(5)]
    public string? Marhfeamidi { get; set; }

    [Column("merhdeamidi")]
    [StringLength(5)]
    public string? Merhdeamidi { get; set; }

    [Column("merhfeamidi")]
    [StringLength(5)]
    public string? Merhfeamidi { get; set; }

    [Column("jeuhdeamidi")]
    [StringLength(5)]
    public string? Jeuhdeamidi { get; set; }

    [Column("jeuhfeamidi")]
    [StringLength(5)]
    public string? Jeuhfeamidi { get; set; }

    [Column("venhdeamidi")]
    [StringLength(5)]
    public string? Venhdeamidi { get; set; }

    [Column("venhfeamidi")]
    [StringLength(5)]
    public string? Venhfeamidi { get; set; }

    [Column("samhdeamidi")]
    [StringLength(5)]
    public string? Samhdeamidi { get; set; }

    [Column("samhfeamidi")]
    [StringLength(5)]
    public string? Samhfeamidi { get; set; }

    [Column("dimhdeamidi")]
    [StringLength(5)]
    public string? Dimhdeamidi { get; set; }

    [Column("dimhfeamidi")]
    [StringLength(5)]
    public string? Dimhfeamidi { get; set; }

    [Column("arrondi")]
    public int? Arrondi { get; set; }

    [Column("arrhsup")]
    public int? Arrhsup { get; set; }

    [Column("arrhsortie")]
    public int? Arrhsortie { get; set; }

    [Column("arrhsmajore")]
    public int? Arrhsmajore { get; set; }

    [Column("arrhentree")]
    public int? Arrhentree { get; set; }

    [Column("arrhemajore")]
    public int? Arrhemajore { get; set; }

    [Column("maxhrelun")]
    [StringLength(5)]
    public string? Maxhrelun { get; set; }

    [Column("maxhremar")]
    [StringLength(5)]
    public string? Maxhremar { get; set; }

    [Column("maxhremer")]
    [StringLength(5)]
    public string? Maxhremer { get; set; }

    [Column("maxhrejeu")]
    [StringLength(5)]
    public string? Maxhrejeu { get; set; }

    [Column("maxhreven")]
    [StringLength(5)]
    public string? Maxhreven { get; set; }

    [Column("maxhresam")]
    [StringLength(5)]
    public string? Maxhresam { get; set; }

    [Column("maxhredim")]
    [StringLength(5)]
    public string? Maxhredim { get; set; }

    [Column("minhjourlun")]
    public int? Minhjourlun { get; set; }

    [Column("minhdemijourlun")]
    public int? Minhdemijourlun { get; set; }

    [Column("minhjourmar")]
    public int? Minhjourmar { get; set; }

    [Column("minhdemijourmar")]
    public int? Minhdemijourmar { get; set; }

    [Column("minhjourmer")]
    public int? Minhjourmer { get; set; }

    [Column("minhdemijourmer")]
    public int? Minhdemijourmer { get; set; }

    [Column("minhjourjeu")]
    public int? Minhjourjeu { get; set; }

    [Column("minhdemijourjeu")]
    public int? Minhdemijourjeu { get; set; }

    [Column("minhjourven")]
    public int? Minhjourven { get; set; }

    [Column("minhdemijourven")]
    public int? Minhdemijourven { get; set; }

    [Column("minhjoursam")]
    public int? Minhjoursam { get; set; }

    [Column("minhdemijoursam")]
    public int? Minhdemijoursam { get; set; }

    [Column("minhjourdim")]
    public int? Minhjourdim { get; set; }

    [Column("minhdemijourdim")]
    public int? Minhdemijourdim { get; set; }
    [Column("lundouche")]
    public float? Lundouche { get; set; }
    [Column("mardouche")]
    public float? Mardouche { get; set; }
    [Column("merdouche")]
    public float? Merdouche { get; set; }
    [Column("jeudouche")]
    public float? Jeudouche { get; set; }
    [Column("vendouche")]
    public float? Vendouche { get; set; }
    [Column("samdouche")]
    public float? Samdouche { get; set; }
    [Column("dimdouche")]
    public float? Dimdouche { get; set; }

}
