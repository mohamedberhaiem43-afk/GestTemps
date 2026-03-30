using ABRPOINT.Server.Annotations.AdminAttributes;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

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
        public UtilisateursController(
            IConfiguration configuration,
            ApplicationDbContext dbContext,
            IUtilisateurRepository utilisateurRepository)
        {
            _configuration = configuration;
            _dbContext = dbContext;
            _utilisateurRepository = utilisateurRepository;
        }

        [Authorize]
        [HttpGet("users-list/{soccod}/{uticod}")]
        [Admin]
        public async Task<IActionResult> GetUtilisateurs(string soccod,string uticod)
        {
            try
            {
                return Ok(await _utilisateurRepository.GetAllUsers(soccod,uticod));
            }
            catch (Exception ex)
            {
                return StatusCode(500, "probléme de récupération des utilisateurs " + ex);
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
                    var utilisateur = await _utilisateurRepository.GetUtilisateur(uticod);
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
                return BadRequest(ModelState); // Returns validation errors if the model is invalid
            }
            try
            {
                string? soclib = null;
                if (string.IsNullOrEmpty(user.Utimail))
                {
                    return BadRequest("Email or password is missing.");
                }

                Utilisateur? dbUser = _dbContext.Utilisateurs
                    .FirstOrDefault(u => u.Utimail == user.Utimail);

                if (dbUser == null || !BCrypt.Net.BCrypt.Verify(user.Utimps, dbUser.Utimps))
                {
                    return Unauthorized("Invalid credentials.");
                }
                var isEmp = await _dbContext.Employes.Where(e => e.Empcod == dbUser.Uticod).AnyAsync();

                Socuser? societe = null;
                if (!string.IsNullOrEmpty(user.Usersit))
                {
                    societe = await _dbContext.Socusers.SingleOrDefaultAsync(s=>s.Soccod == user.Company &&
                    s.Uticod == dbUser.Uticod &&
                    s.Sitcod == user.Usersit);

                     soclib = await _dbContext.Societes
                    .Where(s => s.Soccod == societe.Soccod)
                    .Select(s => s.Soclib)
                    .FirstOrDefaultAsync();

                }
                List<string> sitcods = await _dbContext.Socusers
                    .Where(s => s.Soccod == user.Company && s.Uticod == dbUser.Uticod)
                    .Select(s => s.Sitcod)
                    .ToListAsync();

                if (societe != null)
                {
                    var accessToken = GenerateJwtToken(dbUser.Uticod);
                    var refreshToken = GenerateRefreshToken();

                    // Save refresh token to database
                    var refreshTokenEntity = new RefreshToken
                    {
                        Uticod = dbUser.Uticod,
                        Token = refreshToken,
                        ExpiresAt = DateTime.UtcNow.AddDays(7)
                    };
                    await _dbContext.RefreshTokens.AddAsync(refreshTokenEntity);
                    await _dbContext.SaveChangesAsync();

                    // Set httpOnly secure cookies
                    Response.Cookies.Append("accessToken", accessToken, new CookieOptions
                    {
                        HttpOnly = true,
                        Secure = true,
                        SameSite = SameSiteMode.None,
                        Expires = DateTimeOffset.UtcNow.AddMinutes(30)
                    });

                    Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
                    {
                        HttpOnly = true,
                        Secure = true,
                        SameSite = SameSiteMode.None,
                        Expires = DateTimeOffset.UtcNow.AddDays(7)
                    });

                    Response.Cookies.Append("uticod", dbUser.Uticod ?? string.Empty, new CookieOptions
                    {
                        HttpOnly = true,
                        Secure = true,
                        SameSite = SameSiteMode.None,
                        Expires = DateTimeOffset.UtcNow.AddDays(7)
                    });

                    // Admin cookie remains accessible for non-sensitive UI logic
                    Response.Cookies.Append("admin", dbUser.Utiadm, new CookieOptions
                    {
                        HttpOnly = false,
                        Secure = true,
                        SameSite = SameSiteMode.None,
                        Expires = DateTimeOffset.UtcNow.AddDays(7)
                    });

                    var socimg = await _dbContext.Societes
                        .Where(s => s.Soccod == user.Company)
                        .Select(s => s.Socimg)
                        .FirstOrDefaultAsync();

                    string utilib = dbUser.Utiprn + " "+ dbUser.Utinom;
                    return Ok(new { dbUser.Uticod, dbUser.Utiimg, socimg, utilib, societe, sitcods, soclib, dbUser.Utiadm, isEmp });
                }

                return NotFound();
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while processing your request.");
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

                // Set new httpOnly secure cookies
                Response.Cookies.Append("accessToken", newAccessToken, new CookieOptions
                {
                    HttpOnly = true,
                    Secure = true,
                    SameSite = SameSiteMode.None,
                    Expires = DateTimeOffset.UtcNow.AddMinutes(30)
                });

                Response.Cookies.Append("refreshToken", newRefreshToken, new CookieOptions
                {
                    HttpOnly = true,
                    Secure = true,
                    SameSite = SameSiteMode.None,
                    Expires = DateTimeOffset.UtcNow.AddDays(7)
                });

                Response.Cookies.Append("uticod", user.Uticod ?? string.Empty, new CookieOptions
                {
                    HttpOnly = true,
                    Secure = true,
                    SameSite = SameSiteMode.None,
                    Expires = DateTimeOffset.UtcNow.AddDays(7)
                });

                return Ok(new { message = "Token refreshed successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while refreshing token", error = ex.Message });
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
                .Select(u => new { u.Uticod, u.Utiadm, u.Utiprn, u.Utinom })
                .FirstOrDefaultAsync();

            if (user == null)
            {
                return Unauthorized();
            }

            var isEmp = await _dbContext.Employes.AnyAsync(e => e.Empcod == uticod);
            var utilib = $"{user.Utiprn} {user.Utinom}".Trim();

            return Ok(new
            {
                uticod = user.Uticod,
                utiadm = user.Utiadm,
                isEmp,
                utilib
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
                Response.Cookies.Delete("accessToken");
                Response.Cookies.Delete("refreshToken");
                Response.Cookies.Delete("uticod");
                Response.Cookies.Delete("admin");

                return Ok(new { message = "Logged out successfully" });
            }
            catch (Exception)
            {
                return StatusCode(500, "An error occurred during logout");
            }
        }



        // PUT api/<UtilisateursController>/5
        [HttpPut]
        [Admin]
        public async Task<bool> Put([FromBody] UtilisateurUpdate utilisateur)
        {
            try
            {
                if (utilisateur.Moduser?.Any() == true && utilisateur.Utilisateur != null)
                {
                    await _utilisateurRepository.UpdateUser(utilisateur);
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
                    await _utilisateurRepository.UpdateUser(utilisateur);
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
            await _utilisateurRepository.UpdateProfileImage(uticod, filePath);

            return Ok(new { filePath });
        }


        [HttpGet("get-profile/{soccod}/{uticod}")]
        public async Task<UtiProfile> GetProfile(string soccod,string uticod)
        {
            try
            {
                UtiProfile profile = await _utilisateurRepository.GetProfile(soccod,uticod);
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
                bool profile = await _utilisateurRepository.ChangePassword(pwd);
                return profile;
            }
            catch (Exception)
            {
                throw;
            }
        }
         
        // DELETE api/<UtilisateursController>/5
        [HttpDelete]
        public void Delete(Utilisateur utilisateur)
        {
            _utilisateurRepository.Delete(utilisateur);
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
