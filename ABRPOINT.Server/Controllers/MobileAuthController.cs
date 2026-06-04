using ABRPOINT.Server.Data;
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

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MobileAuthController : ControllerBase
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IConfiguration _configuration;
        private readonly ICurrentTenant _currentTenant;

        public MobileAuthController(ApplicationDbContext dbContext, IConfiguration configuration, ICurrentTenant currentTenant)
        {
            _dbContext = dbContext;
            _configuration = configuration;
            _currentTenant = currentTenant;
        }

        /// <summary>
        /// Mobile login endpoint that returns JWT token in response body (not cookies)
        /// </summary>
        // A7 — Rate limiting brute-force.
        // Plan gating : l'app mobile fait partie du pack Standard+. Sur Starter, on bloque
        // l'AUTH (login + biometric-login) — pas /me ni /refresh, qui doivent rester
        // accessibles pour que les sessions existantes se ferment proprement (logout
        // côté client après réception du 402, sans casser le device).
        [HttpPost("login")]
        [EnableRateLimiting("auth-login")]
        [Tenancy.RequirePlanFeature(nameof(Tenancy.PlanFeatures.MobileApp))]
        public async Task<IActionResult> Login([FromBody] MobileLoginModel model)
        {
            if (string.IsNullOrEmpty(model.Email) || string.IsNullOrEmpty(model.Password))
                return BadRequest(new { message = "Email et mot de passe sont obligatoires" });

            // Garde paiement : si le tenant a souscrit un plan payant non confirmé par Stripe,
            // on bloque la connexion mobile au même titre que le login web.
            if (_currentTenant.Current?.Status == "PendingPayment")
            {
                return StatusCode(StatusCodes.Status402PaymentRequired, new
                {
                    message = "Paiement requis. Finalisez votre abonnement avant de vous connecter.",
                    paymentRequired = true,
                });
            }

            try
            {
                // PG : LOWER() des deux côtés (cf. UtilisateursController.Connect).
                // Sur SQL Server (collation CI), 'John@x.com' matchait 'john@x.com' —
                // sur Postgres VARCHAR la comparaison est case-sensitive.
                var emailLower = model.Email.Trim().ToLowerInvariant();
                var dbUser = await _dbContext.Utilisateurs
                    .FirstOrDefaultAsync(u => u.Utimail != null && u.Utimail.ToLower() == emailLower);

                if (dbUser == null || !BCrypt.Net.BCrypt.Verify(model.Password, dbUser.Utimps))
                    return Unauthorized(new { message = "Identifiants invalides" });

                if (string.Equals(dbUser.UtiEmailVerified, "0", StringComparison.Ordinal))
                {
                    return StatusCode(StatusCodes.Status403Forbidden, new
                    {
                        message = "Vérifiez votre adresse email avant de vous connecter.",
                        code = "email_not_verified",
                        emailNotVerified = true,
                    });
                }

                // Garde "compte désactivé" centralisée dans AccountAccessGuard — couvre :
                // Utiactif != "1", Employe.Actif != "A", Empsort <= today (fin de contrat).
                // Source unique partagée avec UtilisateursController côté web.
                var loginDisableReason = await ABRPOINT.Server.Services.AccountAccessGuard.CheckAsync(_dbContext, dbUser.Uticod);
                if (ABRPOINT.Server.Services.AccountAccessGuard.IsDisabled(loginDisableReason))
                {
                    return StatusCode(StatusCodes.Status403Forbidden, new
                    {
                        message = ABRPOINT.Server.Services.AccountAccessGuard.MessageFor(loginDisableReason),
                        accountDisabled = true,
                        reason = loginDisableReason.ToString(),
                    });
                }

                var isEmp = await _dbContext.Employes.AnyAsync(e => e.Empcod == dbUser.Uticod);

                // Get user's society/site info - auto-detect if not provided
                Socuser? societe = null;
                string? soclib = null;
                string? socimg = null;

                if (!string.IsNullOrEmpty(model.Company))
                {
                    societe = await _dbContext.Socusers
                        .SingleOrDefaultAsync(s => s.Soccod == model.Company && s.Uticod == dbUser.Uticod);
                }
                else
                {
                    // Auto-detect: get first society for this user
                    societe = await _dbContext.Socusers
                        .FirstOrDefaultAsync(s => s.Uticod == dbUser.Uticod);
                }

                if (societe != null)
                {
                    soclib = await _dbContext.Societes
                        .Where(s => s.Soccod == societe.Soccod)
                        .Select(s => s.Soclib)
                        .FirstOrDefaultAsync();
                    socimg = await _dbContext.Societes
                        .Where(s => s.Soccod == societe.Soccod)
                        .Select(s => s.Socimg)
                        .FirstOrDefaultAsync();
                }

                var effectiveSoccod = societe?.Soccod ?? model.Company;
                var sitcods = await _dbContext.Socusers
                    .Where(s => s.Soccod == effectiveSoccod && s.Uticod == dbUser.Uticod)
                    .Select(s => s.Sitcod)
                    .ToListAsync();

                // Generate JWT token
                var token = GenerateJwtToken(dbUser.Uticod);
                var refreshToken = GenerateRefreshToken();

                // Save refresh token (hash SHA-256 only — cf. RefreshTokenHasher).
                var refreshTokenEntity = new RefreshToken
                {
                    Uticod = dbUser.Uticod,
                    Token = RefreshTokenHasher.Hash(refreshToken),
                    ExpiresAt = DateTime.UtcNow.AddDays(30),
                    Purpose = "Refresh",
                    LastUsedAt = DateTime.UtcNow,
                };
                await _dbContext.RefreshTokens.AddAsync(refreshTokenEntity);
                await _dbContext.SaveChangesAsync();

                // SEC-G6 : quota = 5 RT actifs max par user (Purpose=Refresh). Si on dépasse,
                // on révoque les plus anciens (sort par LastUsedAt desc puis ExpiresAt desc).
                // Les bio tokens ne sont PAS comptés dans ce quota.
                await EnforceRefreshTokenQuota(dbUser.Uticod!, "Refresh", 5);

                var utilib = $"{dbUser.Utiprn} {dbUser.Utinom}".Trim();

                return Ok(new
                {
                    token,
                    refreshToken,
                    user = new
                    {
                        uticod = dbUser.Uticod,
                        utilib,
                        utiadm = dbUser.Utiadm,
                        utiimg = dbUser.Utiimg,
                        isEmp,
                        soccod = societe?.Soccod ?? model.Company,
                        sitcod = societe?.Sitcod,
                        soclib,
                        socimg,
                        sitcods
                    }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur serveur", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        /// <summary>
        /// Refresh token for mobile
        /// </summary>
        [HttpPost("refresh")]
        public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest model)
        {
            if (string.IsNullOrEmpty(model.RefreshToken))
                return Unauthorized(new { message = "Refresh token requis" });

            var hashedIncoming = RefreshTokenHasher.Hash(model.RefreshToken);
            var refreshToken = await _dbContext.RefreshTokens
                .FirstOrDefaultAsync(rt => rt.Token == hashedIncoming && !rt.Revoked);

            if (refreshToken == null || refreshToken.ExpiresAt < DateTime.UtcNow)
                return Unauthorized(new { message = "Refresh token invalide ou expiré" });

            var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == refreshToken.Uticod);
            if (user == null)
                return Unauthorized(new { message = "Utilisateur non trouvé" });

            // Si le compte a été désactivé / le contrat expiré entre-temps, on révoque le
            // refresh token et on refuse — l'app mobile devra repasser par un login complet
            // (qui sera lui-même refusé). Garde centralisée AccountAccessGuard.
            var refreshDisableReason = await ABRPOINT.Server.Services.AccountAccessGuard.CheckAsync(_dbContext, user.Uticod);
            if (ABRPOINT.Server.Services.AccountAccessGuard.IsDisabled(refreshDisableReason))
            {
                refreshToken.Revoked = true;
                await _dbContext.SaveChangesAsync();
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    message = ABRPOINT.Server.Services.AccountAccessGuard.MessageFor(refreshDisableReason),
                    accountDisabled = true,
                    reason = refreshDisableReason.ToString(),
                });
            }

            var newToken = GenerateJwtToken(user.Uticod);
            var newRefreshToken = GenerateRefreshToken();

            refreshToken.Revoked = true;
            refreshToken.LastUsedAt = DateTime.UtcNow;

            var newRefreshTokenEntity = new RefreshToken
            {
                Uticod = user.Uticod,
                Token = RefreshTokenHasher.Hash(newRefreshToken),
                ExpiresAt = DateTime.UtcNow.AddDays(30),
                Purpose = "Refresh",
                LastUsedAt = DateTime.UtcNow,
            };
            _dbContext.RefreshTokens.Add(newRefreshTokenEntity);
            await _dbContext.SaveChangesAsync();

            await EnforceRefreshTokenQuota(user.Uticod!, "Refresh", 5);

            return Ok(new
            {
                token = newToken,
                refreshToken = newRefreshToken
            });
        }

        /// <summary>
        /// Get current user info for mobile
        /// </summary>
        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> GetCurrentUser()
        {
            var uticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uticod))
                return Unauthorized();

            var user = await _dbContext.Utilisateurs
                .Where(u => u.Uticod == uticod)
                .Select(u => new { u.Uticod, u.Utiadm, u.Utiprn, u.Utinom, u.Utiimg, u.Utimail })
                .FirstOrDefaultAsync();

            if (user == null)
                return Unauthorized();

            var isEmp = await _dbContext.Employes.AnyAsync(e => e.Empcod == uticod);
            var utilib = $"{user.Utiprn} {user.Utinom}".Trim();

            // Get society/site info
            string? soccod = null;
            string? sitcod = null;
            string? soclib = null;
            string? socimg = null;

            if (isEmp)
            {
                var emp = await _dbContext.Employes
                    .Where(e => e.Empcod == uticod)
                    .Select(e => new { e.Soccod, e.Sitcod })
                    .FirstOrDefaultAsync();
                soccod = emp?.Soccod;
                sitcod = emp?.Sitcod;
            }
            else
            {
                var socuser = await _dbContext.Socusers
                    .Where(s => s.Uticod == uticod)
                    .FirstOrDefaultAsync();
                soccod = socuser?.Soccod;
                sitcod = socuser?.Sitcod;
            }

            if (!string.IsNullOrEmpty(soccod))
            {
                soclib = await _dbContext.Societes
                    .Where(s => s.Soccod == soccod)
                    .Select(s => s.Soclib)
                    .FirstOrDefaultAsync();
                socimg = await _dbContext.Societes
                    .Where(s => s.Soccod == soccod)
                    .Select(s => s.Socimg)
                    .FirstOrDefaultAsync();
            }

            var sitcods = await _dbContext.Socusers
                .Where(s => s.Uticod == uticod && s.Soccod == soccod)
                .Select(s => s.Sitcod)
                .ToListAsync();

            // Get employee info if applicable
            object? empInfo = null;
            if (isEmp)
            {
                var empFull = await _dbContext.Employes
                    .Where(e => e.Empcod == uticod)
                    .Select(e => new { e.Soccod, e.Sitcod, e.Emplib, e.Empmat, e.Empsexe, e.Empemail })
                    .FirstOrDefaultAsync();
                empInfo = empFull;
            }

            // Get user's service code (for manager filtering)
            string? sercod = null;
            string? utirole = user.Utiadm == "1" ? "admin" : null;
            if (isEmp)
            {
                var empSercod = await _dbContext.Employes
                    .Where(e => e.Empcod == uticod)
                    .Select(e => new { e.Sercod, e.Dircod })
                    .FirstOrDefaultAsync();
                sercod = empSercod?.Sercod;
            }
            if (string.IsNullOrEmpty(utirole))
            {
                // Check if user has a role defined in utilisateur table
                var fullUser = await _dbContext.Utilisateurs.AsNoTracking().FirstOrDefaultAsync(u => u.Uticod == uticod);
                if (!string.IsNullOrEmpty(fullUser?.Utirole))
                    utirole = fullUser.Utirole;
            }

            // Plan info (consommé par le mobile pour activer/désactiver la sécurité renforcée :
            // device trust, screenshot protection — cf. abrpoint.mobile/src/contexts/AuthContext).
            // 2026-05-12 : en essai, le mobile voit les features du plan sélectionné — pas
            // de Premium-pour-tous (cohérent avec la web app).
            var tenant = _currentTenant?.Current;
            var planCode = Tenancy.PlanCatalog.Normalize(tenant?.PlanCode);
            // Features EFFECTIVES = plan de base + add-ons. Cohérent avec la web /me et
            // avec l'attribut [RequirePlanFeature] (qui renvoie 402 sur la même base).
            // ⚠ Avant : on lisait planDef.Features (plan de base SEUL → add-ons ignorés)
            // et on ne sérialisait que ~18 des 27 flags → les flags manquants arrivaient
            // `undefined` côté mobile → Boolean(undefined)=false → fonctionnalités masquées
            // pour TOUS les plans (ex. Notes de frais). On renvoie désormais le record
            // complet (tous les flags, camelCase) ; GetEffectiveFeatures ne renvoie jamais
            // null (repli Starter), donc le mobile applique le bon niveau même en legacy.
            var effectiveFeatures = Tenancy.PlanCatalog.GetEffectiveFeatures(planCode, tenant?.Addons);

            return Ok(new
            {
                uticod = user.Uticod,
                utilib,
                utiadm = user.Utiadm,
                utirole,
                sercod,
                utiimg = user.Utiimg,
                utimail = user.Utimail,
                isEmp,
                empInfo,
                soccod,
                sitcod,
                soclib,
                socimg,
                sitcods,
                planCode,
                planFeatures = effectiveFeatures,
            });
        }

        [Authorize]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest? model)
        {
            var userUticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (!string.IsNullOrEmpty(userUticod))
            {
                // SEC-G2 : on révoque UNIQUEMENT les RT de Purpose=Refresh.
                // Les bio tokens (Purpose=Biometric) survivent au logout pour que la
                // reconnexion via Face ID/Touch ID reste possible. Pour révoquer la
                // biométrie, l'utilisateur passe par /biometric-disable explicitement.
                var tokens = await _dbContext.RefreshTokens
                    .Where(rt => rt.Uticod == userUticod && !rt.Revoked && rt.Purpose == "Refresh")
                    .ToListAsync();

                foreach (var token in tokens)
                {
                    token.Revoked = true;
                }
                await _dbContext.SaveChangesAsync();
            }

            return Ok(new { message = "Déconnexion réussie" });
        }

        // ─────────────────────────────────────────────────────────────────────────
        // SEC-G2 — Authentification biométrique sans stocker email+password.
        //
        // Ancienne approche (toujours présente côté SecureStore mobile pour compat
        // avec les anciennes installations) : on stockait email+password en clair
        // dans le Keychain/Keystore. Sur device rooté/jailbreaké, ces credentials
        // étaient extractibles → vol de compte définitif.
        //
        // Nouvelle approche : on émet un BIO-TOKEN dédié, lié au device, expirant
        // à 90 jours, qui ne donne accès qu'à la fonction biometric-login. Si le
        // device est compromis et le bio-token volé, l'attaquant peut accéder au
        // compte mais l'utilisateur peut le révoquer depuis n'importe quel autre
        // device via /biometric-disable, sans changer son mot de passe.
        //
        // Le bio-token est rotaté à chaque utilisation (rolling token).
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Active la biométrie pour le device courant. À appeler depuis l'app mobile
        /// quand l'utilisateur active le toggle "Connexion biométrique" — l'utilisateur
        /// est déjà authentifié avec son JWT à ce moment-là.
        /// </summary>
        [Authorize]
        [HttpPost("biometric-enable")]
        public async Task<IActionResult> BiometricEnable()
        {
            var uticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uticod)) return Unauthorized();

            // On révoque les éventuels bio tokens existants pour ce user (un seul device
            // biométrique actif à la fois — si l'utilisateur change de téléphone, l'ancien
            // est invalidé). Pour multi-device, supprimer ce bloc.
            var existing = await _dbContext.RefreshTokens
                .Where(rt => rt.Uticod == uticod && rt.Purpose == "Biometric" && !rt.Revoked)
                .ToListAsync();
            foreach (var t in existing) t.Revoked = true;

            var bioToken = GenerateRefreshToken();
            _dbContext.RefreshTokens.Add(new RefreshToken
            {
                Uticod = uticod,
                Token = RefreshTokenHasher.Hash(bioToken),
                ExpiresAt = DateTime.UtcNow.AddDays(90),
                Purpose = "Biometric",
                LastUsedAt = DateTime.UtcNow,
            });
            await _dbContext.SaveChangesAsync();

            return Ok(new { bioToken, expiresInDays = 90 });
        }

        /// <summary>
        /// Connexion via bio-token : remplace le couple email+password pour le re-login
        /// biométrique. Le bio-token est rotaté à chaque appel pour éviter le replay.
        /// </summary>
        [HttpPost("biometric-login")]
        [EnableRateLimiting("auth-login")]
        [Tenancy.RequirePlanFeature(nameof(Tenancy.PlanFeatures.MobileApp))]
        public async Task<IActionResult> BiometricLogin([FromBody] RefreshTokenRequest model)
        {
            if (string.IsNullOrEmpty(model.RefreshToken))
                return Unauthorized(new { message = "Bio-token requis" });

            var hashedBio = RefreshTokenHasher.Hash(model.RefreshToken);
            var bio = await _dbContext.RefreshTokens
                .FirstOrDefaultAsync(rt => rt.Token == hashedBio && !rt.Revoked && rt.Purpose == "Biometric");

            if (bio == null || bio.ExpiresAt < DateTime.UtcNow)
                return Unauthorized(new { message = "Session biométrique expirée — reconnectez-vous avec votre mot de passe." });

            var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == bio.Uticod);
            if (user == null)
                return Unauthorized();

            if (string.Equals(user.UtiEmailVerified, "0", StringComparison.Ordinal))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    message = "Vérifiez votre adresse email avant de vous connecter.",
                    code = "email_not_verified",
                    emailNotVerified = true,
                });
            }

            // Garde compte désactivé centralisée (cf. login + refresh).
            var bioDisableReason = await ABRPOINT.Server.Services.AccountAccessGuard.CheckAsync(_dbContext, user.Uticod);
            if (ABRPOINT.Server.Services.AccountAccessGuard.IsDisabled(bioDisableReason))
            {
                bio.Revoked = true;
                await _dbContext.SaveChangesAsync();
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    message = ABRPOINT.Server.Services.AccountAccessGuard.MessageFor(bioDisableReason),
                    accountDisabled = true,
                    reason = bioDisableReason.ToString(),
                });
            }

            // Rotation : on révoque le bio token utilisé et on en crée un nouveau (rolling).
            bio.Revoked = true;
            var newBioToken = GenerateRefreshToken();
            _dbContext.RefreshTokens.Add(new RefreshToken
            {
                Uticod = user.Uticod,
                Token = RefreshTokenHasher.Hash(newBioToken),
                ExpiresAt = DateTime.UtcNow.AddDays(90),
                Purpose = "Biometric",
                LastUsedAt = DateTime.UtcNow,
            });

            // Émet aussi un access token + refresh token classique pour la session
            var accessToken = GenerateJwtToken(user.Uticod!);
            var refreshToken = GenerateRefreshToken();
            _dbContext.RefreshTokens.Add(new RefreshToken
            {
                Uticod = user.Uticod,
                Token = RefreshTokenHasher.Hash(refreshToken),
                ExpiresAt = DateTime.UtcNow.AddDays(30),
                Purpose = "Refresh",
                LastUsedAt = DateTime.UtcNow,
            });
            await _dbContext.SaveChangesAsync();

            await EnforceRefreshTokenQuota(user.Uticod!, "Refresh", 5);

            return Ok(new
            {
                token = accessToken,
                refreshToken,
                bioToken = newBioToken,
            });
        }

        /// <summary>
        /// Désactive la biométrie pour le user (révoque tous les bio tokens, tous devices
        /// confondus). Appelé depuis le toggle "Connexion biométrique" off ou depuis le
        /// portail web quand l'utilisateur perd son téléphone.
        /// </summary>
        [Authorize]
        [HttpPost("biometric-disable")]
        public async Task<IActionResult> BiometricDisable()
        {
            var uticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uticod)) return Unauthorized();

            var bios = await _dbContext.RefreshTokens
                .Where(rt => rt.Uticod == uticod && rt.Purpose == "Biometric" && !rt.Revoked)
                .ToListAsync();
            foreach (var b in bios) b.Revoked = true;
            await _dbContext.SaveChangesAsync();

            return Ok(new { revoked = bios.Count });
        }

        /// <summary>
        /// SEC-G6 — Limite le nombre de RT actifs par user à `maxKeep`. Révoque les plus
        /// anciens (par LastUsedAt puis ExpiresAt) au-delà de cette limite.
        /// Empêche un attaquant qui obtient un RT de garder une session indéfiniment :
        /// au bout de 5 logins ailleurs, son RT est révoqué automatiquement.
        /// </summary>
        private async Task EnforceRefreshTokenQuota(string uticod, string purpose, int maxKeep)
        {
            var actifs = await _dbContext.RefreshTokens
                .Where(rt => rt.Uticod == uticod
                          && rt.Purpose == purpose
                          && !rt.Revoked
                          && rt.ExpiresAt > DateTime.UtcNow)
                .OrderByDescending(rt => rt.LastUsedAt ?? rt.ExpiresAt)
                .ToListAsync();

            if (actifs.Count <= maxKeep) return;

            foreach (var trop in actifs.Skip(maxKeep))
            {
                trop.Revoked = true;
            }
            await _dbContext.SaveChangesAsync();
        }

        /// <summary>
        /// Enregistre / met à jour un token Expo Push pour le device courant.
        /// Idempotent : upsert sur (uticod, device_id) ou sur le token lui-même.
        /// Appelé par le mobile après l'autorisation système des notifications.
        /// </summary>
        [Authorize]
        [HttpPost("register-push-token")]
        public async Task<IActionResult> RegisterPushToken([FromBody] RegisterPushTokenRequest req, CancellationToken ct)
        {
            if (req == null || string.IsNullOrWhiteSpace(req.Token))
                return BadRequest(new { message = "token requis" });

            var uticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uticod)) return Unauthorized();

            // Soccod par claim si présent (cohérence multi-tenant), sinon on prend ce que le client envoie.
            var soccod = req.Soccod ?? User.FindFirst("soccod")?.Value;

            // Upsert : si même token déjà présent (peut-être pour un autre user), on le réassigne.
            var existing = await _dbContext.PushTokens
                .FirstOrDefaultAsync(t => t.Token == req.Token, ct);

            if (existing != null)
            {
                existing.Uticod = uticod;
                existing.Soccod = soccod;
                existing.Platform = req.Platform ?? existing.Platform;
                existing.DeviceId = req.DeviceId ?? existing.DeviceId;
                existing.LastSeenAt = DateTime.UtcNow;
                existing.Active = true;
            }
            else
            {
                _dbContext.PushTokens.Add(new PushToken
                {
                    Uticod = uticod,
                    Soccod = soccod,
                    Token = req.Token,
                    Platform = req.Platform,
                    DeviceId = req.DeviceId,
                });
            }
            await _dbContext.SaveChangesAsync(ct);
            return Ok(new { registered = true });
        }

        /// <summary>
        /// SEC-G3 — Reçoit le rapport de confiance du device produit par
        /// `deviceSecurity.assessDeviceTrust()` côté mobile. Journalise dans
        /// l'AuditLog (RGPD : aucune donnée plus précise que le niveau et la
        /// liste des reasons — pas d'identifiant unique d'appareil).
        ///
        /// Utile pour :
        ///   - Détecter en amont un user dont les devices sont systématiquement
        ///     `low` (vol de compte sur appareil compromis).
        ///   - Statistiques tenant : combien d'employés sur émulateur/jailbreak.
        ///   - Trigger d'enquête sur niveau `low` + accès à une fonction sensible.
        ///
        /// L'endpoint accepte aussi des reports non authentifiés (au tout
        /// premier lancement, avant login) — dans ce cas Uticod est null.
        /// </summary>
        [HttpPost("device-trust-report")]
        public async Task<IActionResult> ReportDeviceTrust([FromBody] DeviceTrustReportDto report, CancellationToken ct)
        {
            if (report is null) return BadRequest();

            // Borne la taille pour éviter qu'un client malveillant ne loggue
            // des Mo de "reasons". On garde les 5 premières raisons max et on
            // tronque chaque libellé à 30 chars (slug-like).
            var reasons = (report.Reasons ?? Array.Empty<string>())
                .Take(5)
                .Select(r => (r ?? string.Empty).Trim().Substring(0, Math.Min(30, (r ?? string.Empty).Length)))
                .Where(r => r.Length > 0)
                .ToList();

            var level = (report.Level ?? "unknown").ToLowerInvariant();
            if (level is not ("high" or "medium" or "low" or "unknown"))
                level = "unknown";

            var uticod = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var actionLabel = $"TrustReport:level={level};reasons={string.Join(",", reasons)}";
            // Cap à 100 chars (contrainte StringLength de la colonne Action).
            if (actionLabel.Length > 100) actionLabel = actionLabel.Substring(0, 100);

            var xff = HttpContext.Request.Headers["X-Forwarded-For"].ToString();
            var clientIp = !string.IsNullOrWhiteSpace(xff)
                ? xff.Split(',')[0].Trim()
                : HttpContext.Connection.RemoteIpAddress?.ToString();
            if (clientIp != null && clientIp.Length > 45) clientIp = clientIp.Substring(0, 45);

            _dbContext.AuditLogs.Add(new Models.AuditLog
            {
                Uticod = uticod,
                Action = actionLabel,
                TableName = "device_trust",
                DateAction = DateTime.UtcNow,
                IpAddress = clientIp,
            });
            try { await _dbContext.SaveChangesAsync(ct); }
            catch { /* journalisation best-effort, jamais bloquante */ }

            return Ok(new { received = true });
        }

        public sealed class DeviceTrustReportDto
        {
            public string? Level { get; set; }
            public bool? IsPhysicalDevice { get; set; }
            public bool? IsEmulator { get; set; }
            public string[]? Reasons { get; set; }
            public string? Platform { get; set; }
        }

        private string GenerateJwtToken(string username)
        {
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            // SEC — Claim tenant_slug obligatoire pour isoler le JWT à son tenant
            // d'émission. Empêche le rejouage cross-tenant via X-Tenant-Slug.
            var tenantSlug = _currentTenant?.Current?.Slug
                ?? throw new InvalidOperationException("Tenant context manquant lors de l'émission du JWT mobile.");

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
                expires: DateTime.UtcNow.AddDays(30),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private string GenerateRefreshToken()
        {
            var randomNumber = new byte[32];
            using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
            rng.GetBytes(randomNumber);
            return Convert.ToBase64String(randomNumber);
        }
    }

    public class MobileLoginModel
    {
        public string Email { get; set; } = "";
        public string Password { get; set; } = "";
        public string? Company { get; set; }
    }

    public class RefreshTokenRequest
    {
        public string? RefreshToken { get; set; }
    }

    public class RegisterPushTokenRequest
    {
        public string Token { get; set; } = string.Empty;
        public string? Platform { get; set; }
        public string? DeviceId { get; set; }
        public string? Soccod { get; set; }
    }
}