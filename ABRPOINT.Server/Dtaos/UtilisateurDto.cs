using System.Text.Json.Serialization;

namespace ABRPOINT.Server.Dtaos
{
    public class UtilisateurDto
    {
        public string? Soccod { get; set; }
        public string? Sitcod { get; set; }
        public string? Uticod { get; set; }
        public string? Utinom { get; set; }
        public string? Utiprn { get; set; }
        [JsonIgnore]
        public string? Utimps { get; set; }
        public string? Utiactif { get; set; }
        public string? Utiadm { get; set; }
        public string? Utimail { get; set; }
    }
}
