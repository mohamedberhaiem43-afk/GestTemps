using ABRPOINT.Server.Annotations.AdminAttributes;
using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.CalculService.Rtt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Endpoints autour du solde RTT (Réduction du Temps de Travail).
///
/// Trois opérations :
/// <list type="number">
/// <item>GET <c>/api/Rtt/{soccod}/{empcod}</c> — solde courant.</item>
/// <item>POST <c>/api/Rtt/recalculate/{soccod}/{empcod}/{year}</c> — recalcul du droit.</item>
/// <item>POST <c>/api/Rtt/reset-year/{soccod}/{year}</c> — clôture annuelle (admin).</item>
/// </list>
/// </summary>
[Route("api/[controller]")]
[ApiController]
[Authorize]
// SEC AI : ValidateSoccod manquait — un user pouvait lire/modifier les soldes RTT d'employés
// d'une autre société. ResetYear et Recalculate restent en plus protégés [Admin] (opérations
// destructrices à l'échelle d'une société).
[ValidateSoccod]
public class RttController : ControllerBase
{
    private readonly IRttCalculationService _rttService;

    public RttController(IRttCalculationService rttService)
    {
        _rttService = rttService;
    }

    [HttpGet("{soccod}/{empcod}")]
    public async Task<IActionResult> GetSolde(string soccod, string empcod)
    {
        var dto = await _rttService.GetRttSoldeAsync(soccod, empcod);
        return Ok(dto);
    }

    [HttpPost("recalculate/{soccod}/{empcod}/{year:int}")]
    [Admin]
    public async Task<IActionResult> Recalculate(string soccod, string empcod, int year)
    {
        try
        {
            var dto = await _rttService.RecalculateRttForEmployeeAsync(soccod, empcod, year);
            return Ok(dto);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("reset-year/{soccod}/{year:int}")]
    [Admin]
    public async Task<IActionResult> ResetYear(string soccod, int year)
    {
        var count = await _rttService.ResetEndOfYearAsync(soccod, year);
        return Ok(new { count, year });
    }
}
