using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ABRPOINT.Server.Controllers
{
    /// <summary>
    /// Assistant conversationnel branché sur la base du tenant courant.
    /// Le routage est volontairement règles + LLM (pas full-LLM) pour rester déterministe
    /// sur les questions opérationnelles à fort volume (présence du jour, mes heures du mois,
    /// solde de congé). Le LLM ne reçoit jamais les données brutes du tenant : on lui passe
    /// uniquement un résumé déjà filtré côté serveur.
    /// </summary>
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class AIAssistantController : ControllerBase
    {
        private readonly Kernel _kernel;
        private readonly ApplicationDbContext _db;
        private readonly IPresenceRepository _presenceRepo;
        private readonly ISoldeCongeRepository _soldeRepo;
        private readonly ICurrentTenant _currentTenant;

        public AIAssistantController(
            Kernel kernel,
            ApplicationDbContext db,
            IPresenceRepository presenceRepo,
            ISoldeCongeRepository soldeRepo,
            ICurrentTenant currentTenant)
        {
            _kernel = kernel;
            _db = db;
            _presenceRepo = presenceRepo;
            _soldeRepo = soldeRepo;
            _currentTenant = currentTenant;
        }

        [HttpPost("chat")]
        public async Task<IActionResult> Chat([FromBody] ChatRequest request)
        {
            if (string.IsNullOrWhiteSpace(request?.NewMessage))
                return BadRequest(new { error = "Le message ne peut pas être vide" });

            try
            {
                var ctx = await ResolveUserContextAsync(request);
                var prompt = request.NewMessage.ToLowerInvariant();

                // Routage par intentions. Ordre = priorité : on match les intentions
                // les plus précises (présence du jour, mes heures) avant celles qui
                // pourraient sinon les capturer (mot "présence" tout court).
                if (IsTodayPresenceIntent(prompt))
                    return await HandleTodayPresenceAsync(ctx, prompt);

                if (IsMyHoursIntent(prompt))
                    return await HandleMyHoursAsync(ctx, prompt);

                if (IsMyCongeIntent(prompt))
                    return await HandleMyCongeAsync(ctx);

                if (IsHolidaysIntent(prompt))
                    return await HandleHolidaysAsync(ctx);

                if (IsPresenceDetailIntent(prompt))
                    return await HandlePresenceDetailAsync(request, ctx);

                if (IsPointageMoisIntent(prompt))
                    return await HandlePointageMoisAsync(request, ctx);

                // Fallback : LLM générique avec le contexte de l'utilisateur (rôle, page courante).
                return await HandleGenericLlmAsync(request, ctx);
            }
            catch (Exception ex)
            {
                // On renvoie 200 + message d'erreur dans le payload pour que le chat affiche
                // l'erreur sans déclencher la branche "Erreur API: 500" du front.
                return Ok(new
                {
                    response = $"❌ Une erreur s'est produite : erreur interne"
                });
            }
        }

        // ─── Résolution du contexte utilisateur ──────────────────────────────────────

        private async Task<UserChatContext> ResolveUserContextAsync(ChatRequest request)
        {
            var uticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uticod))
                throw new UnauthorizedAccessException("Utilisateur non authentifié.");

            // 1. Société : on prend celle envoyée par le front (utilisateur peut switcher de société),
            //    fallback sur le 1er Socuser lié à l'utilisateur.
            var soccod = request.Soccod;
            if (string.IsNullOrWhiteSpace(soccod))
            {
                soccod = await _db.Socusers
                    .Where(s => s.Uticod == uticod)
                    .OrderBy(s => s.Soccod)
                    .Select(s => s.Soccod)
                    .FirstOrDefaultAsync();
            }
            soccod ??= "01";

            // 2. Récup employé associé à l'utilisateur (convention projet : Empcod == Uticod
            //    quand l'utilisateur est aussi salarié). isEmp=true côté front quand match.
            var emp = await _db.Employes
                .AsNoTracking()
                .Where(e => e.Empcod == uticod)
                .Select(e => new { e.Empcod, e.Empmat, e.Emplib, e.Sercod, e.Soccod })
                .FirstOrDefaultAsync();

            // 3. Rôle : SEC AI — on NE peut PAS faire confiance à request.UserContext.IsAdmin /
            //    IsManager (client-controlled). Avant ce fix, un employé lambda pouvait poser
            //    IsAdmin=true dans le payload et accéder aux données présence/absence de toute
            //    la société via les handlers HandleTodayPresenceAsync / HandlePointageMois etc.
            //    On re-dérive les flags côté serveur depuis Utilisateur.Utiadm + Utirole.
            var u = request.UserContext;
            var dbUser = await _db.Utilisateurs
                .AsNoTracking()
                .Where(x => x.Uticod == uticod)
                .Select(x => new { x.Utiadm, x.Utirole, x.Utiprn, x.Utinom })
                .FirstOrDefaultAsync();
            var serverIsAdmin = dbUser != null
                && (dbUser.Utiadm == "1" || PermissionCatalog.IsAdminRole(dbUser.Utirole));
            var serverIsManager = string.Equals(dbUser?.Utirole,
                PermissionCatalog.Roles.Manager, StringComparison.OrdinalIgnoreCase)
                || string.Equals(dbUser?.Utirole,
                PermissionCatalog.Roles.ResponsableRH, StringComparison.OrdinalIgnoreCase);

            return new UserChatContext
            {
                Uticod = uticod,
                Soccod = soccod,
                Empcod = emp?.Empcod ?? uticod,
                Empmat = emp?.Empmat,
                Emplib = emp?.Emplib,
                Sercod = emp?.Sercod ?? u?.Sercod,
                IsAdmin = serverIsAdmin,
                IsManager = serverIsManager,
                IsEmp = emp != null,
                RoleName = dbUser?.Utirole ?? u?.RoleName,
                UserName = !string.IsNullOrWhiteSpace(dbUser?.Utiprn) || !string.IsNullOrWhiteSpace(dbUser?.Utinom)
                    ? $"{dbUser?.Utiprn} {dbUser?.Utinom}".Trim()
                    : u?.UserName,
                CurrentPage = request.CurrentPage,
            };
        }

        // ─── Détection d'intentions ──────────────────────────────────────────────────

        private static bool IsTodayPresenceIntent(string p)
            => (p.Contains("aujourd'hui") || p.Contains("aujourdhui") || p.Contains("today"))
               && (p.Contains("présent") || p.Contains("present") || p.Contains("absent")
                   || p.Contains("retard") || p.Contains("en retard"));

        private static bool IsMyHoursIntent(string p)
            => (p.Contains("j'ai travaillé") || p.Contains("j ai travaille") || p.Contains("mes heures")
                || p.Contains("combien d'heures") || p.Contains("combien d heures") || p.Contains("mon pointage"))
               && !p.Contains("employé") && !p.Contains("employe");

        private static bool IsMyCongeIntent(string p)
            => p.Contains("mon solde") || p.Contains("mes congés") || p.Contains("mes conges")
               || (p.Contains("solde") && p.Contains("congé"))
               || (p.Contains("solde") && p.Contains("conge"));

        private static bool IsHolidaysIntent(string p)
            => p.Contains("férié") || p.Contains("ferie") || p.Contains("jours fériés") || p.Contains("jours feries");

        private static bool IsPresenceDetailIntent(string p)
            => (p.Contains("présence") || p.Contains("presence") || p.Contains("état") || p.Contains("etat")
                || p.Contains("détail") || p.Contains("detail") || p.Contains("journée") || p.Contains("journee"));

        private static bool IsPointageMoisIntent(string p)
            => p.Contains("pointage") || p.Contains("heures sup") || p.Contains("heures supp")
               || (p.Contains("employe") || p.Contains("employé")) && (p.Contains("mois") || p.Contains("semaine"));

        // ─── Handlers d'intentions ───────────────────────────────────────────────────

        private async Task<IActionResult> HandleTodayPresenceAsync(UserChatContext ctx, string prompt)
        {
            // Restreint aux admins/managers : un employé "lambda" n'a pas à voir qui est en
            // retard ou absent.
            if (!ctx.IsAdmin && !ctx.IsManager)
                return Ok(new { response = "🔒 Cette information est réservée aux managers et administrateurs." });

            var today = DateTime.Today;
            var tomorrow = today.AddDays(1);

            // On part de la liste des employés actifs aujourd'hui (entre embauche et sortie).
            // Filtrage service pour les managers (un manager non-admin ne voit que son service).
            var empQuery = _db.Employes.AsNoTracking()
                .Where(e => e.Soccod == ctx.Soccod
                         && (e.Empemb == null || e.Empemb <= today)
                         && (e.Empsort == null || e.Empsort > today));
            if (!ctx.IsAdmin && ctx.IsManager && !string.IsNullOrEmpty(ctx.Sercod))
                empQuery = empQuery.Where(e => e.Sercod == ctx.Sercod);

            var employes = await empQuery
                .Select(e => new { e.Empcod, e.Empmat, e.Emplib, e.Sercod })
                .ToListAsync();
            var empcods = employes.Select(e => e.Empcod).ToList();

            // Présences du jour pour ce sous-ensemble d'employés.
            var presences = await _db.Presences.AsNoTracking()
                .Where(p => p.Soccod == ctx.Soccod
                         && p.Predat.HasValue
                         && p.Predat.Value >= today
                         && p.Predat.Value < tomorrow
                         && empcods.Contains(p.Empcod!))
                .Select(p => new { p.Empcod, p.Preentmatup, p.Presortmatup, p.Prerepos })
                .ToListAsync();

            var byEmp = presences.ToDictionary(p => p.Empcod!, p => p);

            // Catégorisation simple : présent (Preentmatup non null), repos (Prerepos="1"),
            // sinon absent. Les "retards" précis (Totret) demandent le calcul périodique
            // complet — on l'évite ici pour rester rapide. On considère "en retard" les
            // employés présents arrivés après 09:00 (heuristique courante côté FR).
            var presentsList = new List<(string label, string info)>();
            var retardsList = new List<(string label, string info)>();
            var absentsList = new List<(string label, string info)>();
            int reposCount = 0;

            foreach (var e in employes)
            {
                byEmp.TryGetValue(e.Empcod!, out var p);
                var label = e.Empmat ?? e.Empcod ?? "";
                var name = e.Emplib;
                var lbl = string.IsNullOrEmpty(name) ? $"#{label}" : $"#{label} {name}";

                if (p == null)
                {
                    absentsList.Add((lbl, "non pointé"));
                    continue;
                }
                if (p.Prerepos == "1")
                {
                    reposCount++;
                    continue;
                }
                if (string.IsNullOrEmpty(p.Preentmatup))
                {
                    absentsList.Add((lbl, "non pointé"));
                    continue;
                }

                presentsList.Add((lbl, $"entré à {p.Preentmatup}"));
                if (TryParseHmm(p.Preentmatup, out var hh, out var mm) && (hh > 9 || (hh == 9 && mm > 0)))
                    retardsList.Add((lbl, $"entré à {p.Preentmatup}"));
            }

            string focus;
            List<(string label, string info)> focusList;
            if (prompt.Contains("retard")) { focus = "retards"; focusList = retardsList; }
            else if (prompt.Contains("absent")) { focus = "absents"; focusList = absentsList; }
            else { focus = "présents"; focusList = presentsList; }

            var lines = new List<string>
            {
                $"📊 **Situation du {today:dd/MM/yyyy}** (société {ctx.Soccod})",
                "",
                $"👥 Effectif actif : **{employes.Count}**",
                $"✅ Présents : **{presentsList.Count}**",
                $"⏰ Possible retard (>09:00) : **{retardsList.Count}**",
                $"❌ Absents (hors repos) : **{absentsList.Count}**",
                $"🏖️ En repos : **{reposCount}**",
                "",
                $"**Détail des {focus} ({focusList.Count}) :**"
            };

            if (focusList.Count == 0)
                lines.Add("_Aucun_");
            else
            {
                foreach (var x in focusList.Take(20))
                    lines.Add($"• {x.label} — {x.info}");
                if (focusList.Count > 20)
                    lines.Add($"_…et {focusList.Count - 20} autres_");
            }

            return Ok(new
            {
                response = string.Join("\n", lines),
                metadata = new { focus, total = employes.Count }
            });
        }

        // Parse "HH:mm" ou "HHmm" ; retourne false si format inattendu.
        private static bool TryParseHmm(string s, out int hh, out int mm)
        {
            hh = mm = 0;
            if (string.IsNullOrWhiteSpace(s)) return false;
            var clean = s.Trim();
            if (clean.Contains(':'))
            {
                var parts = clean.Split(':');
                return parts.Length >= 2
                    && int.TryParse(parts[0], out hh)
                    && int.TryParse(parts[1], out mm);
            }
            if (clean.Length == 4 && int.TryParse(clean.AsSpan(0, 2), out hh) && int.TryParse(clean.AsSpan(2, 2), out mm))
                return true;
            return false;
        }

        private async Task<IActionResult> HandleMyHoursAsync(UserChatContext ctx, string prompt)
        {
            if (!ctx.IsEmp || string.IsNullOrEmpty(ctx.Empcod))
                return Ok(new { response = "ℹ️ Cette information n'est disponible que pour les utilisateurs liés à un employé." });

            var (mois, annee) = ExtractMonthYear(prompt);
            var args = new KernelArguments
            {
                ["soccod"] = ctx.Soccod,
                ["empcods"] = new List<string> { ctx.Empcod },
                ["mois"] = mois,
                ["annee"] = annee,
                ["semaine"] = "0",
            };

            var result = await _kernel.InvokeAsync(
                pluginName: "Pointage",
                functionName: "GetPointageMois",
                arguments: args);

            var data = result.GetValue<List<PointageMois>>();
            var record = data?.FirstOrDefault();
            var stats = record?.heuresSupplementairesResultats?.FirstOrDefault();

            if (record == null || stats == null)
                return Ok(new { response = $"ℹ️ Aucun pointage trouvé pour vous en {mois}/{annee}." });

            var monthName = new DateTime(int.Parse(annee), int.Parse(mois), 1)
                .ToString("MMMM yyyy", new CultureInfo("fr-FR"));

            var response = $@"📊 **Mes heures — {monthName}**

👤 {ctx.UserName ?? record.EmpLib} ({record.EmpMat})

✅ Heures normales : **{stats.HeuresNormales}h**
⏱️ Heures supplémentaires : **{stats.HreSupSemaine}h**
⏰ Retards cumulés : **{stats.Retard} min**
📈 Total heures : **{stats.Tothre}h**
📅 Jours pointés : {stats.NbJourPointer} | 🏖️ Jours de repos : {stats.JourRepos}";

            return Ok(new { response });
        }

        private async Task<IActionResult> HandleMyCongeAsync(UserChatContext ctx)
        {
            if (!ctx.IsEmp || string.IsNullOrEmpty(ctx.Empcod))
                return Ok(new { response = "ℹ️ Le solde de congé est lié à un employé. Votre compte n'est pas rattaché à une fiche employé." });

            var solde = await _soldeRepo.GetByEmpCalculatedAsync(ctx.Soccod, ctx.Empcod)
                        ?? await _soldeRepo.GetByEmpcodAsync(ctx.Soccod, ctx.Empcod);

            if (solde == null)
                return Ok(new { response = "ℹ️ Aucun solde de congé n'a été trouvé pour vous." });

            var pris = solde.Empconge ?? 0;
            var droit = solde.Conge ?? 0;
            var restant = droit - pris;
            var cet = solde.Cetjours ?? 0;

            var response = $@"🏖️ **Mon solde de congé**

📅 Année : {solde.Annee ?? DateTime.Today.Year.ToString()}
✅ Droits acquis : **{droit:F2} jours**
🟠 Pris : **{pris:F2} jours**
🟢 Restant : **{restant:F2} jours**
💼 Compte Épargne Temps : {cet:F2} jours

Pour poser un congé, [aller à la page demande de congé](#) ou consultez [NAVIGATE:demande-conge].";

            return Ok(new { response });
        }

        private async Task<IActionResult> HandleHolidaysAsync(UserChatContext ctx)
        {
            var today = DateTime.Today;
            var endOfYear = new DateTime(today.Year, 12, 31);

            var feriers = await _db.Feriers
                .AsNoTracking()
                .Where(f => f.Soccod == ctx.Soccod
                            && f.Ferdate.HasValue
                            && f.Ferdate.Value >= today
                            && f.Ferdate.Value <= endOfYear)
                .OrderBy(f => f.Ferdate)
                .Take(15)
                .ToListAsync();

            if (feriers.Count == 0)
                return Ok(new { response = $"ℹ️ Aucun jour férié à venir d'ici la fin de l'année {today.Year}." });

            var lines = new List<string>
            {
                $"📅 **Prochains jours fériés ({today.Year})**",
                ""
            };
            var frCulture = new CultureInfo("fr-FR");
            foreach (var f in feriers)
            {
                // Fernpaye = '1' ou 'O' → jour férié NON payé. Sinon par défaut payé.
                var nonPaye = f.Fernpaye == "1" || f.Fernpaye == "O";
                var paye = nonPaye ? "🟡 non payé" : "💰 payé";
                var libelle = string.IsNullOrWhiteSpace(f.Fermotif) ? "Jour férié" : f.Fermotif;
                lines.Add($"• {f.Ferdate!.Value.ToString("dddd dd MMMM yyyy", frCulture)} — {libelle} ({paye})");
            }

            return Ok(new { response = string.Join("\n", lines) });
        }

        private async Task<IActionResult> HandlePresenceDetailAsync(ChatRequest request, UserChatContext ctx)
        {
            // Réservé aux admins/managers — un employé voit son propre détail via "mes heures".
            if (!ctx.IsAdmin && !ctx.IsManager)
                return Ok(new { response = "🔒 Cette consultation est réservée aux managers et administrateurs." });

            var p = ExtractPresenceParameters(request.NewMessage, ctx.Soccod);
            var debut = DateTime.Parse(p.DateDebut);
            var fin = DateTime.Parse(p.DateFin);

            var allResults = new List<PresenceDto>();
            foreach (var empcod in p.Empcods.Count == 0 ? new List<string> { "ALL" } : p.Empcods)
            {
                var res = await _presenceRepo.GetEmpEtatPeriodiqueAsync(ctx.Soccod, empcod, debut, fin);
                allResults.AddRange(res);
            }

            // Filtrage manager.
            if (!ctx.IsAdmin && ctx.IsManager && !string.IsNullOrEmpty(ctx.Sercod))
                allResults = allResults.Where(r => r.Sercod == ctx.Sercod).ToList();

            if (allResults.Count == 0)
                return Ok(new { response = $"❌ Aucune présence enregistrée pour la période {p.DateDebut} → {p.DateFin}." });

            var firstGroup = allResults.GroupBy(x => x.Empcod).First().ToList();
            var totalRetardMinutes = firstGroup.Sum(x =>
            {
                if (string.IsNullOrEmpty(x.Totret)) return 0;
                var parts = x.Totret.Split(':');
                if (parts.Length == 2 && int.TryParse(parts[0], out var h) && int.TryParse(parts[1], out var m))
                    return h * 60 + m;
                return 0;
            });

            var response = $@"📊 **État périodique** {(ctx.IsAdmin ? "(toute la société)" : "(votre service)")}
📅 Période : {p.DateDebut} → {p.DateFin}

✅ Jours pointés : {firstGroup.Count(x => !string.IsNullOrEmpty(x.Preentmatup))}
🏖️ Jours de repos : {firstGroup.Count(x => x.Prerepos == "1")}
❌ Jours d'absence : {firstGroup.Count(x => !string.IsNullOrEmpty(x.Etat) && x.Etat != "J.Repos" && x.Prerepos != "1")}
⏱️ Total heures : {firstGroup.Sum(x => x.TotalHeure ?? 0):F2}h
⏰ Total retards : {totalRetardMinutes / 60}h {totalRetardMinutes % 60}min

📋 **Aperçu (10 premiers jours) :**
{string.Join("\n", firstGroup.OrderBy(x => x.Predat).Take(10).Select(x => $"• {x.Predat:dd/MM} — {x.Preentmatup} → {x.Presortmatup} | {x.Tothre} | {(x.Prerepos == "1" ? "Repos" : x.Etat ?? "Présent")}"))}";

            return Ok(new
            {
                response,
                metadata = new { recordsFound = allResults.Count, period = $"{p.DateDebut} - {p.DateFin}" }
            });
        }

        private async Task<IActionResult> HandlePointageMoisAsync(ChatRequest request, UserChatContext ctx)
        {
            if (!ctx.IsAdmin && !ctx.IsManager)
                return Ok(new { response = "🔒 Cette consultation est réservée aux managers et administrateurs." });

            var p = ExtractParametersManually(request.NewMessage, ctx.Soccod);

            var args = new KernelArguments
            {
                ["soccod"] = ctx.Soccod,
                ["empcods"] = p.Empcods,
                ["mois"] = p.Mois,
                ["annee"] = p.Annee,
                ["semaine"] = p.Semaine ?? "0",
            };

            var result = await _kernel.InvokeAsync(
                pluginName: "Pointage",
                functionName: "GetPointageMois",
                arguments: args);

            var data = result.GetValue<List<PointageMois>>();
            if (data == null || data.Count == 0)
                return Ok(new { response = $"❌ Aucun pointage trouvé pour {string.Join(", ", p.Empcods)} en {p.Mois}/{p.Annee}." });

            var first = data.First();
            var s = first.heuresSupplementairesResultats?.FirstOrDefault();
            var response = $@"📊 **Pointage {first.EmpLib} ({first.EmpMat})**
Période : {p.Mois}/{p.Annee}

✅ Heures normales : {s?.HeuresNormales ?? 0}h
⏱️ Heures supplémentaires : {s?.HreSupSemaine ?? 0}h
⏰ Retards : {s?.Retard ?? 0} min
📈 Total heures : {s?.Tothre ?? 0}h
📅 Jours pointés : {s?.NbJourPointer ?? 0} | 🏖️ Repos : {s?.JourRepos ?? 0}";

            return Ok(new { response, metadata = new { recordsFound = data.Count, period = $"{p.Mois}/{p.Annee}" } });
        }

        private async Task<IActionResult> HandleGenericLlmAsync(ChatRequest request, UserChatContext ctx)
        {
            // Prompt système contextualisé : l'utilisateur (rôle, page courante) est passé au LLM
            // pour qu'il sache à qui il parle et adapte le ton/les suggestions.
            var roleLabel = ctx.IsAdmin ? "administrateur" : ctx.IsManager ? "manager" : "employé";
            var historyTxt = string.Join("\n", request.Messages.TakeLast(6)
                .Select(m => $"[{m.Role}] {m.Content}"));

            var systemContext = $@"Contexte utilisateur :
- Nom : {ctx.UserName ?? "(inconnu)"}
- Rôle : {roleLabel}
- Société : {ctx.Soccod}
- Page courante : {ctx.CurrentPage ?? "(non précisée)"}
- Date du jour : {DateTime.Today:dd MMMM yyyy} ({DateTime.Today:dddd})

Application : Concorde Workforce — plateforme de gestion de présence, pointage, congés et paie.
Quand tu mentionnes le produit dans tes réponses, utilise toujours « Concorde Workforce » (jamais « ABRPOINT » ou « GestTemps »).
Modules clés (pour la navigation) :
- /dashboard : tableau de bord
- /dashboard/etat-de-presence : présence en temps réel
- /dashboard/etat-periodique : saisie/consultation pointage périodique
- /dashboard/Repos : gestion des jours de repos
- /dashboard/liste-pointeuse : pointeuses physiques
- /dashboard/PreparationPaie/PointageDuMois : pointage du mois (paie)
- /dashboard/Conge : demandes et soldes de congé
- /dashboard/parametres-societe/calendrier : configuration calendrier
- /dashboard/Sanctions : sanctions et notes de frais
Pour proposer une navigation, écris [NAVIGATE:<mot-clé>] où mot-clé est un des sujets ci-dessus.

Historique récent :
{historyTxt}

Question de l'utilisateur :
{request.NewMessage}

Réponds en français de manière concise (max 8 lignes), professionnelle, avec quelques emojis. Si la question demande des données chiffrées que tu ne peux pas calculer, propose plutôt à l'utilisateur d'aller sur la page concernée via [NAVIGATE:...].";

            var args = new KernelArguments { ["prompt"] = systemContext };
            var resp = await _kernel.InvokeAsync(
                pluginName: "Gemini",
                functionName: "GenerateResponse",
                arguments: args);

            var text = resp.GetValue<string>();
            if (string.IsNullOrWhiteSpace(text) || text == "Pas de réponse")
                text = "Désolé, je n'ai pas pu générer de réponse. Pouvez-vous reformuler votre question ?";

            return Ok(new { response = text });
        }

        // ─── Extraction de paramètres (regex) ────────────────────────────────────────

        private static readonly Dictionary<string, int> _moisFr = new(StringComparer.OrdinalIgnoreCase)
        {
            { "janvier", 1 }, { "février", 2 }, { "fevrier", 2 }, { "mars", 3 }, { "avril", 4 },
            { "mai", 5 }, { "juin", 6 }, { "juillet", 7 }, { "août", 8 }, { "aout", 8 },
            { "septembre", 9 }, { "octobre", 10 }, { "novembre", 11 }, { "décembre", 12 }, { "decembre", 12 }
        };

        private static (string mois, string annee) ExtractMonthYear(string message)
        {
            var year = DateTime.Now.Year.ToString();
            var month = DateTime.Now.Month.ToString("D2");

            var nm = Regex.Match(message,
                @"\b(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\b(?:\s+(\d{4}))?",
                RegexOptions.IgnoreCase);
            if (nm.Success)
            {
                if (_moisFr.TryGetValue(nm.Groups[1].Value, out var mi))
                    month = mi.ToString("D2");
                if (nm.Groups[2].Success) year = nm.Groups[2].Value;
            }
            else
            {
                var ym = Regex.Match(message, @"\b(\d{1,2})\s*[/-]\s*(\d{4})\b");
                if (ym.Success)
                {
                    month = ym.Groups[1].Value.PadLeft(2, '0');
                    year = ym.Groups[2].Value;
                }
            }

            // mots-clés relatifs
            if (Regex.IsMatch(message, @"\bce mois\b|\bmois en cours\b|\bcourant\b", RegexOptions.IgnoreCase))
            {
                month = DateTime.Now.Month.ToString("D2");
                year = DateTime.Now.Year.ToString();
            }
            else if (Regex.IsMatch(message, @"\bmois dernier\b|\bmois précédent\b|\bmois precedent\b", RegexOptions.IgnoreCase))
            {
                var d = DateTime.Now.AddMonths(-1);
                month = d.Month.ToString("D2");
                year = d.Year.ToString();
            }

            return (month, year);
        }

        private static PresenceParameters ExtractPresenceParameters(string message, string soccod)
        {
            var parameters = new PresenceParameters
            {
                Soccod = soccod,
                Empcods = new List<string>(),
                DateDebut = DateTime.Now.ToString("yyyy-MM-dd"),
                DateFin = DateTime.Now.ToString("yyyy-MM-dd")
            };

            var dateUniqueMatch = Regex.Match(message,
                @"(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})",
                RegexOptions.IgnoreCase);
            if (dateUniqueMatch.Success && _moisFr.TryGetValue(dateUniqueMatch.Groups[2].Value, out var mois))
            {
                int jour = int.Parse(dateUniqueMatch.Groups[1].Value);
                int annee = int.Parse(dateUniqueMatch.Groups[3].Value);
                var date = new DateTime(annee, mois, jour);
                parameters.DateDebut = date.ToString("yyyy-MM-dd");
                parameters.DateFin = date.ToString("yyyy-MM-dd");
            }

            var employeMatch = Regex.Match(message,
                @"(?:employe[é]?\s*[:\s]*)?(\d{5,6})", RegexOptions.IgnoreCase);
            if (employeMatch.Success)
                parameters.Empcods.Add(employeMatch.Groups[1].Value);

            var dateRangeMatch = Regex.Match(message,
                @"(?:du|depuis)\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s*(?:au|jusqu'au|à)\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})",
                RegexOptions.IgnoreCase);
            if (dateRangeMatch.Success)
            {
                try
                {
                    var debut = new DateTime(
                        int.Parse(dateRangeMatch.Groups[3].Value),
                        int.Parse(dateRangeMatch.Groups[2].Value),
                        int.Parse(dateRangeMatch.Groups[1].Value));
                    var fin = new DateTime(
                        int.Parse(dateRangeMatch.Groups[6].Value),
                        int.Parse(dateRangeMatch.Groups[5].Value),
                        int.Parse(dateRangeMatch.Groups[4].Value));
                    parameters.DateDebut = debut.ToString("yyyy-MM-dd");
                    parameters.DateFin = fin.ToString("yyyy-MM-dd");
                }
                catch { /* ignore parse errors, keep defaults */ }
            }
            else
            {
                var moisMatch = Regex.Match(message, @"(?:mois|en)\s*(\d{1,2})\s*/?\s*(\d{4})?", RegexOptions.IgnoreCase);
                if (moisMatch.Success)
                {
                    int m = int.Parse(moisMatch.Groups[1].Value);
                    int a = moisMatch.Groups[2].Success ? int.Parse(moisMatch.Groups[2].Value) : DateTime.Now.Year;
                    parameters.DateDebut = new DateTime(a, m, 1).ToString("yyyy-MM-dd");
                    parameters.DateFin = new DateTime(a, m, DateTime.DaysInMonth(a, m)).ToString("yyyy-MM-dd");
                }
            }

            if (parameters.Empcods.Count == 0)
                parameters.Empcods.Add("ALL");

            return parameters;
        }

        private static PointageParameters ExtractParametersManually(string message, string soccod)
        {
            var (mois, annee) = ExtractMonthYear(message);
            var parameters = new PointageParameters
            {
                Soccod = soccod,
                Empcods = new List<string>(),
                Mois = mois,
                Annee = annee,
                Semaine = "0"
            };

            var employeMatch = Regex.Match(message,
                @"(?:employe[é]?\s*[:\s]*)?(\d{5,6})", RegexOptions.IgnoreCase);
            if (employeMatch.Success)
                parameters.Empcods.Add(employeMatch.Groups[1].Value);

            if (parameters.Empcods.Count == 0)
                parameters.Empcods.Add("ALL");

            return parameters;
        }
    }

    // ─── DTOs ────────────────────────────────────────────────────────────────────────

    public class PresenceParameters
    {
        public string Soccod { get; set; } = "01";
        public List<string> Empcods { get; set; } = new();
        public string DateDebut { get; set; } = "";
        public string DateFin { get; set; } = "";
    }

    public class PointageParameters
    {
        public string Soccod { get; set; } = "01";
        public List<string> Empcods { get; set; } = new();
        public string Mois { get; set; } = "";
        public string Annee { get; set; } = "";
        public string? Semaine { get; set; } = "0";
    }

    public class ChatRequest
    {
        public List<ChatMessage> Messages { get; set; } = new();
        public string NewMessage { get; set; } = string.Empty;
        public string Query { get; set; } = string.Empty;
        public string? CurrentPage { get; set; }
        public string? Soccod { get; set; }
        public ChatUserContext? UserContext { get; set; }
    }

    public class ChatMessage
    {
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }

    /// <summary>
    /// Contexte utilisateur envoyé par le front. On le complète/valide côté serveur
    /// (le claim NameIdentifier est la source de vérité pour Uticod, jamais le payload).
    /// </summary>
    public class ChatUserContext
    {
        public string? Uticod { get; set; }
        public string? UserName { get; set; }
        public string? RoleName { get; set; }
        public bool IsAdmin { get; set; }
        public bool IsManager { get; set; }
        public bool IsEmp { get; set; }
        public string? Sercod { get; set; }
    }

    /// <summary>
    /// Vue côté serveur du contexte du chat : combine le claim JWT (uticod, source de vérité)
    /// et les flags rôle envoyés par le front.
    /// </summary>
    internal class UserChatContext
    {
        public string Uticod { get; set; } = "";
        public string Soccod { get; set; } = "";
        public string Empcod { get; set; } = "";
        public string? Empmat { get; set; }
        public string? Emplib { get; set; }
        public string? Sercod { get; set; }
        public bool IsAdmin { get; set; }
        public bool IsManager { get; set; }
        public bool IsEmp { get; set; }
        public string? RoleName { get; set; }
        public string? UserName { get; set; }
        public string? CurrentPage { get; set; }
    }

    // Ces 3 DTO sont consommés par IPresenceRepository (GetStatisticsAsync, GetRecentAbsencesAsync,
    // GetGlobalStatisticsAsync). Historiquement déclarés dans le namespace Controllers — on garde
    // cette localisation pour ne pas casser les imports (`using ABRPOINT.Server.Controllers`)
    // dans IPresenceRepository et PresenceRepository.
    public class PresenceStatistics
    {
        public int TotalEmployees { get; set; }
        public int PresentToday { get; set; }
        public int AbsentToday { get; set; }
        public int TotalRetards { get; set; }
        public decimal AttendanceRate { get; set; }
    }

    public class AbsenceInfo
    {
        public string EmployeeName { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public string Motif { get; set; } = string.Empty;
    }

    public class GlobalStatistics
    {
        public int TotalEmployees { get; set; }
        public decimal AverageMonthlyAttendance { get; set; }
        public decimal TotalHoursThisMonth { get; set; }
    }
}
