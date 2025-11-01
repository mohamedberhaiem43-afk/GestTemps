using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Dtaos
{
    public class AutoriserEmployeDto:Autoriser
    {
        public string? Abslib { get; set; }
        public string? Emplib { get; set; }
        public string? Sitcod { get; set; }


    }
}
