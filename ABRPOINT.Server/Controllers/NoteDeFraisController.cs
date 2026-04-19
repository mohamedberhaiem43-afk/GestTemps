using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class NoteDeFraisController : ControllerBase
    {
        private readonly INoteDeFraisRepository _repository;

        public NoteDeFraisController(INoteDeFraisRepository repository)
        {
            _repository = repository;
        }

        [HttpGet("by-soc/{soccod}")]
        public async Task<ActionResult<IEnumerable<NoteDeFrais>>> GetBySoc(string soccod)
        {
            try
            {
                return Ok(await _repository.GetAllBySoc(soccod));
            }
            catch (Exception)
            {
                throw;
            }
        }

        [HttpGet("by-emp/{soccod}/{empcod}")]
        public async Task<ActionResult<IEnumerable<NoteDeFrais>>> GetByEmp(string soccod, string empcod)
        {
            try
            {
                return Ok(await _repository.GetByEmp(soccod, empcod));
            }
            catch (Exception)
            {
                throw;
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<NoteDeFrais>> GetById(int id)
        {
            var result = await _repository.GetById(id);
            if (result == null) return NotFound();
            return Ok(result);
        }

        [HttpPost("add")]
        public async Task<IActionResult> Add([FromForm] NoteDeFraisRequest request)
        {
            if (request == null) return BadRequest();

            string? justificatifPath = null;
            if (request.File != null)
            {
                var (success, filePath, error) = await FileHelper.SaveFile(request.File);
                if (!success) return BadRequest(error);
                justificatifPath = filePath;
            }

            var notedefrais = new NoteDeFrais
            {
                Soccod = request.Soccod,
                Empcod = request.Empcod,
                Titre = request.Titre,
                Categorie = request.Categorie,
                Montant = request.Montant,
                Projet = request.Projet,
                DateDepense = request.DateDepense,
                Justificatif = justificatifPath,
                Etat = "Pending",
                CreatedAt = DateTime.UtcNow
            };

            await _repository.AddAsync(notedefrais);
            return Ok(notedefrais);
        }

        [HttpPut("update-status/{id}/{status}")]
        public async Task<IActionResult> UpdateStatus(int id, string status)
        {
            var item = await _repository.GetById(id);
            if (item == null) return NotFound();

            item.Etat = status;
            await _repository.UpdateAsync(item);
            return Ok(item);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            await _repository.DeleteAsync(id);
            return NoContent();
        }
    }

    public class NoteDeFraisRequest
    {
        public string Soccod { get; set; } = null!;
        public string Empcod { get; set; } = null!;
        public string Titre { get; set; } = null!;
        public string Categorie { get; set; } = null!;
        public double Montant { get; set; }
        public string? Projet { get; set; }
        public DateTime DateDepense { get; set; }
        public IFormFile? File { get; set; }
    }
}
