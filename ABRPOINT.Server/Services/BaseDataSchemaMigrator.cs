using ABRPOINT.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Migrations idempotentes "in place" pour les colonnes des données de base.
/// Aujourd'hui : élargit vilcod (2 → 6 chars) et villib (20 → 100 chars) pour
/// pouvoir importer les communes françaises (codes INSEE 5 chiffres + noms longs
/// comme "Saint-Remy-en-Bouzemont-Saint-Genest-et-Isson").
///
/// Comme MobileTablesInstaller, on évite EF migrations (pipeline existant) et on
/// garde du SQL plat pour rattraper les bases déjà déployées.
/// </summary>
public static class BaseDataSchemaMigrator
{
    public sealed record MigrationReport(bool VilcodExpanded, bool VillibExpanded, bool ParmodempAdded, bool CetColumnsAdded, bool SocvilleAdded, bool VilcodFkExpanded);

    public static async Task<MigrationReport> MigrateAsync(ApplicationDbContext db, CancellationToken ct = default)
    {
        var vilcod = await ExpandColumnIfNeededAsync(db, "ville", "vilcod", "NVARCHAR(6) NOT NULL", currentMaxLen: 2, targetMaxLen: 6, ct);
        var villib = await ExpandColumnIfNeededAsync(db, "ville", "villib", "NVARCHAR(100) NULL", currentMaxLen: 20, targetMaxLen: 100, ct);
        var parmodemp = await AddColumnIfMissingAsync(db, "parametre", "parmodemp", "NVARCHAR(1) NULL", ct);
        // CET (Compte Épargne Temps) : 2 colonnes Parametre + 1 colonne Solde.
        var cetDate = await AddColumnIfMissingAsync(db, "parametre", "parcetdatelim", "NVARCHAR(5) NULL", ct);
        var cetMax = await AddColumnIfMissingAsync(db, "parametre", "parcetmaxjours", "REAL NULL", ct);
        var cetSolde = await AddColumnIfMissingAsync(db, "solde", "cetjours", "REAL NULL", ct);
        var cetAdded = cetDate || cetMax || cetSolde;
        // Société : ville séparée du numéro de rue (champ socadr existant).
        var socville = await AddColumnIfMissingAsync(db, "societe", "socville", "NVARCHAR(60) NULL", ct);
        // Tables enfants qui référencent ville.vilcod : la PK a été élargie à 6 chars,
        // les FKs étaient encore à 4 → toute sauvegarde d'employé avec un vilcod
        // auto-généré (6 chiffres) ou un code INSEE (5 chiffres) échouait.
        var vilFkEmploye = await ExpandColumnIfNeededAsync(db, "employe", "vilcod", "NVARCHAR(6) NULL", currentMaxLen: 4, targetMaxLen: 6, ct);
        var vilFkContrat = await ExpandColumnIfNeededAsync(db, "contrat", "vilcod", "NVARCHAR(6) NULL", currentMaxLen: 4, targetMaxLen: 6, ct);
        var vilFkContrat2 = await ExpandColumnIfNeededAsync(db, "contrat2", "vilcod", "NVARCHAR(6) NULL", currentMaxLen: 4, targetMaxLen: 6, ct);
        var vilFkEmpaff = await ExpandColumnIfNeededAsync(db, "empaff", "vilcod", "NVARCHAR(6) NULL", currentMaxLen: 4, targetMaxLen: 6, ct);
        var vilFkExpanded = vilFkEmploye || vilFkContrat || vilFkContrat2 || vilFkEmpaff;
        return new MigrationReport(vilcod, villib, parmodemp, cetAdded, socville, vilFkExpanded);
    }

    /// <summary>
    /// Ajoute une colonne à une table existante si elle n'y est pas encore. Idempotent : en cas
    /// d'absence de la table ou si la colonne existe déjà, ne fait rien et retourne false.
    /// </summary>
    private static async Task<bool> AddColumnIfMissingAsync(ApplicationDbContext db, string table, string column, string columnDef, CancellationToken ct)
    {
        if (!await TableExistsAsync(db, table, ct)) return false;
        if (await ColumnExistsAsync(db, table, column, ct)) return false;
        await db.Database.ExecuteSqlRawAsync($"ALTER TABLE [{table}] ADD [{column}] {columnDef};", ct);
        return true;
    }

    private static async Task<bool> ColumnExistsAsync(ApplicationDbContext db, string table, string column, CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"SELECT COUNT(1) FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id WHERE t.name = @t AND c.name = @c";
        var pT = cmd.CreateParameter(); pT.ParameterName = "@t"; pT.Value = table; cmd.Parameters.Add(pT);
        var pC = cmd.CreateParameter(); pC.ParameterName = "@c"; pC.Value = column; cmd.Parameters.Add(pC);
        var result = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(result) > 0;
    }

    private static async Task<bool> ExpandColumnIfNeededAsync(
        ApplicationDbContext db,
        string table,
        string column,
        string newDefinition,
        int currentMaxLen,
        int targetMaxLen,
        CancellationToken ct)
    {
        if (!await TableExistsAsync(db, table, ct)) return false;
        var len = await GetColumnMaxLengthAsync(db, table, column, ct);
        // sys.columns max_length pour NVARCHAR = 2 * char_count ; -1 = MAX.
        var actualChars = len switch
        {
            -1 => int.MaxValue,
            > 0 => len / 2,
            _ => 0
        };
        if (actualChars >= targetMaxLen) return false;

        // Pour SQL Server : ALTER COLUMN ne casse pas une PK NVARCHAR(2) → NVARCHAR(6) tant qu'on garde NOT NULL.
        await db.Database.ExecuteSqlRawAsync($"ALTER TABLE [{table}] ALTER COLUMN [{column}] {newDefinition};", ct);
        return true;
    }

    private static async Task<bool> TableExistsAsync(ApplicationDbContext db, string tableName, CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(1) FROM sys.tables WHERE name = @name";
        var p = cmd.CreateParameter(); p.ParameterName = "@name"; p.Value = tableName; cmd.Parameters.Add(p);
        var result = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(result) > 0;
    }

    private static async Task<int> GetColumnMaxLengthAsync(ApplicationDbContext db, string table, string column, CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"SELECT c.max_length FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id WHERE t.name = @t AND c.name = @c";
        var pT = cmd.CreateParameter(); pT.ParameterName = "@t"; pT.Value = table; cmd.Parameters.Add(pT);
        var pC = cmd.CreateParameter(); pC.ParameterName = "@c"; pC.Value = column; cmd.Parameters.Add(pC);
        var result = await cmd.ExecuteScalarAsync(ct);
        if (result == null || result == DBNull.Value) return 0;
        return Convert.ToInt32(result);
    }
}
