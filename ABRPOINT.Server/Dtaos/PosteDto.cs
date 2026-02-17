using System.Text.Json.Serialization;

namespace ABRPOINT.Server.Dtaos;
public class PosteDto
{
    [JsonPropertyName("catcod")]
    public string? Catcod { get; set; }
    public string? Codposte { get; set; }
    public string? Soccod { get; set; }
    public string? Libposte { get; set; }
    public int? Avantent { get; set; }
    public int? Apresent { get; set; }
    public int? Avantsort { get; set; }
    public int? Apressort { get; set; }
    public string? Jourhdmat { get; set; }
    public string? Jourhfmat { get; set; }
    public string? Jourhdam { get; set; }
    public string? Jourhfam { get; set; }
    public string? Jourrepos { get; set; }
    public int? Jourrepas { get; set; }
    public string? Jourhdrep { get; set; }
    public string? Jourhfrep { get; set; }
    public string? Jourhdematin { get; set; }
    public string? Jourhfematin { get; set; }
    public string? Jourhdeamidi { get; set; }
    public string? Jourhfeamidi { get; set; }
    public int? Arrondi { get; set; }
    public string? Maxhrejour { get; set; }
    public float? Minhjour { get; set; }
    public float? Minhdemijour { get; set; }
    public float? Jourdouche { get; set; }

}