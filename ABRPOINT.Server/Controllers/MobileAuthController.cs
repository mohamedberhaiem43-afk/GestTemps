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
        [HttpPost("login")]
        [EnableRateLimiting("auth-login")]
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
                    ExpiresAt = DateTime.UtcNow.AddDays(30)
                };
                await _dbContext.RefreshTokens.AddAsync(refreshTokenEntity);
                await _dbContext.SaveChangesAsync();

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

            var newRefreshTokenEntity = new RefreshToken
            {
                Uticod = user.Uticod,
                Token = newRefreshToken,
                ExpiresAt = DateTime.UtcNow.AddDays(30)
            };
            _dbContext.RefreshTokens.Add(newRefreshTokenEntity);
            await _dbContext.SaveChangesAsync();

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
                sitcods
            });
        }

        [Authorize]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest? model)
        {
            var userUticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (!string.IsNullOrEmpty(userUticod))
            {
                var tokens = await _dbContext.RefreshTokens
                    .Where(rt => rt.Uticod == userUticod && !rt.Revoked)
                    .ToListAsync();

                foreach (var token in tokens)
                {
                    token.Revoked = true;
                }
                await _dbContext.SaveChangesAsync();
            }

            return Ok(new { message = "Déconnexion réussie" });
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