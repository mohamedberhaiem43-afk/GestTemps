using ABRPOINT.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.CalculService
{
    public class AppelDmResult
    {
        private readonly ApplicationDbContext _context;
        public AppelDmResult(ApplicationDbContext context)
        {
            _context = context;
        }
        public async Task VerifRepasAsync(string empCode, DateTime workDate, string pwdSociete)
        {
            // 1. Déterminer la société de l’employé
            string socCode = pwdSociete;
            var employe = await _context.Employes
                .Where(e => e.Empcod == empCode)
                .FirstOrDefaultAsync();

            if (employe != null && !string.IsNullOrEmpty(employe.Soccod))
                socCode = employe.Soccod;

            // 2. Charger la présence du jour
            var presence = await _context.Presences
                .Where(p => p.Empcod == empCode && p.Soccod == socCode && p.Predat == workDate.Date)
                .FirstOrDefaultAsync();

            if (presence == null)
                return; // Pas de présence à traiter

            // 3. Parser les champs en DateTime?
            DateTime? entMat = DateTime.TryParse(presence.Preentmatup, out var dtEntMat) ? dtEntMat : null;
            DateTime? sorMat = DateTime.TryParse(presence.Presortmatup, out var dtSorMat) ? dtSorMat : null;
            DateTime? entMidi = DateTime.TryParse(presence.Preentamidiup, out var dtEntMidi) ? dtEntMidi : null;
            DateTime? sorMidi = DateTime.TryParse(presence.Presortamidiup, out var dtSorMidi) ? dtSorMidi : null;

            // 4. Vérifier les incohérences entrée/sortie
            if (entMat.HasValue && sorMat.HasValue && entMidi.HasValue && sorMidi.HasValue)
            {
                if (entMidi < sorMat)
                {
                    var tmp = entMidi;
                    entMidi = sorMat;
                    sorMat = tmp;
                }

                if (sorMat < entMat && entMat < workDate.Date.AddHours(14)) // < 14:00
                {
                    var tmp = entMat;
                    entMat = sorMat;
                    sorMat = tmp;
                }
            }

            // 5. Réinjecter dans l'entité (format HH:mm)
            presence.Preentmatup = entMat?.ToString("HH:mm");
            presence.Presortmatup = sorMat?.ToString("HH:mm");
            presence.Preentamidiup = entMidi?.ToString("HH:mm");
            presence.Presortamidiup = sorMidi?.ToString("HH:mm");

            // 6. Calcul des totaux (exemple simplifié)
            presence.Tothre = "08:00";
            presence.Tothabs = "00:00";
            presence.Tothnuit = "00:00";
            presence.Tothsup = "00:00";

            // CompareTo fonctionne sur string, mais lexicographique (pas toujours fiable).
            // Ici tu peux parser pour comparer en vrai temps si nécessaire :
            if (TimeSpan.TryParse(presence.Tothre, out var tsTothre))
                presence.Predouche = tsTothre < TimeSpan.FromHours(1) ? 0 : 1;
            else
                presence.Predouche = 0;

            // 7. Sauvegarder
            await _context.SaveChangesAsync();
        }

    }
}
