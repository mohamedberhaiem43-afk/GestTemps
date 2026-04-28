using System.Linq.Expressions;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Helpers;

/// <summary>
/// Génère les prochains codes séquentiels (numériques zéro-paddés) pour les
/// entités de Données de Base (Direction, Service, Fonction, Pays, Ville).
///
/// Approche : on récupère la liste des codes existants pour le périmètre
/// (soccod si applicable), on filtre ceux qui sont purement numériques
/// (les codes alphabétiques type ISO "FRA"/"MAR" sont ignorés), on prend
/// MAX + 1 et on zero-pad à la largeur de la colonne.
///
/// Multi-tenant safe : chaque tenant ayant sa propre DB, le DbContext
/// fourni est déjà bound au tenant courant.
/// </summary>
public static class SequentialCodeGenerator
{
    public static Task<string> NextDirectionCodeAsync(ApplicationDbContext db, string soccod, CancellationToken ct = default)
        => NextAsync(db.Directions.Where(d => d.Soccod == soccod).Select(d => d.Dircod), width: 4, ct);

    public static Task<string> NextServiceCodeAsync(ApplicationDbContext db, string soccod, CancellationToken ct = default)
        => NextAsync(db.Services.Where(s => s.Soccod == soccod).Select(s => s.Sercod), width: 4, ct);

    public static Task<string> NextFonctionCodeAsync(ApplicationDbContext db, string soccod, CancellationToken ct = default)
        => NextAsync(db.Fonctions.Where(f => f.Soccod == soccod).Select(f => f.Foncod), width: 6, ct);

    public static Task<string> NextNationCodeAsync(ApplicationDbContext db, CancellationToken ct = default)
        => NextAsync(db.Nations.Select(n => n.Natcod), width: 3, ct);

    public static Task<string> NextVilleCodeAsync(ApplicationDbContext db, CancellationToken ct = default)
        => NextAsync(db.Villes.Select(v => v.Vilcod), width: 6, ct);

    private static async Task<string> NextAsync(IQueryable<string?> codesQuery, int width, CancellationToken ct)
    {
        var codes = await codesQuery.ToListAsync(ct);
        var max = 0;
        foreach (var c in codes)
        {
            if (string.IsNullOrWhiteSpace(c)) continue;
            // Trim padding pour traiter "0001" comme 1.
            if (int.TryParse(c.Trim(), out var n) && n > max) max = n;
        }
        var next = max + 1;
        return next.ToString().PadLeft(width, '0');
    }
}
