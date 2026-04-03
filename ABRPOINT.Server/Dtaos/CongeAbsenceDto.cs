using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Dtaos
{
    public class CongeAbsenceDto:Conge
    {
        public string? Emplib {  get; set; }
        public string? Abslib {  get; set; }
    }
}
