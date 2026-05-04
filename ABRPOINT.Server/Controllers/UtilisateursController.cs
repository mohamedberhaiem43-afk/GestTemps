using ABRPOINT.Server.Annotations.AdminAttributes;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
        public UtilisateursController(
            IConfiguration configuration,
            ApplicationDbContext dbContext,
            IUtilisateurRepository utilisateurRepository,
            ICurrentTenant currentTenant,
            EncryptionService encryptionService)
        {
            _configuration = configuration;
            _dbContext = dbContext;
            _utilisateurRepository = utilisateurRepository;
            _currentTenant = currentTenant;
            _encryptionService = encryptionService;
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
        public async Task<IActionResult> GetAllUtilisateurs()
        {
            try
            {
                var users = await _dbContext.Utilisateurs
                    .Select(u => new {
                        u.Uticod,
                        u.Utinom,
                        u.Utiprn,
                        u.Utimail,
                        u.Utiactif,
                        u.Utiadm,
                        u.Utirole,
                        uti2fa_enabled = u.UtiTwoFactorEnabled,
                        u.Utiimg
                    })
                    .ToListAsync();
                return Ok(users);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error fetching users", Error = ex.Message });
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

        [Authorize]
        [HttpPost("add-user/{soccod}/{sitcod}")]
        public async Task<IActionResult> AddUtilisateur([FromBody] Utilisateur utilisateur,string sitcod,string soccod)
        {
            try
            {
                
                Socuser socuser = new Socuser();
                socuser.Uticod = utilisateur.Uticod;
                socuser.Soccod = soccod;
                socuser.Sitcod = sitcod;
                await _utilisateurRepository.AddAsync(utilisateur,socuser);
                return  Ok(utilisateur);
            }
            catch (Exception ex)
            {
                return StatusCode(500,"probleme d'ajout utilisateur "+ex);
            }
        }
        // POST api/<UtilisateursController>
        [HttpPost("connect")]
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

                Utilisateur? dbUser = await _dbContext.Utilisateurs
                    .FirstOrDefaultAsync(u => u.Utimail == user.Utimail);

                if (dbUser == null || !BCrypt.Net.BCrypt.Verify(user.Utimps, dbUser.Utimps))
                {
                    return Unauthorized("Invalid credentials.");
                }

                // Garde "compte désactivé" : Utilisateur.Utiactif="0" OU Employe.Actif="N" → connexion refusée.
                // On vérifie les deux car la désactivation peut venir soit du toggle utilisateur,
                // soit de la fiche employé (champ `actif` mis à "N" lors d'une sortie/licenciement),
                // et les deux flags ne sont pas synchronisés automatiquement.
                if (await IsAccountDisabledAsync(dbUser))
                {
                    return StatusCode(StatusCodes.Status403Forbidden, new
                    {
                        message = "Compte désactivé. Contactez votre administrateur pour réactiver l'accès.",
                        accountDisabled = true,
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
                    return Ok(new { requires2fa = true, uticod = dbUser.Uticod, societe, societe.Sitcod, isManager });
                }
                return await CompleteLoginSequence(dbUser, resolvedCompany, societe);
            }
            catch (Exception)
            {
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        /// <summary>
        /// Vrai si l'utilisateur est désactivé : `Utilisateur.Utiactif != "1"` OU, s'il est
        /// aussi salarié, `Employe.Actif != "A"`. Les deux flags peuvent être désynchronisés
        /// (la désactivation peut venir du toggle utilisateur ou de la fiche employé), donc on
        /// consulte les deux pour bloquer toute tentative de connexion d'un compte inactif.
        /// </summary>
        private async Task<bool> IsAccountDisabledAsync(Utilisateur dbUser)
        {
            if (dbUser.Utiactif != "1") return true;

            // L'employé partage son Uticod avec son matricule (Empcod). On regarde toutes les
            // fiches portant ce code : si une seule existe et est marquée "N", on bloque.
            // (En pratique il y en a au plus une, mais on évite SingleOrDefault pour ne pas
            // jeter sur une donnée corrompue.)
            var hasInactiveEmploye = await _dbContext.Employes
                .AnyAsync(e => e.Empcod == dbUser.Uticod && e.Actif != null && e.Actif != "A");
            return hasInactiveEmploye;
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

        [HttpPost("complete-2fa-login")]
        public async Task<IActionResult> Complete2FALogin([FromBody] Complete2FARequest request)
        {
            try
            {
                var dbUser = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == request.Uticod);
                if (dbUser == null) return Unauthorized("Invalid user.");
                if (dbUser.UtiTwoFactorEnabled != "1" || string.IsNullOrEmpty(dbUser.UtiTwoFactorSecret))
                    return BadRequest("2FA not enabled for user.");

                var secretBytes = Base32Encoding.ToBytes(dbUser.UtiTwoFactorSecret);
                var totp = new Totp(secretBytes);
                if (!totp.VerifyTotp(request.Code, out _, new VerificationWindow(1, 1)))
                {
                    return BadRequest("Code invalide");
                }

                // Réplique la garde de Connect : impossible de contourner la désactivation
                // en passant directement par /complete-2fa-login.
                if (await IsAccountDisabledAsync(dbUser))
                {
                    return StatusCode(StatusCodes.Status403Forbidden, new
                    {
                        message = "Compte désactivé. Contactez votre administrateur pour réactiver l'accès.",
                        accountDisabled = true,
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
                    Token = refreshToken,
                    ExpiresAt = DateTime.UtcNow.AddDays(7)
                };
                await _dbContext.RefreshTokens.AddAsync(refreshTokenEntity);
                await _dbContext.SaveChangesAsync();

                Response.Cookies.Append("accessToken", accessToken, CreateCookieOptions(DateTimeOffset.UtcNow.AddMinutes(30)));
                Response.Cookies.Append("refreshToken", refreshToken, CreateCookieOptions(DateTimeOffset.UtcNow.AddDays(7)));
                Response.Cookies.Append("uticod", dbUser.Uticod ?? string.Empty, CreateCookieOptions(DateTimeOffset.UtcNow.AddDays(7)));
                Response.Cookies.Append("admin", dbUser.Utiadm ?? "0", CreateCookieOptions(DateTimeOffset.UtcNow.AddDays(7), httpOnly: false));

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

                var refreshToken = await _dbContext.RefreshTokens
                    .FirstOrDefaultAsync(rt => rt.Token == refreshTokenValue && !rt.Revoked);

                if (refreshToken == null || refreshToken.ExpiresAt < DateTime.UtcNow)
                {
                    return Unauthorized(new { message = "Invalid or expired refresh token" });
                }

                var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == refreshToken.Uticod);
                if (user == null)
                {
                    return Unauthorized(new { message = "User not found" });
                }

                var newAccessToken = GenerateJwtToken(user.Uticod);
                var newRefreshToken = GenerateRefreshToken();

                // Revoke old refresh token
                refreshToken.Revoked = true;

                // Save new refresh token
                var newRefreshTokenEntity = new RefreshToken
                {
                    Uticod = user.Uticod,
                    Token = newRefreshToken,
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
                return StatusCode(500, new { message = "An error occurred while refreshing token", error = ex.Message });
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
                return StatusCode(500, new { Message = "Erreur interne lors de la suppression.", Details = ex.Message });
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
                return StatusCode(500, new { Message = "Erreur lors de la réinitialisation.", Details = ex.Message });
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
                return StatusCode(500, new { Message = "Erreur lors de la mise à jour du statut.", Details = ex.Message });
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

            return Ok(new
            {
                uticod = user.Uticod,
                utiadm = user.Utiadm,
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
                planCode = tenant?.PlanCode,
                isTrialing,
                trialEndsAt = tenant?.TrialEndsAt,
                trialDaysRemaining,
                planLimits = new
                {
                    maxEmployees = limits.MaxEmployees,
                    maxSocietes = limits.MaxSocietes,
                    maxSites = limits.MaxSites,
                },
                permissions = user.Role?.Permissions ?? new List<RolePermission>()
            });
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
                Response.Cookies.Delete("admin", CreateDeleteCookieOptions(httpOnly: false));

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
        [HttpPut("update-profile")]
        public async Task<bool> UpdateProfile([FromBody] UtilisateurUpdate utilisateur)
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

        [HttpPost("upload-profile")]
        public async Task<IActionResult> UploadProfileImage(IFormFile file, [FromQuery] string uticod)
        {
            var (success, filePath, error) = await FileHelper.SaveFile(file);
            if (!success) return BadRequest(error);
            // Save filePath to the user's record in DB
            await _utilisateurRepository.UpdateProfileImageAsync(uticod, filePath);

            return Ok(new { filePath });
        }


        [HttpGet("get-profile/{soccod}/{uticod}")]
        public async Task<UtiProfile> GetProfile(string soccod,string uticod)
        {
            try
            {
                UtiProfile profile = await _utilisateurRepository.GetProfileAsync(soccod,uticod);

                // Empcin / Emptel / Empsbase / Empsbrut / Empsnet sont stockés chiffrés AES en base
                // (cf. EmployesController.cs:353-357 où la même règle est appliquée à GET /Employes).
                // Sans déchiffrement ici, le mobile affichait du base64 illisible dans la fiche profil
                // (« CIN », « Téléphone fixe »). On déchiffre côté serveur pour garder la clé hors du client.
                if (profile?.Employee != null)
                {
                    profile.Employee.Empcin = _encryptionService.Decrypt(profile.Employee.Empcin);
                    profile.Employee.Emptel = _encryptionService.Decrypt(profile.Employee.Emptel);
                }

                return profile;
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpPut("change-password")]
        public async Task<bool> ChangePassword(UpdatePassword pwd)
        {
            try
            {
                bool profile = await _utilisateurRepository.ChangePasswordAsync(pwd);
                return profile;
            }
            catch (Exception)
            {
                throw;
            }
        }

        // ── 2FA Endpoints ──────────────────────────────────────────────

        [Authorize]
        [HttpPost("enable-2fa/{uticod}")]
        public async Task<IActionResult> EnableTwoFactor(string uticod)
        {
            try
            {
                var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == uticod);
                if (user == null) return NotFound(new { Message = "User not found" });

                var secretKey = KeyGeneration.GenerateRandomKey(20);
                var base32Secret = Base32Encoding.ToString(secretKey);

                user.UtiTwoFactorSecret = base32Secret;
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
                return StatusCode(500, new { Message = "Error enabling 2FA", Error = ex.Message });
            }
        }

        [Authorize]
        [HttpPost("verify-2fa/{uticod}")]
        public async Task<IActionResult> VerifyTwoFactor(string uticod, [FromBody] Verify2FARequest request)
        {
            try
            {
                var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == uticod);
                if (user == null) return NotFound(new { Message = "User not found" });
                if (string.IsNullOrEmpty(user.UtiTwoFactorSecret))
                    return BadRequest(new { Message = "2FA not initialized." });

                var secretBytes = Base32Encoding.ToBytes(user.UtiTwoFactorSecret);
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
                return StatusCode(500, new { Message = "Error verifying 2FA", Error = ex.Message });
            }
        }

        [Authorize]
        [HttpPost("disable-2fa/{uticod}")]
        public async Task<IActionResult> DisableTwoFactor(string uticod)
        {
            try
            {
                var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == uticod);
                if (user == null) return NotFound(new { Message = "User not found" });

                user.UtiTwoFactorEnabled = "0";
                user.UtiTwoFactorSecret = null;
                await _dbContext.SaveChangesAsync();

                return Ok(new { Message = "2FA disabled successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error disabling 2FA", Error = ex.Message });
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

                var secretBytes = Base32Encoding.ToBytes(user.UtiTwoFactorSecret);
                var totp = new Totp(secretBytes);

                if (totp.VerifyTotp(request.Code, out _, new VerificationWindow(1, 1)))
                {
                    return Ok(new { Message = "2FA verified successfully" });
                }

                return BadRequest(new { Message = "Invalid verification code" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error verifying 2FA", Error = ex.Message });
            }
        }

        // ── Forgot Password Endpoint ──────────────────────────────────

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Utimail))
                    return BadRequest(new { Message = "L'email est requis." });

                var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Utimail == request.Utimail);
                if (user == null)
                    return Ok(new { Message = "Si un compte existe avec cet email, un code de réinitialisation a été généré." });

                // Generate 6-digit reset code
                var random = new Random();
                var resetCode = random.Next(100000, 999999).ToString();

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
                return StatusCode(500, new { Message = "Erreur lors de la demande de réinitialisation.", Error = ex.Message });
            }
        }

        [HttpPost("reset-password-with-code")]
        public async Task<IActionResult> ResetPasswordWithCode([FromBody] ResetPasswordWithCodeRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Utimail) || string.IsNullOrEmpty(request.Code) || string.IsNullOrEmpty(request.NewPassword))
                    return BadRequest(new { Message = "Tous les champs sont requis." });

                var user = await _dbContext.Utilisateurs.FirstOrDefaultAsync(u => u.Utimail == request.Utimail);
                if (user == null)
                    return BadRequest(new { Message = "Utilisateur non trouvé." });

                if (user.UtiResetCode != request.Code || !user.UtiResetCodeExpiry.HasValue || user.UtiResetCodeExpiry < DateTime.UtcNow)
                    return BadRequest(new { Message = "Code invalide ou expiré." });

                // Reset password
                user.Utimps = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
                user.UtiResetCode = null;
                user.UtiResetCodeExpiry = null;
                await _dbContext.SaveChangesAsync();

                return Ok(new { Message = "Mot de passe réinitialisé avec succès." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Erreur lors de la réinitialisation.", Error = ex.Message });
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
                return StatusCode(500, new { Message = "Error updating role", Error = ex.Message });
            }
        }

        // DELETE api/<UtilisateursController>/5
        [HttpDelete]
        public async Task Delete(Utilisateur utilisateur)
        {
            await _utilisateurRepository.DeleteAsync(utilisateur);
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
    }
}
