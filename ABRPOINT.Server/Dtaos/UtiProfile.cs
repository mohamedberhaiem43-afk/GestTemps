using System.Text.Json.Serialization;

namespace ABRPOINT.Server.Dtaos
{
    public class UtiProfile
    {
        public string? Soccod { get; set; }
        public string? Sitcod { get; set; }
        public string? Utiadm { get; set; }
        public string? Uticod { get; set; }
        public string? Utinom { get; set; }
        public string? Utiprn { get; set; }
        public string? Utimail { get; set; }
        public string? Utirole { get; set; }
        public string? Utiimg { get; set; }
        public string? Soclib { get; set; }
        public EmployeDto? Employee { get; set; }

        [JsonPropertyName("uti2fa_enabled")]
        public string? UtiTwoFactorEnabled { get; set; }
    }
}
