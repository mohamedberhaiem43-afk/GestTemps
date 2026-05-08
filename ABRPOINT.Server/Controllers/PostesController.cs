using ABRPOINT.Helper;
using ABRPOINT.Server.Annotations.PosteAttributes;
using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Exceptions;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;

namespace ABRPOINT.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    // SEC AI : ValidateSoccod manquait — un user pouvait CRUD postes/horaires de toute société.
    // Les attributs [CanAddPoste]/[CanUpdatePoste]/[CanDeletePoste] vérifient le rôle, pas le
    // soccod ; ValidateSoccod ferme la lacune cross-tenant.
    [ValidateSoccod]
    public class PostesController : ControllerBase
    {
        private readonly IPosteRepository _posteRepository;
        private readonly ILcategorieRepository _lcategorieRepository;
        private readonly ApplicationDbContext _dbContext;

        public PostesController(IPosteRepository posteRepository, ILcategorieRepository lcategorieRepository, ApplicationDbContext dbContext)
        {
            _posteRepository = posteRepository;
            _lcategorieRepository = lcategorieRepository;
            _dbContext = dbContext;
        }

        // GET: api/Poste
        // Get all Poste records
        [HttpGet("{soccod}")]
        [CanGetPostes]
        public async Task<ActionResult<Dictionary<string, string>>> GetPostesLibs(string soccod)
        {
            try
            {
                Dictionary<string, string> postes = await _posteRepository.GetPostLibs(soccod);
                return Ok(postes);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "probléme de récupération des postes");
            }
        }

        [HttpGet("get-poste/{soccod}/{codposte}")]
        [CanGetPostes]
        public async Task<ActionResult<Poste>> GetPoste(string soccod, string codposte)
        {
            try
            {
                Poste? postes = await _posteRepository.GetPoste(soccod, codposte);
                return Ok(postes);
            }
            catch (Exception ex)
            {

                return StatusCode(500, "probléme de récupération des postes");
            }

        }
        [HttpGet("get-poste-horaire/{soccod}/{codposte}/{catcod}")]
        [CanGetPostes]
        public async Task<ActionResult<PosteHoraireDto>> GetPosteHoraire(string soccod, string codposte, string catcod)
        {
            try
            {
                PosteHoraireDto? postes = await _posteRepository.GetPosteHoraire(soccod, codposte, catcod);
                return Ok(postes);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "probléme de récupération des postes");
            }
        }
        [HttpGet("get-postes/{soccod}/{codposte}")]
        [CanGetPostes]
        public async Task<ActionResult<PosteHoraireDto>> GetAllPostes(string soccod, string codposte)
        {
            try
            {
                PosteHoraireDto? postes = await _posteRepository.GetAllPostes(soccod, codposte);
                return Ok(postes);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "probléme de récupération des postes");
            }
        }

        // GET: api/Poste/{codposte}
        // Get a specific Poste by codposte
        [HttpGet("{soccod}/{codposte}")]
        [CanGetPostes]
        public async Task<ActionResult<PosteResponse>> GetPosteById(string soccod, string codposte)
        {
            Poste? poste = await _posteRepository.GetPoste(soccod, codposte);

            // Check if poste is not found
            if (poste == null)
            {
                return NotFound(); // Return 404 if not found
            }


            // Create a response model that combines both poste and lposte
            var response = new PosteResponse
            {
                Poste = poste,
            };

            // Return the combined response
            return Ok(response);
        }
        [HttpGet("get-employe-poste/{soccod}/{codpost}/{day}")]
        public async Task<PosteDto> GetEmployePoste(string soccod, string? codpost, string day)
        {
            try
            {
                Poste? poste = await _posteRepository.GetPoste(soccod, codpost);
                if (poste == null)
                    return null;

                string prefix = day.ToLowerInvariant(); // e.g. "lun", "mar", etc.

                PosteDto dto = new PosteDto
                {
                    Codposte = poste.Codposte,
                    Soccod = poste.Soccod,
                    Libposte = poste.Libposte,
                    Avantent = poste.Avantent,
                    Apresent = poste.Apresent,
                    Avantsort = poste.Avantsort,
                    Apressort = poste.Apressort,
                    Jourhdmat = GenericMethodes.GetPropertyValue(poste, prefix + "hdmat"),
                    Jourhfmat = GenericMethodes.GetPropertyValue(poste, prefix + "hfmat"),
                    Jourhdam = GenericMethodes.GetPropertyValue(poste, prefix + "hdam"),
                    Jourhfam = GenericMethodes.GetPropertyValue(poste, prefix + "hfam"),
                    Jourrepos = GenericMethodes.GetPropertyValue(poste, prefix + "repos"),
                    Jourrepas = GenericMethodes.GetNullableInt(poste, prefix + "repas"),
                    Jourhdrep = GenericMethodes.GetPropertyValue(poste, prefix + "hdrep"),
                    Jourhfrep = GenericMethodes.GetPropertyValue(poste, prefix + "hfrep"),
                    Jourhdematin = GenericMethodes.GetPropertyValue(poste, prefix + "hdematin"),
                    Jourhfematin = GenericMethodes.GetPropertyValue(poste, prefix + "hfematin"),
                    Jourhdeamidi = GenericMethodes.GetPropertyValue(poste, prefix + "hdeamidi"),
                    Jourhfeamidi = GenericMethodes.GetPropertyValue(poste, prefix + "hfeamidi"),
                    Arrondi = poste.Arrondi,
                    Maxhrejour = GenericMethodes.GetPropertyValue(poste, "maxhre" + prefix),
                    Minhjour = GenericMethodes.GetNullableFloat(poste, "minhjour" + prefix),
                    Minhdemijour = GenericMethodes.GetNullableFloat(poste, "minhdemijour" + prefix),
                    Jourdouche = GenericMethodes.GetNullableFloat(poste, prefix + "douche")
                };

                return dto;
            }
            catch (Exception)
            {
                throw;
            }
        }

        [HttpGet("get-employe-poste-by-date/{soccod}/{empcod}/{date}/{day}")]
        public async Task<PosteDto> GetEmployePoste(string soccod, string empcod, DateTime? date, string day)
        {
            try
            {
                // 1️⃣ Essayer de récupérer le poste depuis la présence (si elle existe)
                string? codpost = await _dbContext.Presences
                    .Where(p => p.Soccod == soccod && p.Empcod == empcod && p.Predat.Value.Date == date.Value.Date)
                    .Select(p => p.Codposte)
                    .FirstOrDefaultAsync();

                string? catcod = null;

                // 2️⃣ Si pas de poste en présence, essayer la logique Lcategories
                if (string.IsNullOrEmpty(codpost))
                {
                    catcod = await _lcategorieRepository.GetCatcodByEmp(soccod, empcod, date);
                    codpost = await _posteRepository.GetEmpPoste(soccod, empcod, date, catcod);
                }

                // 3️⃣ Si toujours rien, fallback vers le poste par défaut de l'employé
                if (string.IsNullOrEmpty(codpost))
                {
                    var emp = await _dbContext.Employes
                        .Where(e => e.Soccod == soccod && e.Empcod == empcod)
                        .Select(e => new { e.Poscod, e.Catcod })
                        .FirstOrDefaultAsync();

                    codpost = emp?.Poscod;
                    catcod ??= emp?.Catcod;
                }

                Poste? poste = await _posteRepository.GetPoste(soccod, codpost);
                if (poste == null)
                    return null;

                string prefix = day.ToLowerInvariant(); // e.g. "lun", "mar", etc.

                PosteDto dto = new PosteDto
                {
                    Catcod = catcod,
                    Codposte = poste.Codposte,
                    Soccod = poste.Soccod,
                    Libposte = poste.Libposte,
                    Avantent = poste.Avantent,
                    Apresent = poste.Apresent,
                    Avantsort = poste.Avantsort,
                    Apressort = poste.Apressort,
                    Jourhdmat = GenericMethodes.GetPropertyValue(poste, prefix + "hdmat"),
                    Jourhfmat = GenericMethodes.GetPropertyValue(poste, prefix + "hfmat"),
                    Jourhdam = GenericMethodes.GetPropertyValue(poste, prefix + "hdam"),
                    Jourhfam = GenericMethodes.GetPropertyValue(poste, prefix + "hfam"),
                    Jourrepos = GenericMethodes.GetPropertyValue(poste, prefix + "repos"),
                    Jourrepas = GenericMethodes.GetNullableInt(poste, prefix + "repas"),
                    Jourhdrep = GenericMethodes.GetPropertyValue(poste, prefix + "hdrep"),
                    Jourhfrep = GenericMethodes.GetPropertyValue(poste, prefix + "hfrep"),
                    Jourhdematin = GenericMethodes.GetPropertyValue(poste, prefix + "hdematin"),
                    Jourhfematin = GenericMethodes.GetPropertyValue(poste, prefix + "hfematin"),
                    Jourhdeamidi = GenericMethodes.GetPropertyValue(poste, prefix + "hdeamidi"),
                    Jourhfeamidi = GenericMethodes.GetPropertyValue(poste, prefix + "hfeamidi"),
                    Arrondi = poste.Arrondi,
                    Maxhrejour = GenericMethodes.GetPropertyValue(poste, "maxhre" + prefix),
                    Minhjour = GenericMethodes.GetNullableFloat(poste, "minhjour" + prefix),
                    Minhdemijour = GenericMethodes.GetNullableFloat(poste, "minhdemijour" + prefix),
                    Jourdouche = GenericMethodes.GetNullableFloat(poste, prefix + "douche")
                };
                return dto;
            }
            catch (Exception)
            {
                throw;
            }
        }

        // POST: api/Poste
        [HttpPost]
        [CanAddPoste]
        public async Task<ActionResult> CreatePoste([FromBody] Poste poste)
        {
            try
            {
                if (ModelState.IsValid)
                {
                    if (string.IsNullOrWhiteSpace(poste.Soccod))
                        return BadRequest(new { success = false, message = "Soccod est obligatoire" });

                    // Auto-génération du code poste si vide. La PK étant (Codposte, Soccod) on évite
                    // ainsi un doublon : SequentialCodeGenerator prend MAX existant + 1.
                    if (string.IsNullOrWhiteSpace(poste.Codposte))
                        poste.Codposte = await SequentialCodeGenerator.NextCodposteAsync(_dbContext, poste.Soccod);

                    bool isExisting = await _posteRepository.isExisting(poste.Soccod, poste.Codposte);
                    if (isExisting)
                    {
                        await _posteRepository.UpdateAsync(poste);
                        return Ok(new { success = true, message = "Poste mis à jour avec succès", codposte = poste.Codposte });
                    }
                    else
                    {
                        await _posteRepository.AddAsync(poste);
                        return Ok(new { success = true, message = "Poste ajouté avec succès", codposte = poste.Codposte });
                    }
                }
                return BadRequest(ModelState);
            }
            catch (Exception)
            {
                throw;
            }
        }

        // GET: api/Postes/get-next-codposte/SOC01
        [HttpGet("get-next-codposte/{soccod}")]
        public async Task<IActionResult> GetNextCodposte(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod)) return BadRequest("soccod requis");
            var next = await SequentialCodeGenerator.NextCodposteAsync(_dbContext, soccod);
            return Ok(new { codposte = next });
        }

        // PUT: api/Poste/{codposte}
        [HttpPut]
        [CanUpdatePoste]
        public async Task<ActionResult> UpdatePoste([FromBody] Poste poste)
        {
            try
            {
                if (string.IsNullOrEmpty(poste.Codposte))
                {
                    return BadRequest("Codposte don't exist !");
                }
                if (ModelState.IsValid)
                {
                    await _posteRepository.UpdateAsync(poste); // Update poste
                    return NoContent();
                }
            }
            catch (Exception)
            {
                throw;
            }

            return BadRequest(ModelState);
        }

        // DELETE: api/Poste/{codposte}
        [HttpDelete("{soccod}/{codposte}")]
        public async Task<IActionResult> DeletePoste(string soccod, string codposte)
        {
            try
            {
                Poste? poste = await _posteRepository.GetPoste(soccod, codposte);
                if (poste == null)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = "Le poste spécifié est introuvable."
                    });
                }

                await _posteRepository.DeleteAsync(poste);

                return Ok(new
                {
                    success = true,
                    message = "Le poste a été supprimé avec succès."
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new
                {
                    success = false,
                    message = ex.Message
                });
            }
            catch (RepositoryException ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = ex.Message
                });
            }
            catch (Exception)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Une erreur inattendue est survenue."
                });
            }
        }
    }
}
