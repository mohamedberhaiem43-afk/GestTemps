using ABRPOINT.Server.Annotations.AdminAttributes;
using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Billing;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using OtpNet;
using QRCoder;
using System.Threading.Tasks;

// For more information on enabling Web API for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace GestionDesTickets.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UtilisateursController : ControllerBase
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IUtilisateurRepository _utilisateurRepository;
        private readonly IConfiguration _configuration;
        private readonly ICurrentTenant _currentTenant;
        private readonly EncryptionService _encryptionService;
        private readonly IPasswordBreachChecker _passwordBreach;
        private readonly IKnownDeviceService _knownDevices;
        private readonly TwoFactorSecretProtector _totpProtector;
        private readonly IStorageQuotaGuard _quotaGuard;
        // Optional pour rester aligné sur la convention SignupController : si la conf SMTP
        // n'est pas posée (dev local), l'injection passe en null et le resend log le code en INFO.
        private readonly IEmailService? _emailService;
        private readonly ILogger<UtilisateursController>? _logger;
        public UtilisateursController(
            IConfiguration configuration,
            ApplicationDbContext dbContext,
            IUtilisateurRepository utilisateurRepository,
            ICurrentTenant currentTenant,
            EncryptionService encryptionService,
            IPasswordBreachChecker passwordBreach,
            IKnownDeviceService knownDevices,
            TwoFactorSecretProtector totpProtector,
            IStorageQuotaGuard quotaGuard,
            IEmailService? emailService = null,
            ILogger<UtilisateursController>? logger = null)
        {
            _configuration = configuration;
            _dbContext = dbContext;
            _utilisateurRepository = utilisateurRepository;
            _currentTenant = currentTenant;
            _encryptionService = encryptionService;
            _passwordBreach = passwordBreach;
            _knownDevices = knownDevices;
            _totpProtector = totpProtector;
            _quotaGuard = quotaGuard;
            _emailService = emailService;
            _logger = logger;
        }
        private bool IsHttpsRequest()
        {
            if (Request.IsHttps)
            {
                return true;
            }

            if (Request.Headers.TryGetValue("X-Forwarded-Proto", out var forwardedProto))
            {
                var protocol = forwardedProto.ToString().Split(',')[0].Trim();
                return string.Equals(protocol, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase);
            }

            return false;
        }

        private CookieOptions CreateCookieOptions(DateTimeOffset expires, bool httpOnly = true)
        {
            var isHttps = IsHttpsRequest();

            return new CookieOptions
            {
                HttpOnly = httpOnly,
                Secure = isHttps,
                SameSite = isHttps ? SameSiteMode.None : SameSiteMode.Lax,
                Expires = expires,
                Path = "/"
            };
        }

        private CookieOptions CreateDeleteCookieOptions(bool httpOnly = true)
        {
            var isHttps = IsHttpsRequest();

            return new CookieOptions
            {
                HttpOnly = httpOnly,
                Secure = isHttps,
                SameSite = isHttps ? SameSiteMode.None : SameSiteMode.Lax,
                Path = "/"
            };
        }


        [Authorize]
        [HttpGet]
        [Admin]
        // PERF — Pagination opt-in pour éviter de charger l'ensemble de la table
        // Utilisateurs (peut atteindre quelques milliers de lignes sur un gros tenant).
        //
        // Contrats supportés :
        //   • Aucun param fourni → array `[]` direct (rétrocompat avec les callers
        //     historiques qui font `getAllWithoutParams()`), avec un cap dur de 1000.
        //   • Au moins `page`, `pageSize` ou `q` fourni → objet `{items, total, page, pageSize}`
        //     pour pagination explicite et recherche serveur.
        //
        // Tout pageSize > 200 est ramené à 200 (anti-DoS soft).
        public async Task<IActionResult> GetAllUtilisateurs([FromQuery] int? page = null, [FromQuery] int? pageSize = null, [FromQuery] string? q = null)
        {
            try
            {
                var paginationRequested = page.HasValue || pageSize.HasValue || !string.IsNullOrWhiteSpace(q);

                var query = _dbContext.Utilisateurs.AsNoTracking();
                if (!string.IsNullOrWhiteSpace(q))
                {
                    // PG : on lowercase des deux côtés. Sur SQL Server la collation
                    // French_CI_AS rendait Contains case-insensitive ; sur Postgres
                    // VARCHAR.Contains() devient LIKE '%term%' case-sensitive — la
                    // recherche "smith" ne trouvait plus "Smith" / "SMITH".
                    var term = q.Trim().ToLowerInvariant();
                    query = query.Where(u =>
                        (u.Uticod  != null && u.Uticod.ToLower().Contains(term)) ||
                        (u.Utimail != null && u.Utimail.ToLower().Contains(term)) ||
                        (u.Utinom  != null && u.Utinom.ToLower().Contains(term)) ||
                        (u.Utiprn  != null && u.Utiprn.ToLower().Contains(term)));
                }

                if (paginationRequested)
                {
                    var p = page is null or < 1 ? 1 : page.Value;
                    var ps = pageSize is null or < 1 ? 50 : pageSize.Value;
                    if (ps > 200) ps = 200;

                    var total = await query.CountAsync();
                    var items = await query
                        .OrderBy(u => u.Uticod)
                        .Skip((p - 1) * ps)
                        .Take(ps)
                        .Select(u => new {
                            u.Uticod, u.Utinom, u.Utiprn, u.Utimail, u.Utiactif,
                            u.Utiadm, u.Utirole, uti2fa_enabled = u.UtiTwoFactorEnabled, u.Utiimg
                        })
                        .ToListAsync();
                    return Ok(new { items, total, page = p, pageSize = ps });
                }
                else
                {
                    // Mode rétrocompat : array direct + cap dur à 1000 pour bloquer le DoS.
                    var users = await query
                        .OrderBy(u => u.Uticod)
                        .Take(1000)
                        .Select(u => new {
                            u.Uticod, u.Utinom, u.Utiprn, u.Utimail, u.Utiactif,
                            u.Utiadm, u.Utirole, uti2fa_enabled = u.UtiTwoFactorEnabled, u.Utiimg
                        })
                        .ToListAsync();
                    return Ok(users);
                }
            }
            catch (Exception)
            {
                // SEC — Ne pas exposer ex.Message (cf. GlobalExceptionHandler) ; le détail
                // est logué côté serveur via le middleware.
                return StatusCode(500, new { Message = "Error fetching users" });
            }
        }

        [Authorize]
        [HttpGet("users-list/{soccod}/{uticod}")]
        [Admin]
        public async Task<IActionResult> GetUtilisateurs(string soccod,string uticod)
        {
            try
            {
                return Ok(await _utilisateurRepository.GetAllUsersAsync(soccod,uticod));
            }
            catch (Exception ex)
            {
                return StatusCode(500, "problÃ©me de rÃ©cupÃ©ration des utilisateurs " + ex);
            }
        }
        [Authorize]
        [HttpGet("get-user/{uticod}")]
        [Admin]
        public async Task<IActionResult> GetUtilisateur(string uticod)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(uticod))
                {
                    return BadRequest(new { Message = "User code is required" });
                }
                    var utilisateur = await _utilisateurRepository.GetUtilisateurAsync(uticod);
                    return Ok(utilisateur);
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { Message = "User not found" });
            }
            catch (Exception ex)
            {
                // Return a clean message to client
                return StatusCode(500, new { Message = "An error occurred" });
            }
        }

        // SEC AI : sans [Admin], n'importe quel utilisateur authentifié pouvait créer des
        // comptes (y compris admin) dans n'importe quelle société/site. Désormais admin only,
        // et soccod scopé aux sociétés du tenant.
        [Authorize]
        [Admin]
        [ValidateSoccod]
        [HttpPost("add-user/{soccod}/{sitcod}")]
        // SEC — Binding via DTO whitelist (CreateUtilisateurDto) au lieu de l'entité
        // Utilisateur directement. Empêche un caller (même admin tenant) de poser
        // UtiTwoFactorSecret/UtiTwoFactorEnabled/UtiResetCode/UtiFailedLogins/UtiLockoutUntil
        // (potentielle escalade ou neutralisation 2FA d'autres comptes par ricochet).
        public async Task<IActionResult> AddUtilisateur([FromBody] CreateUtilisateurDto dto, string sitcod, string soccod)
        {
            if (dto is null || string.IsNullOrWhiteSpace(dto.Uticod) || string.IsNullOrWhiteSpace(dto.Utimps))
                return BadRequest(new { message = "Uticod et mot de passe requis." });

            // Plan gating « Administrateurs inclus » — hard cap à `IncludedAdmins`
            //   Starter   → 1 administrateur
            //   Standard  → 3 administrateurs
            //   Business  → illimité (IncludedAdmins == null)
            // On compte comme « admin » tout compte avec Utiadm=="1" OU role Administrator.
            // Cohérent avec /me line 796 et la matrice marketing (PricingPage, HomePage).
            // L'essai gratuit débloque la matrice complète comme pour les autres features.
            var isNewAdmin = dto.Utiadm == "1" || ABRPOINT.Server.Authorization.PermissionCatalog.IsAdminRole(dto.Utirole);
            if (isNewAdmin && !TrialPolicy.IsTrialing(_currentTenant.Current))
            {
                var plan = PlanCatalog.GetPlan(_currentTenant.Current?.PlanCode);
                if (plan?.IncludedAdmins is int adminQuota)
                {
                    var currentAdmins = await _dbContext.Utilisateurs.AsNoTracking()
                        .CountAsync(u => u.Utiadm == "1"
                                      || ABRPOINT.Server.Authorization.PermissionCatalog.IsAdminRole(u.Utirole));
                    if (currentAdmins >= adminQuota)
                    {
                        return StatusCode(402, new
                        {
                            code = "plan_max_admins_reached",
                            message = $"Limite de votre plan {plan.Code} atteinte ({adminQuota} administrateur{(adminQuota > 1 ? "s" : "")} maximum). Passez au pack supérieur pour ajouter d'autres administrateurs.",
                            currentCount = currentAdmins,
                            includedMax = adminQuota,
                            planCode = plan.Code,
                            planName = plan.DisplayName,
                        });
                    }
                }
            }

            try
            {
                // Mapping explicite — tout champ absent du DTO reste null/default sur l'entité.
                var utilisateur = new Utilisateur
                {
                    Uticod = dto.Uticod,
                    Utinom = dto.Utinom,
                    Utiprn = dto.Utiprn,
                    Utimps = dto.Utimps,
                    Utiactif = dto.Utiactif,
                    Utiadm = dto.Utiadm,
                    Utimail = dto.Utimail,
                    Utiimg = dto.Utiimg,
                    Utirole = dto.Utirole,
                    // Champs sensibles non bindables : restent null par défaut.
                    UtiTwoFactorEnabled = null,
                    UtiTwoFactorSecret = null,
                    UtiResetCode = null,
                    UtiResetCodeExpiry = null,
                    UtiFailedLogins = 0,
                    UtiLockoutUntil = null,
                };

                var socuser = new Socuser
                {
                    Uticod = utilisateur.Uticod,
                    Soccod = soccod,
                    Sitcod = sitcod,
                };
                await _utilisateurRepository.AddAsync(utilisateur, socuser);
                return Ok(new { uticod = utilisateur.Uticod });
            }
            catch (Exception)
            {
                // SEC — Ne pas exposer ex.Message (le détail va dans le GlobalExceptionHandler).
                return StatusCode(500, new { message = "Erreur lors de l'ajout de l'utilisateur." });
            }
        }
        // POST api/<UtilisateursController>
        // A7 — 5 tentatives / minute / IP. Bloque le brute-force et le credential stuffing.
        [HttpPost("connect")]
        [EnableRateLimiting("auth-login")]
        public async Task<IActionResult> Connect([FromBody] UserLoginModel user)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }
            try
            {
                if (string.IsNullOrEmpty(user.Utimail))
                {
                    return BadRequest("Email or password is missing.");
                }

                // Garde paiement : un tenant inscrit avec un plan payant reste en "PendingPayment"
                // tant que Stripe n'a pas confirmé la transaction. On bloque la connexion ici pour
                // forcer le passage par le checkout — le webhook checkout.session.completed
                // basculera ensuite le statut sur "Active" et le login fonctionnera normalement.
                if (_currentTenant.Current?.Status == "PendingPayment")
                {
                    return StatusCode(StatusCodes.Status402PaymentRequired, new
                    {
                        message = "Paiement requis. Finalisez votre abonnement avant de vous connecter.",
                        paymentRequired = true,
                    });
                }

                // PG migration : on lowercase les DEUX côtés. SQL Server avait une
                // collation CI par défaut (French_CI_AS) qui rendait WHERE Utimail = 'X'
                // match indifféremment 'x'/'X'. Postgres est case-sensitive sur VARCHAR —
                // sans LOWER() un utilisateur existant en base avec 'John@x.com' ne
                // pourrait plus se connecter en tapant 'john@x.com'.
                var emailLower = user.Utimail.Trim().ToLowerInvariant();
                Utilisateur? dbUser = await _dbContext.Utilisateurs
                    .FirstOrDefaultAsync(u => u.Utimail != null && u.Utimail.ToLower() == emailLower);

                // Account lockout : si l'utilisateur est verrouillé, on refuse SANS comparer
                // le mot de passe (timing-safe : pas d'info sur la validité du mdp pendant le
                // lock). Le rate limiter `auth-login` par IP reste actif, mais celui-ci est
                // par compte — couvre le ciblé (botnet qui change d'IP par essai).
                if (dbUser != null && dbUser.UtiLockoutUntil.HasValue && dbUser.UtiLockoutUntil > DateTime.UtcNow)
                {
                    var remainingSeconds = (int)(dbUser.UtiLockoutUntil.Value - DateTime.UtcNow).TotalSeconds;
                    return StatusCode(StatusCodes.Status423Locked, new
                    {
                        message = $"Compte temporairement verrouillé après des échecs répétés. Réessayez dans {remainingSeconds}s.",
                        code = "account_locked",
                        retryAfterSeconds = remainingSeconds,
                    });
                }

                if (dbUser == null || !BCrypt.Net.BCrypt.Verify(user.Utimps, dbUser.Utimps))
                {
                    // Incrémente le compteur d'échecs uniquement si l'email existe — sinon un
                    // attaquant pourrait énumérer les comptes existants en observant qui se
                    // verrouille. Backoff progressif : 3→30s, 5→5min, 10→1h.
                    if (dbUser != null)
                    {
                        await RegisterFailedLoginAsync(dbUser);
                    }
                    return Unauthorized("Invalid credentials.");
                }

                // Login OK → reset compteur. Évite qu'un utilisateur légitime se retrouve
                // verrouillé sur des échecs cumulés sur plusieurs jours.
                if (dbUser.UtiFailedLogins > 0 || dbUser.UtiLockoutUntil != null)
                {
                    dbUser.UtiFailedLogins = 0;
                    dbUser.UtiLockoutUntil = null;
                    await _dbContext.SaveChangesAsync();
                }

                // Garde "compte désactivé" — 3 raisons centralisées dans AccountAccessGuard :
                // Utiactif != "1" OU Employe.Actif != "A" OU Empsort <= today (fin de contrat).
                var disableReason = await AccountAccessGuard.CheckAsync(_dbContext, dbUser.Uticod);
                if (AccountAccessGuard.IsDisabled(disableReason))
                {
                    return StatusCode(StatusCodes.Status403Forbidden, new
                    {
                        message = AccountAccessGuard.MessageFor(disableReason),
                        accountDisabled = true,
                        reason = disableReason.ToString(),
                    });
                }
                var isManager = dbUser.Utirole?.Contains("manager", StringComparison.OrdinalIgnoreCase) ?? false;

                // Résolution Soccod/Sitcod simplifiée pour l'UX :
                //   - Si Company/Usersit explicites → on les utilise (rétrocompat avec ancien front).
                //   - Sinon → on prend le premier Socuser rattaché à cet utilisateur. En SaaS
                //     mono-société-par-tenant, l'utilisateur n'a typiquement qu'une seule entrée.
                var (societe, resolvedCompany) = await ResolveSocuserAsync(dbUser.Uticod!, user.Company, user.Usersit);
                if (societe == null) return NotFound();

                if (dbUser.UtiTwoFactorEnabled == "1")
                {
                    // SEC AI : on émet un jeton court (purpose="2fa-pending", exp 5 min) bound
                    // à l'Uticod. /complete-2fa-login l'exigera, ce qui force la séquence step 1
                    // → step 2 et empêche un attaquant qui ne connaît qu'un Uticod de sauter
                    //   l'authentification mot de passe.
                    var twoFaToken = GenerateTwoFactorPendingToken(dbUser.Uticod!);
                    return Ok(new { requires2fa = true, twoFactorToken = twoFaToken, uticod = dbUser.Uticod, societe, societe.Sitcod, isManager });
                }
                return await CompleteLoginSequence(dbUser, resolvedCompany, societe);
            }
            catch (Exception)
            {
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        /// <summary>
        /// Enregistre un échec de login : incrémente le compteur, et pose un lock progressif
        /// dont la durée dépend du seuil atteint. Le backoff suit la courbe OWASP recommandée :
        /// les 2 premiers essais sont tolérés (typo de mdp), les suivants déclenchent un lock
        /// croissant exponentiellement. Le compteur n'est PAS borné — il s'accumule jusqu'au
        /// prochain login réussi, ce qui assure qu'un attaquant ne peut pas attendre la fin
        /// d'un lock pour retenter à l'infini.
        /// </summary>
        private async Task RegisterFailedLoginAsync(Utilisateur dbUser)
        {
            try
            {
                var failed = (dbUser.UtiFailedLogins ?? 0) + 1;
                dbUser.UtiFailedLogins = failed;

                // Courbe OWASP : 3 essais → 30s, 5 → 5min, 10 → 1h, au-delà → 24h.
                TimeSpan? lockFor = failed switch
                {
                    < 3 => null,
                    < 5 => TimeSpan.FromSeconds(30),
                    < 10 => TimeSpan.FromMinutes(5),
                    < 20 => TimeSpan.FromHours(1),
                    _ => TimeSpan.FromHours(24),
                };
                if (lockFor.HasValue)
                    dbUser.UtiLockoutUntil = DateTime.UtcNow.Add(lockFor.Value);

                await _dbContext.SaveChangesAsync();
            }
            catch (Exception)
            {
                // Best-effort : un échec de SaveChanges sur ce chemin ne doit jamais bloquer
                // la réponse 401 au client (cas typique : SQL transient). Le rate limiter IP
                // continue de fonctionner et protège pendant la fenêtre où le compteur n'a
                // pas pu être incrémenté.
            }
        }

        /// <summary>
        /// Wrapper de compatibilité — délègue à <see cref="AccountAccessGuard.CheckAsync"/>
        /// qui est la source de vérité partagée avec MobileAuthController. Conservé pour
        /// éviter de toucher d'éventuels appelants encore en migration.
        /// </summary>
        private async Task<bool> IsAccountDisabledAsync(Utilisateur dbUser)
        {
            var reason = await AccountAccessGuard.CheckAsync(_dbContext, dbUser.Uticod);
            return AccountAccessGuard.IsDisabled(reason);
        }

        /// <summary>
        /// Trouve le Socuser à utiliser pour ce login. Privilégie un couple (Soccod, Sitcod) explicite,
        /// sinon retourne le premier Socuser de l'utilisateur (filtré par Soccod si fourni).
        /// </summary>
        private async Task<(Socuser? Socuser, string Company)> ResolveSocuserAsync(string uticod, string? requestedCompany, string? requestedSitcod)
        {
            if (!string.IsNullOrEmpty(requestedCompany) && !string.IsNullOrEmpty(requestedSitcod))
            {
                var explicitMatch = await _dbContext.Socusers.SingleOrDefaultAsync(s =>
                    s.Soccod == requestedCompany &&
                    s.Uticod == uticod &&
                    s.Sitcod == requestedSitcod);
                return (explicitMatch, requestedCompany);
            }

            var query = _dbContext.Socusers.Where(s => s.Uticod == uticod);
            if (!string.IsNullOrEmpty(requestedCompany))
                query = query.Where(s => s.Soccod == requestedCompany);

            var firstMatch = await query.OrderBy(s => s.Soccod).ThenBy(s => s.Sitcod).FirstOrDefaultAsync();
            return (firstMatch, firstMatch?.Soccod ?? requestedCompany ?? string.Empty);
        }

        // A7 — Brute-force du code TOTP 6 chiffres : 5 essais/min/IP plafonnent à un million
        // de minutes pour épuiser l'espace, ce qui rend l'attaque non viable en pratique.
        // SEC AI : on exige aussi le twoFactorToken émis par /connect (étape 1) — sans ça,
        // un attaquant qui connaît un Uticod peut sauter l'authentification mot de passe.
        [HttpPost("complete-2fa-login")]
        [EnableRateLimiting("auth-login")]
        public async Task<IActionResult> Complete2FALogin([FromBody] Complete2FARequest request)
        {
            try
            {
                // Vérifie que le token "2fa-pending" est valide et bind l'Uticod à celui du token,
                // pas à celui du body (le body reste populé par compat front mais ne peut plus
                // détourner la cible).
                if (string.IsNullOrEmpty(request.TwoFactorToken)
                    || !TryValidateTwoFactorPendingToken(request.TwoFactorToken, out var tokenUticod))
                {
                    return Unauthorized(new { message = "Session 2FA invalide ou expirée. Reconnectez-vous." });
                }

                var dbUser = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == tokenUticod);
                if (dbUser == null) return Unauthorized("Invalid user.");
                if (dbUser.UtiTwoFactorEnabled != "1" || string.IsNullOrEmpty(dbUser.UtiTwoFactorSecret))
                    return BadRequest("2FA not enabled for user.");

                // SEC — Secret stocké chiffré (TwoFactorSecretProtector). On déchiffre
                // pour reformer le secret Base32 attendu par Otp.NET.
                var rawSecret = _totpProtector.Unprotect(dbUser.UtiTwoFactorSecret);
                if (string.IsNullOrEmpty(rawSecret))
                    return BadRequest("2FA not enabled for user.");
                var secretBytes = Base32Encoding.ToBytes(rawSecret);
                var totp = new Totp(secretBytes);
                if (!totp.VerifyTotp(request.Code, out _, new VerificationWindow(1, 1)))
                {
                    return BadRequest("Code invalide");
                }

                // Réplique la garde de Connect (centralisée dans AccountAccessGuard) :
                // impossible de contourner la désactivation en passant directement par /complete-2fa-login.
                var disableReason2fa = await AccountAccessGuard.CheckAsync(_dbContext, dbUser.Uticod);
                if (AccountAccessGuard.IsDisabled(disableReason2fa))
                {
                    return StatusCode(StatusCodes.Status403Forbidden, new
                    {
                        message = AccountAccessGuard.MessageFor(disableReason2fa),
                        accountDisabled = true,
                        reason = disableReason2fa.ToString(),
                    });
                }

                var (societe, resolvedCompany) = await ResolveSocuserAsync(dbUser.Uticod!, request.Company, request.Usersit);
                if (societe == null) return NotFound();
                return await CompleteLoginSequence(dbUser, resolvedCompany, societe);
            }
            catch (Exception)
            {
                return StatusCode(500, "An error occurred.");
            }
        }

        private async Task<IActionResult> CompleteLoginSequence(Utilisateur dbUser, string company, Socuser societe)
        {
            try
            {
                var soclib = await _dbContext.Societes
                .Where(s => s.Soccod == societe.Soccod)
                .Select(s => s.Soclib)
                .FirstOrDefaultAsync();

                List<string> sitcods = await _dbContext.Socusers
                    .Where(s => s.Soccod == company && s.Uticod == dbUser.Uticod)
                    .Select(s => s.Sitcod)
                    .ToListAsync();

                var isEmp = await _dbContext.Employes.Where(e => e.Empcod == dbUser.Uticod).AnyAsync();
                var roleName = dbUser.Utirole ?? string.Empty;
                var isManager = roleName.Contains("manager", StringComparison.OrdinalIgnoreCase);
                var accessToken = GenerateJwtToken(dbUser.Uticod);
                var refreshToken = GenerateRefreshToken();

                var refreshTokenEntity = new RefreshToken
                {
                    Uticod = dbUser.Uticod,
                    // SEC — On stocke uniquement le hash SHA-256, le token en clair n'existe
                    // qu'en mémoire et dans le cookie HttpOnly du client.
                    Token = RefreshTokenHasher.Hash(refreshToken),
                    ExpiresAt = DateTime.UtcNow.AddDays(7)
                };
                await _dbContext.RefreshTokens.AddAsync(refreshTokenEntity);
                await _dbContext.SaveChangesAsync();

                Response.Cookies.Append("accessToken", accessToken, CreateCookieOptions(DateTimeOffset.UtcNow.AddMinutes(30)));
                Response.Cookies.Append("refreshToken", refreshToken, CreateCookieOptions(DateTimeOffset.UtcNow.AddDays(7)));
                Response.Cookies.Append("uticod", dbUser.Uticod ?? string.Empty, CreateCookieOptions(DateTimeOffset.UtcNow.AddDays(7)));
                // SEC — Cookie posé en HttpOnly : aucune raison fonctionnelle de le laisser
                // accessible au JS, le front lit l'info admin depuis /me (réponse JSON).
                Response.Cookies.Append("admin", dbUser.Utiadm ?? "0", CreateCookieOptions(DateTimeOffset.UtcNow.AddDays(7)));

                // Détection de nouvel appareil/réseau + alerte email. Best-effort,
                // n'interrompt jamais le login en cas d'erreur. Couvre les deux chemins
                // (login sans 2FA et complete-2fa-login) puisque tous les deux passent ici.
                if (!string.IsNullOrEmpty(dbUser.Uticod))
                {
                    _ = _knownDevices.RegisterAndAlertAsync(dbUser.Uticod, dbUser.Utimail, HttpContext, HttpContext.RequestAborted);
                }

                var socimg = await _dbContext.Societes
                    .Where(s => s.Soccod == company)
                    .Select(s => s.Socimg)
                    .FirstOrDefaultAsync();

                string utilib = dbUser.Utiprn + " " + dbUser.Utinom;

                // Fetch permissions for the user's role
                var permissions = new List<RolePermission>();
                if (!string.IsNullOrEmpty(dbUser.Utirole))
                {
                    var role = await _dbContext.Roles
                        .Include(r => r.Permissions)
                        .FirstOrDefaultAsync(r => r.RoleName == dbUser.Utirole);
                    if (role?.Permissions != null)
                    {
                        permissions = role.Permissions;
                    }
                }

                return Ok(new { dbUser.Uticod, dbUser.Utiimg, socimg, utilib, societe, sitcods, soclib, dbUser.Utiadm, isEmp, permissions,isManager });
            }
            catch (Exception)
            {
                throw;
            }
        }


        // POST api/Utilisateurs/refresh
        [HttpPost("refresh")]
        public async Task<IActionResult> RefreshToken()
        {
            try
            {
                // Read refresh token from httpOnly cookie
                if (!Request.Cookies.TryGetValue("refreshToken", out var refreshTokenValue) || string.IsNullOrEmpty(refreshTokenValue))
                {
                    return Unauthorized(new { message = "Refresh token is required" });
                }

                var hashedIncoming = RefreshTokenHasher.Hash(refreshTokenValue);
                var refreshToken = await _dbContext.RefreshTokens
                    .FirstOrDefaultAsync(rt => rt.Token == hashedIncoming && !rt.Revoked);

                if (refreshToken == null || refreshToken.ExpiresAt < DateTime.UtcNow)
                {
                    return Unauthorized(new { message = "Invalid or expired refresh token" });
                }

                var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == refreshToken.Uticod);
                if (user == null)
                {
                    return Unauthorized(new { message = "User not found" });
                }

                // RGPD clause 13.3 / Art. 32 — révocation effective au refresh : si entre
                // l'émission du RT et son utilisation l'admin a désactivé le compte OU si
                // la date de sortie a été atteinte, on refuse + on grille le RT pour empêcher
                // tout nouvel essai (l'app devra refaire un login complet, qui sera bloqué).
                var refreshDisableReason = await AccountAccessGuard.CheckAsync(_dbContext, user.Uticod);
                if (AccountAccessGuard.IsDisabled(refreshDisableReason))
                {
                    refreshToken.Revoked = true;
                    await _dbContext.SaveChangesAsync();
                    return StatusCode(StatusCodes.Status403Forbidden, new
                    {
                        message = AccountAccessGuard.MessageFor(refreshDisableReason),
                        accountDisabled = true,
                        reason = refreshDisableReason.ToString(),
                    });
                }

                var newAccessToken = GenerateJwtToken(user.Uticod);
                var newRefreshToken = GenerateRefreshToken();

                // Revoke old refresh token
                refreshToken.Revoked = true;

                // Save new refresh token (hash only — voir RefreshTokenHasher).
                var newRefreshTokenEntity = new RefreshToken
                {
                    Uticod = user.Uticod,
                    Token = RefreshTokenHasher.Hash(newRefreshToken),
                    ExpiresAt = DateTime.UtcNow.AddDays(7)
                };
                _dbContext.RefreshTokens.Add(newRefreshTokenEntity);
                await _dbContext.SaveChangesAsync();

                Response.Cookies.Append("accessToken", newAccessToken, CreateCookieOptions(DateTimeOffset.UtcNow.AddMinutes(30)));
                Response.Cookies.Append("refreshToken", newRefreshToken, CreateCookieOptions(DateTimeOffset.UtcNow.AddDays(7)));
                Response.Cookies.Append("uticod", user.Uticod ?? string.Empty, CreateCookieOptions(DateTimeOffset.UtcNow.AddDays(7)));
                return Ok(new { message = "Token refreshed successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while refreshing token", error = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        [Authorize]
        [HttpDelete("delete/{uticod}")]
        [Admin]
        public async Task<IActionResult> DeleteUtilisateur(string uticod)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(uticod))
                {
                    return BadRequest(new { Message = "User code is required" });
                }

                var success = await _utilisateurRepository.DeleteUtilisateurAsync(uticod);

                if (!success)
                {
                    return NotFound(new { Message = "User not found" });
                }

                return Ok(new { Message = "Utilisateur supprimé avec succès." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Erreur interne lors de la suppression.", Details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        [Authorize]
        [HttpPost("reset-password-admin/{uticod}")]
        [Admin]
        public async Task<IActionResult> ResetPasswordAdmin(string uticod, [FromBody] AdminResetPasswordRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.NewPassword))
                    return BadRequest(new { Message = "Le nouveau mot de passe est requis." });

                var success = await _utilisateurRepository.ResetPasswordAsync(uticod, request.NewPassword);
                if (!success) return NotFound(new { Message = "Utilisateur non trouvé" });

                return Ok(new { Message = "Mot de passe réinitialisé avec succès." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Erreur lors de la réinitialisation.", Details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        [Authorize]
        [HttpPost("toggle-status/{uticod}")]
        [Admin]
        public async Task<IActionResult> ToggleStatus(string uticod)
        {
            try
            {
                var success = await _utilisateurRepository.ToggleStatusAsync(uticod);
                if (!success) return NotFound(new { Message = "Utilisateur non trouvé" });

                return Ok(new { Message = "Statut mis à jour avec succès." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Erreur lors de la mise à jour du statut.", Details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> GetCurrentUser()
        {
            var uticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uticod))
            {
                return Unauthorized();
            }

            var user = await _dbContext.Utilisateurs
                .Where(u => u.Uticod == uticod)
                .Select(u => new
                {
                    u.Uticod,
                    u.Utiadm,
                    u.Utiprn,
                    u.Utinom,
                    u.Utiimg,
                    u.Utimail,
                    u.UtiEmailVerified,
                    Role = _dbContext.Roles
                        .Include(r => r.Permissions)
                        .FirstOrDefault(r => r.RoleName == u.Utirole)
                })
                .FirstOrDefaultAsync();

            if (user == null)
            {
                return Unauthorized();
            }

            var isEmp = await _dbContext.Employes.AnyAsync(e => e.Empcod == uticod);
            var utilib = $"{user.Utiprn} {user.Utinom}".Trim();

            // Get user's service code for manager filtering
            string? sercod = null;
            if (isEmp)
            {
                sercod = await _dbContext.Employes
                    .Where(e => e.Empcod == uticod)
                    .Select(e => e.Sercod)
                    .FirstOrDefaultAsync();
            }

            // Société/site du tenant : nécessaire pour que le dashboard sache quoi requêter après
            // signup direct (où il n'y a pas eu de POST /connect qui les renvoie). On va chercher
            // le 1er Socuser lié à cet utilisateur, puis on joint Societe pour le libellé.
            string? soccod = null;
            string? sitcod = null;
            string? soclib = null;
            var socLink = await _dbContext.Socusers
                .Where(s => s.Uticod == uticod)
                .OrderBy(s => s.Soccod)
                .Select(s => new { s.Soccod, s.Sitcod })
                .FirstOrDefaultAsync();
            if (socLink != null)
            {
                soccod = socLink.Soccod;
                sitcod = socLink.Sitcod;
                soclib = await _dbContext.Societes
                    .Where(x => x.Soccod == soccod)
                    .Select(x => x.Soclib)
                    .FirstOrDefaultAsync();
            }

            // Source de vérité côté front pour les checks d'autorisation : roleName + permissions.
            // utiadm + isManager + isAdmin sont fournis en bonus pour les composants legacy
            // qui les lisent encore directement.
            var roleName = user.Role?.RoleName;
            var isAdmin = ABRPOINT.Server.Authorization.PermissionCatalog.IsAdminRole(roleName) || user.Utiadm == "1";
            var isManager = string.Equals(roleName, ABRPOINT.Server.Authorization.PermissionCatalog.Roles.Manager, StringComparison.OrdinalIgnoreCase)
                            || (roleName?.Contains("manager", StringComparison.OrdinalIgnoreCase) ?? false);

            var tenant = _currentTenant.Current;
            var isTrialing = ABRPOINT.Server.Tenancy.TrialPolicy.IsTrialing(tenant);
            var trialDaysRemaining = ABRPOINT.Server.Tenancy.TrialPolicy.DaysRemaining(tenant);
            var limits = ABRPOINT.Server.Tenancy.TrialPolicy.GetLimits(tenant);
            // Plan canonique (Starter remplace l'ancien "Essentiel") + matrice fonctionnelle
            // consommée par le front via useAuth().planAllows(feature).
            var planDef = ABRPOINT.Server.Tenancy.PlanCatalog.GetPlan(tenant?.PlanCode);
            // 2026-05-12 : en essai, on n'accorde plus Premium-pour-tous. Le tenant voit
            // les features de SON plan sélectionné — Starter en trial = vraies restrictions.
            // Cohérent avec la promesse "votre plan = vos modules" et évite l'effet
            // falaise au paiement (modules qui disparaissent brutalement). Fallback Premium
            // uniquement si le tenant n'a pas de plan défini (cas legacy).
            //
            // 2026-05-26 — On combine désormais les features du plan AVEC les addons
            // souscrits (Tenant.Addons, ex. "signatureElectronique,aiAssistantRh"). Le
            // helper GetEffectiveFeatures fait l'OR-merge : un Starter ayant souscrit
            // l'addon Signature obtient ElectronicSignature=true sans changer de pack.
            // Si tenant null (cas legacy), on retombe sur Premium pour ne pas casser.
            var effectiveFeatures = tenant != null
                ? ABRPOINT.Server.Tenancy.PlanCatalog.GetEffectiveFeatures(tenant.PlanCode, tenant.Addons)
                : ABRPOINT.Server.Tenancy.PlanCatalog.Premium.Features;

            // Liste brute des addons EXPLICITEMENT souscrits par le tenant (ceux qui
            // s'ajoutent au-delà des modules natifs du pack — cf. NormalizeAddons côté
            // signup qui retire déjà les doublons pack/addon). Exposé en plus des
            // planFeatures fusionnées pour permettre à MonAbonnementPage de
            // distinguer "module inclus dans le pack" vs "module additionnel souscrit".
            var subscribedAddons = ABRPOINT.Server.Tenancy.PlanCatalog.ParseAddons(tenant?.Addons).ToArray();

            return Ok(new
            {
                uticod = user.Uticod,
                utiadm = user.Utiadm,
                utiimg = user.Utiimg,
                utimail = user.Utimail,
                // emailVerified : true sauf si la colonne est explicitement "0" (créé par un
                // signup post-2026-05 sans encore avoir saisi son OTP). Les comptes legacy
                // (colonne NULL — créés avant l'introduction de la vérification email) sont
                // grandfathered : on ne va pas leur afficher une bannière "vérifiez votre
                // email" rétroactivement alors qu'ils utilisent le SaaS depuis des mois.
                emailVerified = !string.Equals(user.UtiEmailVerified, "0", StringComparison.Ordinal),
                isEmp,
                isAdmin,
                isManager,
                roleName,
                utilib,
                sercod,
                soccod,
                sitcod,
                soclib,
                tenantStatus = tenant?.Status,
                planCode = ABRPOINT.Server.Tenancy.PlanCatalog.Normalize(tenant?.PlanCode),
                isTrialing,
                trialEndsAt = tenant?.TrialEndsAt,
                trialDaysRemaining,
                planLimits = new
                {
                    maxEmployees = limits.MaxEmployees,
                    maxSocietes = limits.MaxSocietes,
                    maxSites = limits.MaxSites,
                    includedEmployees = limits.IncludedEmployees,
                    overageRatePerEmployee = limits.OverageRatePerEmployee,
                },
                planFeatures = effectiveFeatures,
                addons = subscribedAddons,
                permissions = user.Role?.Permissions ?? new List<RolePermission>()
            });
        }

        public sealed record VerifyEmailRequest(string Code);

        /// <summary>
        /// Vérifie le code OTP 6 chiffres envoyé à l'email de l'utilisateur. Sur succès,
        /// flippe Utilisateur.UtiEmailVerified="1" et efface les champs OTP. Idempotent
        /// (déjà vérifié → 200 OK). Anti brute-force : compteur d'essais incrémenté à
        /// chaque échec, code invalidé après MaxAttempts essais.
        /// </summary>
        [Authorize]
        [HttpPost("verify-email")]
        [EnableRateLimiting("auth-login")] // même policy que le login : ~6 tentatives/min/IP
        public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest req, CancellationToken ct)
        {
            if (req is null || string.IsNullOrWhiteSpace(req.Code))
                return BadRequest(new { error = "Code requis.", code = "code_required" });

            var uticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uticod)) return Unauthorized();

            var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == uticod, ct);
            if (user is null) return Unauthorized();

            // Déjà vérifié : on renvoie 200 silencieusement (idempotent). Couvre :
            //   - "1" : vérifié via cet endpoint ;
            //   - NULL : compte legacy grandfathered (cf. /me pour le même critère).
            if (!string.Equals(user.UtiEmailVerified, "0", StringComparison.Ordinal))
                return Ok(new { verified = true, alreadyVerified = true });

            if (string.IsNullOrEmpty(user.UtiEmailVerifCode))
                return BadRequest(new { error = "Aucun code en cours. Demandez un nouveau code.", code = "no_code_issued" });

            if (user.UtiEmailVerifExpiry is null || user.UtiEmailVerifExpiry < DateTime.UtcNow)
            {
                // Expiration silencieuse : on n'efface PAS la ligne pour que /resend remette
                // tout à zéro proprement (et pour garder une trace audit du dernier hash si jamais).
                return BadRequest(new { error = "Code expiré. Demandez un nouveau code.", code = "code_expired" });
            }

            if ((user.UtiEmailVerifAttempts ?? 0) >= EmailVerificationHelper.MaxAttempts)
                return BadRequest(new { error = "Trop de tentatives. Demandez un nouveau code.", code = "too_many_attempts" });

            // Cleanup défensif du code saisi : on tolère espaces / tirets en cas de copier-coller
            // depuis l'email où le code est parfois affiché « 123 456 » par certains clients.
            var submitted = new string(req.Code.Where(char.IsDigit).ToArray());
            var ok = !string.IsNullOrEmpty(submitted) && BCrypt.Net.BCrypt.Verify(submitted, user.UtiEmailVerifCode);
            if (!ok)
            {
                user.UtiEmailVerifAttempts = (user.UtiEmailVerifAttempts ?? 0) + 1;
                await _dbContext.SaveChangesAsync(ct);
                var remaining = Math.Max(0, EmailVerificationHelper.MaxAttempts - user.UtiEmailVerifAttempts.Value);
                return BadRequest(new { error = $"Code invalide. {remaining} tentative(s) restante(s).", code = "invalid_code", remaining });
            }

            user.UtiEmailVerified = "1";
            user.UtiEmailVerifCode = null;
            user.UtiEmailVerifExpiry = null;
            user.UtiEmailVerifAttempts = 0;
            await _dbContext.SaveChangesAsync(ct);
            _logger?.LogInformation("Email vérifié pour {Uticod} ({Email})", user.Uticod, user.Utimail);

            // Mail de confirmation « compte activé » envoyé après validation du code OTP.
            // Distinct du mail OTP/bienvenue émis au signup : ici on annonce que le compte
            // est PLEINEMENT actif. Best-effort — un échec SMTP ne doit pas casser le flow
            // de vérification (l'utilisateur est déjà passé en "1" en DB).
            try
            {
                await SendAccountActivatedEmailAsync(user);
            }
            catch (Exception emailEx)
            {
                _logger?.LogWarning(emailEx, "Échec envoi email de confirmation activation pour {Uticod}", user.Uticod);
            }

            return Ok(new { verified = true });
        }

        /// <summary>
        /// Envoie le mail « Votre compte est activé » à l'utilisateur juste après
        /// validation du code OTP. Best-effort (catch dans l'appelant). Contient un
        /// récap rapide + un lien vers le dashboard pour démarrer l'onboarding.
        /// </summary>
        private async Task SendAccountActivatedEmailAsync(Utilisateur user)
        {
            if (_emailService is null || string.IsNullOrWhiteSpace(user.Utimail)) return;

            var displayName = !string.IsNullOrWhiteSpace(user.Utiprn) || !string.IsNullOrWhiteSpace(user.Utinom)
                ? $"{user.Utiprn} {user.Utinom}".Trim()
                : user.Uticod;
            var brand = ABRPOINT.Server.Services.EmailTemplates.BrandName;
            var subject = $"Votre compte {brand} est activé";

            var inner = $@"
                <p style='font-size:15px;color:#0f172a;margin:0 0 12px;'>Bonjour {System.Net.WebUtility.HtmlEncode(displayName)},</p>
                <p style='font-size:14px;color:#334155;line-height:1.55;margin:0 0 16px;'>
                    Votre adresse email vient d'être validée. Bienvenue officiellement dans <strong>{brand}</strong> —
                    votre compte est désormais actif et vous bénéficiez de l'intégralité de votre période d'essai de 30 jours.
                </p>
                {ABRPOINT.Server.Services.EmailTemplates.StatusBanner("Compte activé avec succès.", ABRPOINT.Server.Services.EmailTemplates.StatusKind.Success)}
                <p style='font-size:14px;color:#0f172a;margin:18px 0 8px;font-weight:700;'>Prochaines étapes recommandées</p>
                <ul style='margin:0 0 14px;padding-left:18px;color:#334155;font-size:13.5px;line-height:1.65;'>
                    <li>Paramétrer votre société et vos sites depuis le menu <em>Données de base</em>.</li>
                    <li>Importer ou créer vos collaborateurs (l'app mobile est immédiatement disponible).</li>
                    <li>Configurer vos postes de travail puis les affecter à une classe horaire.</li>
                    <li>Activer la pointeuse de votre choix (web, mobile, badgeuse physique).</li>
                </ul>
                <div style='text-align:center;margin:18px 0 8px;'>
                    {ABRPOINT.Server.Services.EmailTemplates.Button("Accéder à mon espace", "/dashboard")}
                </div>
                <p style='font-size:12px;color:#64748b;line-height:1.5;margin:16px 0 0;'>
                    Une question ? Répondez à cet email — notre équipe vous accompagne pendant toute la durée de l'essai.
                </p>";

            var body = ABRPOINT.Server.Services.EmailTemplates.Wrap(
                "Compte activé",
                "Votre adresse email a été vérifiée — votre espace est désormais pleinement opérationnel.",
                inner);

            await _emailService.SendEmailAsync(user.Utimail, subject, body);
        }

        /// <summary>
        /// Régénère un nouveau code OTP et l'envoie par email. Rate-limité côté serveur
        /// (cooldown de ResendCooldownSeconds entre 2 demandes) en plus du rate limiter
        /// IP. Reset le compteur d'essais. Idempotent — si l'email est déjà vérifié,
        /// renvoie 200 sans rien faire (évite de spammer un utilisateur déjà valide).
        /// </summary>
        [Authorize]
        [HttpPost("resend-verification")]
        [EnableRateLimiting("auth-login")]
        public async Task<IActionResult> ResendVerification(CancellationToken ct)
        {
            var uticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uticod)) return Unauthorized();

            var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == uticod, ct);
            if (user is null) return Unauthorized();

            // Idempotent : déjà vérifié OU legacy NULL → no-op pour ne pas spammer un user valide.
            if (!string.Equals(user.UtiEmailVerified, "0", StringComparison.Ordinal))
                return Ok(new { sent = false, alreadyVerified = true });
            if (string.IsNullOrWhiteSpace(user.Utimail))
                return BadRequest(new { error = "Aucune adresse email enregistrée pour ce compte.", code = "no_email" });

            // Cooldown anti-spam : si l'expiry actuelle est encore récente (< CodeLifetimeMinutes
            // moins le cooldown), on refuse le resend pour empêcher quelqu'un de matraquer
            // l'API. Calcul : si on est < ResendCooldownSeconds après l'émission précédente.
            if (user.UtiEmailVerifExpiry.HasValue)
            {
                var emittedAt = user.UtiEmailVerifExpiry.Value.AddMinutes(-EmailVerificationHelper.CodeLifetimeMinutes);
                var sinceEmit = DateTime.UtcNow - emittedAt;
                if (sinceEmit.TotalSeconds < EmailVerificationHelper.ResendCooldownSeconds)
                {
                    var wait = (int)Math.Ceiling(EmailVerificationHelper.ResendCooldownSeconds - sinceEmit.TotalSeconds);
                    return StatusCode(429, new { error = $"Veuillez patienter {wait}s avant un nouvel envoi.", code = "cooldown", retryAfterSeconds = wait });
                }
            }

            var code = EmailVerificationHelper.GenerateCode();
            user.UtiEmailVerifCode = BCrypt.Net.BCrypt.HashPassword(code);
            user.UtiEmailVerifExpiry = DateTime.UtcNow.AddMinutes(EmailVerificationHelper.CodeLifetimeMinutes);
            user.UtiEmailVerifAttempts = 0;
            await _dbContext.SaveChangesAsync(ct);

            // Envoi best-effort — un échec SMTP ne doit pas bloquer l'utilisateur ; il pourra
            // re-cliquer ou contacter le support. En DEV (pas d'IEmailService), on log le code
            // au niveau INFO pour permettre le développement sans serveur mail.
            if (_emailService is null)
            {
                _logger?.LogInformation("[DEV] Code de vérification email pour {Email} : {Code} (valide {Minutes}min)",
                    user.Utimail, code, EmailVerificationHelper.CodeLifetimeMinutes);
                return Ok(new { sent = true, devLogged = true });
            }

            try
            {
                var firstName = (user.Utiprn ?? "").Trim();
                var safeFirstName = System.Net.WebUtility.HtmlEncode(firstName);
                var safeCode = System.Net.WebUtility.HtmlEncode(code);

                var verifBlock = $@"
<table role=""presentation"" cellpadding=""0"" cellspacing=""0"" border=""0"" width=""100%"" style=""margin:20px 0;"">
  <tr>
    <td style=""background:#f0f6ff;border:1px solid #cdd9ee;border-radius:14px;padding:24px;text-align:center;"">
      <p style=""margin:0 0 8px;color:#475569;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;"">Votre nouveau code de vérification</p>
      <div style=""font-family:'Courier New',monospace;font-size:36px;font-weight:800;letter-spacing:10px;color:#0040a1;margin:4px 0 10px;padding:8px 0;"">{safeCode}</div>
      <p style=""margin:0;color:#64748b;font-size:12px;"">Valable {EmailVerificationHelper.CodeLifetimeMinutes} minutes.</p>
    </td>
  </tr>
</table>";

                var greeting = string.IsNullOrEmpty(safeFirstName)
                    ? "<p>Bonjour,</p>"
                    : $"<p>Bonjour <strong>{safeFirstName}</strong>,</p>";
                var inner =
                    greeting +
                    "<p>Vous avez demandé un nouveau code de vérification pour confirmer votre adresse email.</p>" +
                    verifBlock +
                    "<p style=\"color:#64748b;font-size:13px;\">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email — votre compte reste sécurisé tant que le code n'est pas utilisé.</p>" +
                    "<p style=\"margin-top:18px;\">L'équipe Concorde Workforce</p>";

                var subject = $"Code de vérification {ABRPOINT.Server.Services.EmailTemplates.BrandName} : {code}";
                var body = ABRPOINT.Server.Services.EmailTemplates.Wrap(
                    title: "Nouveau code de vérification",
                    preview: $"Votre nouveau code de vérification : {code} (valable {EmailVerificationHelper.CodeLifetimeMinutes} min).",
                    innerHtml: inner);
                await _emailService.SendEmailAsync(user.Utimail, subject, body);
                _logger?.LogInformation("Code de vérification renvoyé à {Email}", user.Utimail);
                return Ok(new { sent = true });
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Resend verification échoué pour {Email}", user.Utimail);
                // On a déjà stocké le hash en DB — le code est valide. L'utilisateur peut
                // retenter le resend (qui refera un nouveau code) ou contacter le support.
                return StatusCode(502, new { error = "Échec d'envoi de l'email. Réessayez dans quelques instants.", code = "email_send_failed" });
            }
        }

        // POST api/Utilisateurs/logout
        [Authorize]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            try
            {
                var userUticod = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

                if (!string.IsNullOrEmpty(userUticod))
                {
                    // Revoke all refresh tokens for user
                    var tokens = await _dbContext.RefreshTokens
                        .Where(rt => rt.Uticod == userUticod && !rt.Revoked)
                        .ToListAsync();

                    foreach (var token in tokens)
                    {
                        token.Revoked = true;
                    }
                    await _dbContext.SaveChangesAsync();
                }

                // Clear cookies
                Response.Cookies.Delete("accessToken", CreateDeleteCookieOptions());
                Response.Cookies.Delete("refreshToken", CreateDeleteCookieOptions());
                Response.Cookies.Delete("uticod", CreateDeleteCookieOptions());
                Response.Cookies.Delete("admin", CreateDeleteCookieOptions());

                return Ok(new { message = "Logged out successfully" });
            }
            catch (Exception)
            {
                return StatusCode(500, "An error occurred during logout");
            }
        }



        // PUT api/<UtilisateursController>/update-user/soccod/sitcod
        [HttpPut("update-user/{soccod}/{sitcod}")]
        [Admin]
        public async Task<bool> Put([FromBody] UtilisateurUpdate utilisateur, string soccod, string sitcod)
        {
            try
            {
                if (utilisateur.Utilisateur != null)
                {
                    await _utilisateurRepository.UpdateUserAsync(utilisateur);
                    return true;
                }

                return false;
            }
            catch (Exception)
            {
                throw;
            }
        }
        // A3 — `[Authorize]` ajouté : sans, n'importe qui pouvait modifier le profil
        // d'un autre utilisateur en posant son uticod dans le payload.
        [Authorize]
        [HttpPut("update-profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] UtilisateurUpdate utilisateur)
        {
            try
            {
                if (utilisateur?.Utilisateur == null)
                    return BadRequest(new { message = "Payload invalide." });

                // Self-service : seul le propriétaire (ou un admin) peut modifier son profil.
                var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(caller)) return Unauthorized();

                var target = utilisateur.Utilisateur.Uticod;
                if (!string.IsNullOrEmpty(target) && !string.Equals(caller, target, StringComparison.OrdinalIgnoreCase))
                {
                    var isAdmin = await _dbContext.Utilisateurs.AsNoTracking()
                        .Where(u => u.Uticod == caller)
                        .Select(u => u.Utiadm == "1" || ABRPOINT.Server.Authorization.PermissionCatalog.IsAdminRole(u.Utirole))
                        .FirstOrDefaultAsync();
                    if (!isAdmin) return Forbid();
                }

                await _utilisateurRepository.UpdateUserAsync(utilisateur);
                return Ok(new { success = true });
            }
            catch (Exception)
            {
                throw;
            }
        }

        // A3 — `[Authorize]` + cohérence : un upload de fichier sans auth pouvait
        // saturer le disque ; en plus on imposait l'uticod via query → trivialement
        // usurpable. On force l'uticod à venir du JWT.
        [Authorize]
        [HttpPost("upload-profile")]
        public async Task<IActionResult> UploadProfileImage(IFormFile file, CancellationToken ct)
        {
            var uticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uticod)) return Unauthorized();

            // Garde quota — photo de profil typiquement < 500 Ko mais on protège quand
            // même : un tenant saturé ne doit pas pouvoir grappiller le moindre octet.
            if (file is not null && file.Length > 0 && _currentTenant.Current is { } tenant)
            {
                var snap = await _quotaGuard.CheckAsync(tenant.Id, file.Length, ct);
                if (snap.WouldExceed)
                {
                    return StatusCode(507, new
                    {
                        code = "storage_quota_exceeded",
                        message = $"Quota de stockage atteint ({snap.UsedMb} Mo / {snap.QuotaMb} Mo).",
                        usedMb = snap.UsedMb,
                        quotaMb = snap.QuotaMb,
                        percentUsed = snap.PercentUsed,
                    });
                }
            }

            var (success, filePath, error) = await FileHelper.SaveFile(file, _currentTenant.Current?.Slug);
            if (!success) return BadRequest(error);
            await _utilisateurRepository.UpdateProfileImageAsync(uticod, filePath);

            return Ok(new { filePath });
        }


        // A3 — `[Authorize]` ajouté : l'endpoint déchiffrait CIN/téléphone, son accès
        // anonyme rendait toutes les données personnelles consultables.
        [Authorize]
        [HttpGet("get-profile/{soccod}/{uticod}")]
        public async Task<IActionResult> GetProfile(string soccod,string uticod)
        {
            try
            {
                // Le profil contient des champs déchiffrés (CIN, téléphone). On ne le donne
                // qu'à son propriétaire ou à un admin. Sans ce check, un employé pouvait lire
                // les données personnelles de n'importe quel collègue.
                var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(caller)) return Unauthorized();
                if (!string.Equals(caller, uticod, StringComparison.OrdinalIgnoreCase))
                {
                    var isAdmin = await _dbContext.Utilisateurs.AsNoTracking()
                        .Where(u => u.Uticod == caller)
                        .Select(u => u.Utiadm == "1" || ABRPOINT.Server.Authorization.PermissionCatalog.IsAdminRole(u.Utirole))
                        .FirstOrDefaultAsync();
                    if (!isAdmin) return Forbid();
                }

                UtiProfile profile = await _utilisateurRepository.GetProfileAsync(soccod,uticod);
                if (profile?.Employee != null)
                {
                    profile.Employee.Empcin = _encryptionService.Decrypt(profile.Employee.Empcin);
                    profile.Employee.Emptel = _encryptionService.Decrypt(profile.Employee.Emptel);
                }

                return Ok(profile);
            }
            catch (Exception)
            {
                throw;
            }
        }
        // A3 — `[Authorize]` + verrou : sans auth, un attaquant pouvait poser n'importe
        // quel uticod dans le DTO et changer le mot de passe. On force l'uticod cible
        // = JWT.NameIdentifier (sauf admin).
        [Authorize]
        [HttpPut("change-password")]
        public async Task<IActionResult> ChangePassword(UpdatePassword pwd)
        {
            try
            {
                if (pwd == null) return BadRequest(new { message = "Payload invalide." });
                var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(caller)) return Unauthorized();

                if (!string.IsNullOrEmpty(pwd.uticod) && !string.Equals(caller, pwd.uticod, StringComparison.OrdinalIgnoreCase))
                {
                    var isAdmin = await _dbContext.Utilisateurs.AsNoTracking()
                        .Where(u => u.Uticod == caller)
                        .Select(u => u.Utiadm == "1" || ABRPOINT.Server.Authorization.PermissionCatalog.IsAdminRole(u.Utirole))
                        .FirstOrDefaultAsync();
                    if (!isAdmin) return Forbid();
                }
                else
                {
                    // Si le DTO ne précise pas la cible, on l'aligne explicitement sur l'appelant.
                    pwd.uticod = caller;
                }

                // Vérif HIBP avant d'écrire en base. Empêche un user de revenir vers un mdp
                // fuité même s'il connaît son mdp actuel — c'est aussi la mesure défensive
                // contre un attaquant qui aurait volé un cookie de session et tenterait de
                // s'attribuer un mdp connu pour persister l'accès.
                if (!string.IsNullOrEmpty(pwd.newPassword))
                {
                    var breachCount = await _passwordBreach.GetBreachCountAsync(pwd.newPassword, HttpContext.RequestAborted);
                    if (breachCount > 0)
                        return BadRequest(new
                        {
                            message = $"Ce mot de passe figure dans des fuites de données publiques (vu {breachCount:N0} fois). Choisissez un mot de passe différent.",
                            code = "password_pwned",
                        });
                }

                bool profile = await _utilisateurRepository.ChangePasswordAsync(pwd);
                return Ok(new { success = profile });
            }
            catch (Exception)
            {
                throw;
            }
        }

        // ── 2FA Endpoints ──────────────────────────────────────────────

        // A8 — Vérifie que l'appelant active SON propre 2FA. Sans cette comparaison,
        // un user authentifié peut activer/réinitialiser le 2FA d'un autre user et,
        // pire, exfiltrer son secret TOTP via le QR retourné.
        [Authorize]
        [HttpPost("enable-2fa/{uticod}")]
        public async Task<IActionResult> EnableTwoFactor(string uticod)
        {
            try
            {
                var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(caller)) return Unauthorized();
                if (!string.Equals(caller, uticod, StringComparison.OrdinalIgnoreCase))
                    return Forbid();

                var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == uticod);
                if (user == null) return NotFound(new { Message = "User not found" });

                var secretKey = KeyGeneration.GenerateRandomKey(20);
                var base32Secret = Base32Encoding.ToString(secretKey);

                // SEC — Stockage chiffré via TwoFactorSecretProtector (clé dérivée
                // HKDF d'Encryption:AesKey, séparée de la clé PII). Un dump SQL ne
                // permet plus de régénérer les codes 2FA sans connaître aussi la
                // clé maître.
                user.UtiTwoFactorSecret = _totpProtector.Protect(base32Secret);
                user.UtiTwoFactorEnabled = "0";
                await _dbContext.SaveChangesAsync();

                var issuer = "GestTemps";
                var email = user.Utimail ?? user.Uticod ?? "User";
                
                // Use QRCoder's built-in PayloadGenerator to ensure strict TOTP spec compliance
                var payload = new PayloadGenerator.OneTimePassword()
                {
                    Secret = base32Secret,
                    Issuer = issuer,
                    Label = email,
                    Type = PayloadGenerator.OneTimePassword.OneTimePasswordAuthType.TOTP
                };

                using var qrGenerator = new QRCodeGenerator();
                var qrCodeData = qrGenerator.CreateQrCode(payload.ToString(), QRCodeGenerator.ECCLevel.Q);
                using var qrCode = new PngByteQRCode(qrCodeData);
                var qrCodeImage = qrCode.GetGraphic(10);
                var base64Qr = Convert.ToBase64String(qrCodeImage);

                return Ok(new
                {
                    secret = base32Secret,
                    qrCodeBase64 = $"data:image/png;base64,{base64Qr}",
                    manualEntryKey = base32Secret
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error enabling 2FA", Error = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // A8 — Verify-2FA cible toujours l'appelant.
        [Authorize]
        [HttpPost("verify-2fa/{uticod}")]
        public async Task<IActionResult> VerifyTwoFactor(string uticod, [FromBody] Verify2FARequest request)
        {
            try
            {
                var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(caller)) return Unauthorized();
                if (!string.Equals(caller, uticod, StringComparison.OrdinalIgnoreCase))
                    return Forbid();

                var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == uticod);
                if (user == null) return NotFound(new { Message = "User not found" });
                if (string.IsNullOrEmpty(user.UtiTwoFactorSecret))
                    return BadRequest(new { Message = "2FA not initialized." });

                // SEC — Déchiffrement du secret protégé avant vérification.
                var rawSecret = _totpProtector.Unprotect(user.UtiTwoFactorSecret);
                if (string.IsNullOrEmpty(rawSecret))
                    return BadRequest(new { Message = "2FA not initialized." });
                var secretBytes = Base32Encoding.ToBytes(rawSecret);
                var totp = new Totp(secretBytes);

                if (totp.VerifyTotp(request.Code, out _, new VerificationWindow(1, 1)))
                {
                    user.UtiTwoFactorEnabled = "1";
                    await _dbContext.SaveChangesAsync();
                    return Ok(new { Message = "2FA enabled successfully" });
                }

                return BadRequest(new { Message = "Invalid verification code" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error verifying 2FA", Error = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // A8 — Disable-2FA : toujours sur soi-même, sinon un attaquant pourrait
        // désactiver le 2FA d'un admin pour préparer une attaque par phishing.
        [Authorize]
        [HttpPost("disable-2fa/{uticod}")]
        public async Task<IActionResult> DisableTwoFactor(string uticod)
        {
            try
            {
                var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(caller)) return Unauthorized();
                if (!string.Equals(caller, uticod, StringComparison.OrdinalIgnoreCase))
                    return Forbid();

                var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == uticod);
                if (user == null) return NotFound(new { Message = "User not found" });

                user.UtiTwoFactorEnabled = "0";
                user.UtiTwoFactorSecret = null;
                await _dbContext.SaveChangesAsync();

                return Ok(new { Message = "2FA disabled successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error disabling 2FA", Error = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        [Authorize]
        [HttpPost("verify-2fa-login")]
        public async Task<IActionResult> VerifyTwoFactorLogin([FromBody] Verify2FARequest request)
        {
            try
            {
                var uticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(uticod)) return Unauthorized();

                var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == uticod);
                if (user == null) return Unauthorized();
                if (string.IsNullOrEmpty(user.UtiTwoFactorSecret))
                    return BadRequest(new { Message = "2FA not configured" });

                // SEC — Déchiffrement du secret protégé avant vérification.
                var rawSecret = _totpProtector.Unprotect(user.UtiTwoFactorSecret);
                if (string.IsNullOrEmpty(rawSecret))
                    return BadRequest(new { Message = "2FA not configured" });
                var secretBytes = Base32Encoding.ToBytes(rawSecret);
                var totp = new Totp(secretBytes);

                if (totp.VerifyTotp(request.Code, out _, new VerificationWindow(1, 1)))
                {
                    return Ok(new { Message = "2FA verified successfully" });
                }

                return BadRequest(new { Message = "Invalid verification code" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error verifying 2FA", Error = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // ── Forgot Password Endpoint ──────────────────────────────────

        // A7 — 3 demandes / 15 min / IP. Empêche la génération massive de codes reset.
        [HttpPost("forgot-password")]
        [EnableRateLimiting("auth-recovery")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Utimail))
                    return BadRequest(new { Message = "L'email est requis." });

                // PG : LOWER() des deux côtés (cf. Connect). Sans ça, un utilisateur
                // avec un email mixed-case en base ne peut pas demander de reset.
                var emailLower = request.Utimail.Trim().ToLowerInvariant();
                var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Utimail != null && u.Utimail.ToLower() == emailLower);
                if (user == null)
                    return Ok(new { Message = "Si un compte existe avec cet email, un code de réinitialisation a été généré." });

                // A15 — Code 6 chiffres généré via RandomNumberGenerator (CSPRNG).
                // System.Random est prédictible si la seed (timestamp) est devinée — un
                // attaquant peut alors prédire le code sans même recevoir le mail.
                var resetCode = System.Security.Cryptography.RandomNumberGenerator
                    .GetInt32(100000, 1000000) // upper bound exclusif → 999 999 inclus
                    .ToString();

                // Store code in user's UtiTwoFactorSecret temporarily (reuse field)
                // In production, use a separate table and send via email
                user.UtiResetCode = resetCode;
                user.UtiResetCodeExpiry = DateTime.UtcNow.AddMinutes(15);
                await _dbContext.SaveChangesAsync();

                // Le code n'est plus renvoyé dans la réponse : il est envoyé par email via /api/auth/forgot-password
                // (route publique qui résout le tenant). Cet endpoint reste pour compat mais ne doit plus être appelé.
                return Ok(new { Message = "Si un compte existe avec cet email, un code de réinitialisation a été envoyé." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Erreur lors de la demande de réinitialisation.", Error = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // SEC AI : sans rate-limit, le code de reset (6 chiffres = ~10⁶ valeurs) est brute-forçable
        // en quelques minutes pendant la fenêtre de 15 min. Aligné avec /forgot-password.
        // Bonus anti-énumération : on renvoie un message générique quand l'email est inconnu (au
        // lieu de "Utilisateur non trouvé") pour ne pas révéler la présence d'un compte.
        [HttpPost("reset-password-with-code")]
        [EnableRateLimiting("auth-recovery")]
        public async Task<IActionResult> ResetPasswordWithCode([FromBody] ResetPasswordWithCodeRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Utimail) || string.IsNullOrEmpty(request.Code) || string.IsNullOrEmpty(request.NewPassword))
                    return BadRequest(new { Message = "Tous les champs sont requis." });

                // PG : LOWER() des deux côtés (cf. Connect / ForgotPassword).
                var emailLower = request.Utimail.Trim().ToLowerInvariant();
                var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Utimail != null && u.Utimail.ToLower() == emailLower);
                if (user == null)
                    return BadRequest(new { Message = "Code invalide ou expiré." });

                if (user.UtiResetCode != request.Code || !user.UtiResetCodeExpiry.HasValue || user.UtiResetCodeExpiry < DateTime.UtcNow)
                    return BadRequest(new { Message = "Code invalide ou expiré." });

                // Vérif HIBP : refuse les mots de passe fuités. On préserve l'UX du reset
                // (code valide → 400 explicite avec count) plutôt que de laisser l'utilisateur
                // configurer "123456" via le flow forgot-password.
                var breachCount = await _passwordBreach.GetBreachCountAsync(request.NewPassword, HttpContext.RequestAborted);
                if (breachCount > 0)
                    return BadRequest(new
                    {
                        Message = $"Ce mot de passe figure dans des fuites de données publiques (vu {breachCount:N0} fois). Choisissez un mot de passe différent.",
                        code = "password_pwned",
                    });

                // Reset password
                user.Utimps = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
                user.UtiResetCode = null;
                user.UtiResetCodeExpiry = null;
                await _dbContext.SaveChangesAsync();

                return Ok(new { Message = "Mot de passe réinitialisé avec succès." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Erreur lors de la réinitialisation.", Error = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // ── Role Endpoint ──────────────────────────────────────────────

        [Authorize]
        [HttpPut("update-role/{uticod}")]
        [Admin]
        public async Task<IActionResult> UpdateRole(string uticod, [FromBody] UpdateRoleRequest request)
        {
            try
            {
                var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == uticod);
                if (user == null) return NotFound(new { Message = "User not found" });

                // RBAC : on accepte un nom de rôle exact (ex: "Administrator", "Manager", "Employee")
                // ou un alias historique ("admin"). Utiadm est dérivé du rôle final pour rester
                // synchronisé avec AdminAttribute.
                var newRoleName = (request.Role ?? string.Empty).Trim();
                if (string.Equals(newRoleName, "admin", StringComparison.OrdinalIgnoreCase))
                    newRoleName = ABRPOINT.Server.Authorization.PermissionCatalog.Roles.Administrator;

                user.Utirole = newRoleName;
                user.Utiadm = ABRPOINT.Server.Authorization.PermissionCatalog.IsAdminRole(newRoleName) ? "1" : "0";
                await _dbContext.SaveChangesAsync();

                return Ok(new { Message = "Role updated successfully", role = user.Utirole, utiadm = user.Utiadm });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error updating role", Error = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // DELETE api/<UtilisateursController>/5
        // SEC AI : sans [Authorize][Admin], n'importe qui (non authentifié) pouvait supprimer
        // n'importe quel compte utilisateur en POSTant le DTO. Reservé admin tenant.
        [HttpDelete]
        [Authorize]
        [Admin]
        public async Task<IActionResult> Delete(Utilisateur utilisateur)
        {
            if (utilisateur is null || string.IsNullOrEmpty(utilisateur.Uticod))
                return BadRequest(new { message = "Uticod requis." });
            await _utilisateurRepository.DeleteAsync(utilisateur);
            return Ok(new { success = true });
        }
        private string GenerateJwtToken(string username)
        {
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            // SEC — Le claim tenant_slug isole le JWT au tenant qui l'a émis. Le
            // middleware TenantResolverMiddleware rejette toute requête authentifiée
            // dont le slug d'URL ne matche pas ce claim → un JWT volé sur le tenant A
            // ne peut pas être rejoué sur b.concorde.com.
            var tenantSlug = _currentTenant?.Current?.Slug
                ?? throw new InvalidOperationException("Tenant context manquant lors de l'émission du JWT.");

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, username),
                new Claim(ClaimTypes.NameIdentifier, username),
                new Claim(ClaimTypes.Name, username),
                new Claim("tenant_slug", tenantSlug),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(30),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private string GenerateRefreshToken()
        {
            var randomNumber = new byte[32];
            using (var rng = System.Security.Cryptography.RandomNumberGenerator.Create())
            {
                rng.GetBytes(randomNumber);
                return Convert.ToBase64String(randomNumber);
            }
        }

        // SEC AI : token JWT distinct du token d'accès, signé avec la même clé Jwt:Key, mais
        // avec un claim "purpose=2fa-pending" + exp court (5 min). L'authentification middleware
        // ne l'accepte PAS comme bearer car notre policy défaut exige "purpose" absent (ou ne lit
        // pas ce claim) ; mais on le valide manuellement dans /complete-2fa-login.
        private string GenerateTwoFactorPendingToken(string uticod)
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var tenantSlug = _currentTenant?.Current?.Slug
                ?? throw new InvalidOperationException("Tenant context manquant lors de l'émission du JWT 2FA-pending.");
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, uticod),
                new Claim("purpose", "2fa-pending"),
                new Claim("tenant_slug", tenantSlug),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            };
            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(5),
                signingCredentials: creds);
            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private bool TryValidateTwoFactorPendingToken(string token, out string uticod)
        {
            uticod = string.Empty;
            try
            {
                var handler = new JwtSecurityTokenHandler();
                var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
                var parameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = _configuration["Jwt:Issuer"],
                    ValidateAudience = true,
                    ValidAudience = _configuration["Jwt:Audience"],
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = key,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(15),
                };
                var principal = handler.ValidateToken(token, parameters, out _);
                if (principal.FindFirst("purpose")?.Value != "2fa-pending") return false;
                var sub = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(sub)) return false;
                uticod = sub;
                return true;
            }
            catch
            {
                return false;
            }
        }
    }
}
