using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Dtaos
{
    public class PosteResponse
    {
        public IEnumerable<Lposte> Lposte { get; set; }
        public Poste Poste { get; set; }
    }
}
