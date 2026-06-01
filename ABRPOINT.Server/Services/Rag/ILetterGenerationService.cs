using ABRPOINT.Server.Dtaos;

namespace ABRPOINT.Server.Services.Rag;

public interface ILetterGenerationService
{
    Task<IReadOnlyList<RagLetterTemplateDto>> ListAsync(CancellationToken ct = default);
    Task<RagLetterTemplateDto?> GetAsync(int id, CancellationToken ct = default);
    Task<RagLetterTemplateDto> CreateAsync(RagLetterTemplateUpsertRequest req, CancellationToken ct = default);
    Task<RagLetterTemplateDto?> UpdateAsync(int id, RagLetterTemplateUpsertRequest req, CancellationToken ct = default);
    Task<bool> DeleteAsync(int id, CancellationToken ct = default);

    /// <summary>
    /// Génère un courrier rempli + (optionnellement) reformulé par Claude, et renvoie
    /// le binaire DOCX ou PDF prêt à télécharger.
    /// </summary>
    Task<(byte[] Bytes, string ContentType, string FileName)> GenerateAsync(
        RagLetterGenerateRequest req,
        string? uticod,
        CancellationToken ct = default);

    /// <summary>
    /// Génère le PDF d'un congé (ou demande de congé) À PARTIR D'UN MODÈLE DE COURRIER
    /// dont la catégorie évoque le congé (contient « cong »). Renvoie null si aucun modèle
    /// de congé n'existe pour le tenant — l'appelant retombe alors sur le rapport FastReport.
    /// Hydrate les placeholders employé/société/contrat + variables spécifiques congé
    /// (condep, conret, connbjour, conref, abslib…).
    /// </summary>
    Task<byte[]?> TryGenerateCongeLetterPdfAsync(string concod, CancellationToken ct = default);
}
