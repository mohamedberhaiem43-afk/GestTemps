using ABRPOINT.Server.Dtaos;

namespace ABRPOINT.Server.Services.Rag;

/// <summary>
/// Orchestrateur du chat RAG : récupère les chunks via le sidecar, masque les PII,
/// appelle Claude (Anthropic Messages API en région EU) et persiste l'audit RGPD.
/// La clé Anthropic n'est jamais exposée au sidecar Python.
/// </summary>
public interface IClaudeRagService
{
    Task<RagChatAnswer> AskAsync(string question, int topK, string? uticod, CancellationToken ct = default);

    Task<bool> RecordFeedbackAsync(long logId, byte score, string? comment, CancellationToken ct = default);

    /// <summary>
    /// Demande à Claude de reformuler un texte (typiquement le HTML d'un courrier) dans
    /// un ton professionnel français, sans changer le sens. Utilisé par
    /// <see cref="ILetterGenerationService"/> quand l'utilisateur active le polish IA.
    /// </summary>
    Task<string> PolishAsync(string content, string? toneHint, CancellationToken ct = default);
}
