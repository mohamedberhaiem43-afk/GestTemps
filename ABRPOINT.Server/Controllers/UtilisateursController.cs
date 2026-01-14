using ABRPOINT.Server.Annotations.AdminAttributes;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
        public IActionResult AddUtilisateur([FromBody] Utilisateur utilisateur,string sitcod,string soccod)
        {
            try
            {
                
                Socuser socuser = new Socuser();
                socuser.Uticod = utilisateur.Uticod;
                socuser.Soccod = soccod;
                socuser.Sitcod = sitcod;
                _utilisateurRepository.Add(utilisateur,socuser);
                return  Ok(utilisateur);
            }
            catch (Exception ex)
            {

                return StatusCode(500,"probleme d'ajout utilisateur "+ex);
            }
            
        }
        // POST api/<UtilisateursController>
        [HttpPost("connect")]
        public IActionResult Connect([FromBody] UserLoginModel user)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState); // Returns validation errors if the model is invalid
            }
            try
            {
                string soclib = null;
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

                Socuser societe = null;
                if (!string.IsNullOrEmpty(user.Usersit))
                {
                    societe = _dbContext.Socusers.SingleOrDefault(s=>s.Soccod == user.Company &&
                    s.Uticod == dbUser.Uticod &&
                    s.Sitcod == user.Usersit);

                     soclib = _dbContext.Societes
                    .Where(s => s.Soccod == societe.Soccod)
                    .Select(s => s.Soclib)
                    .FirstOrDefault();

                }
                List<string> sitcods = _dbContext.Socusers
                    .Where(s => s.Soccod == user.Company && s.Uticod == dbUser.Uticod)
                    .Select(s => s.Sitcod)
                    .ToList();
                
                if (societe != null)
                {
                    var token = GenerateJwtToken(dbUser.Uticod);

                    Response.Cookies.Append("admin", dbUser.Utiadm, new CookieOptions
                    {
                        HttpOnly = false, // Only set to false if frontend must access it (not recommended for sensitive values)
                        Secure = true,    // Required if your site is served over HTTPS
                        SameSite = SameSiteMode.None, // Allows cross-origin requests
                        Expires = DateTimeOffset.UtcNow.AddHours(1)
                    });


                    string utilib = dbUser.Utiprn + " "+ dbUser.Utinom;
                    return Ok(new { token, dbUser.Uticod, utilib, societe,sitcods,soclib,dbUser.Utiadm });
                }

                return NotFound();
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while processing your request.");
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
        public async Task<IActionResult> UploadProfileImage(IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                    return BadRequest("No file uploaded.");

                var uploads = Path.Combine(Directory.GetCurrentDirectory(), "../abrpoint.client/src/assets");
                var filePath = Path.Combine(uploads, file.FileName);
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                return Ok(new { filePath = "/Images/Profile/" + file.FileName });
            }
            catch (Exception)
            {
                throw;
            }
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
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.Now.AddMinutes(30),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
