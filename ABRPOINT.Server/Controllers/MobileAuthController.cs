using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
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
                var dbUser = await _dbContext.Utilisateurs
                    .FirstOrDefaultAsync(u => u.Utimail == model.Email);

                if (dbUser == null || !BCrypt.Net.BCrypt.Verify(model.Password, dbUser.Utimps))
                    return Unauthorized(new { message = "Identifiants invalides" });

                // Garde "compte désactivé" : Utilisateur.Utiactif="0" OU Employe.Actif="N" → connexion refusée.
                // Mêmes règles que le login web (UtilisateursController.Connect) — sans ça un employé
                // sortant pourrait continuer à s'authentifier depuis l'app mobile après désactivation web.
                if (dbUser.Utiactif != "1" ||
                    await _dbContext.Employes.AnyAsync(e => e.Empcod == dbUser.Uticod && e.Actif != null && e.Actif != "A"))
                {
                    return StatusCode(StatusCodes.Status403Forbidden, new
                    {
                        message = "Compte désactivé. Contactez votre administrateur pour réactiver l'accès.",
                        accountDisabled = true,
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

                // Save refresh token
                var refreshTokenEntity = new RefreshToken
                {
                    Uticod = dbUser.Uticod,
                    Token = refreshToken,
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
                return StatusCode(500, new { message = "Erreur serveur", details = ex.Message });
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

            var refreshToken = await _dbContext.RefreshTokens
                .FirstOrDefaultAsync(rt => rt.Token == model.RefreshToken && !rt.Revoked);

            if (refreshToken == null || refreshToken.ExpiresAt < DateTime.UtcNow)
                return Unauthorized(new { message = "Refresh token invalide ou expiré" });

            var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == refreshToken.Uticod);
            if (user == null)
                return Unauthorized(new { message = "Utilisateur non trouvé" });

            // Si le compte a été désactivé entre-temps (Utiactif="0" ou employé sortant Actif="N"),
            // on révoque le refresh token et on refuse — l'app mobile devra repasser par un login.
            if (user.Utiactif != "1" ||
                await _dbContext.Employes.AnyAsync(e => e.Empcod == user.Uticod && e.Actif != null && e.Actif != "A"))
            {
                refreshToken.Revoked = true;
                await _dbContext.SaveChangesAsync();
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    message = "Compte désactivé. Contactez votre administrateur pour réactiver l'accès.",
                    accountDisabled = true,
                });
            }

            var newToken = GenerateJwtToken(user.Uticod);
            var newRefreshToken = GenerateRefreshToken();

            refreshToken.Revoked = true;
            refreshToken.LastUsedAt = DateTime.UtcNow;

            var newRefreshTokenEntity = new RefreshToken
            {
                Uticod = user.Uticod,
                Token = newRefreshToken,
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
            // Pendant l'essai, on accorde toutes les features pour que l'utilisateur teste tout.
            var tenant = _currentTenant?.Current;
            var isTrialing = Tenancy.TrialPolicy.IsTrialing(tenant);
            var planCode = Tenancy.PlanCatalog.Normalize(tenant?.PlanCode);
            var planDef = Tenancy.PlanCatalog.GetPlan(planCode);
            var effectiveFeatures = isTrialing && planDef is not null
                ? new Tenancy.PlanFeatures(true, true, true, true, true, true, true, true, true, true, true, true, true,
                                           true, true, true, true, true, true)
                : planDef?.Features;

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
                planFeatures = effectiveFeatures is null ? null : new
                {
                    mobileApp = effectiveFeatures.MobileApp,
                    geolocation = effectiveFeatures.Geolocation,
                    digitalVault = effectiveFeatures.DigitalVault,
                    electronicSignature = effectiveFeatures.ElectronicSignature,
                    multiSite = effectiveFeatures.MultiSite,
                    multiSociete = effectiveFeatures.MultiSociete,
                    advancedDashboards = effectiveFeatures.AdvancedDashboards,
                    ragAi = effectiveFeatures.RagAi,
                    advancedAuditLogs = effectiveFeatures.AdvancedAuditLogs,
                    customBranding = effectiveFeatures.CustomBranding,
                    deviceTrustEnforced = effectiveFeatures.DeviceTrustEnforced,
                    screenshotProtection = effectiveFeatures.ScreenshotProtection,
                    certificatePinning = effectiveFeatures.CertificatePinning,
                    missions = effectiveFeatures.Missions,
                    compensationDays = effectiveFeatures.CompensationDays,
                    generalLeave = effectiveFeatures.GeneralLeave,
                    generalExit = effectiveFeatures.GeneralExit,
                    leaveManagement = effectiveFeatures.LeaveManagement,
                    authorizationManagement = effectiveFeatures.AuthorizationManagement,
                }
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
                Token = bioToken,
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

            var bio = await _dbContext.RefreshTokens
                .FirstOrDefaultAsync(rt => rt.Token == model.RefreshToken && !rt.Revoked && rt.Purpose == "Biometric");

            if (bio == null || bio.ExpiresAt < DateTime.UtcNow)
                return Unauthorized(new { message = "Session biométrique expirée — reconnectez-vous avec votre mot de passe." });

            var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == bio.Uticod);
            if (user == null)
                return Unauthorized();

            // Garde compte désactivé (cf. login)
            if (user.Utiactif != "1" ||
                await _dbContext.Employes.AnyAsync(e => e.Empcod == user.Uticod && e.Actif != null && e.Actif != "A"))
            {
                bio.Revoked = true;
                await _dbContext.SaveChangesAsync();
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    message = "Compte désactivé. Contactez votre administrateur.",
                    accountDisabled = true,
                });
            }

            // Rotation : on révoque le bio token utilisé et on en crée un nouveau (rolling).
            bio.Revoked = true;
            var newBioToken = GenerateRefreshToken();
            _dbContext.RefreshTokens.Add(new RefreshToken
            {
                Uticod = user.Uticod,
                Token = newBioToken,
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
                Token = refreshToken,
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

        private string GenerateJwtToken(string username)
        {
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, username),
                new Claim(ClaimTypes.NameIdentifier, username),
                new Claim(ClaimTypes.Name, username),
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