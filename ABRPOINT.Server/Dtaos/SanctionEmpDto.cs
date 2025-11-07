using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Dtaos
{
    public class SanctionEmpDto:Sanction
    {
        public string? Emplib {  get; set; }
        public string? Abslib {  get; set; }
    }
}
