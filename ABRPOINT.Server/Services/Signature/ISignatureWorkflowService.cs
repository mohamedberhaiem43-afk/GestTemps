namespace ABRPOINT.Server.Services.Signature;

/// <summary>
/// Orchestration du workflow de signature électronique (Phase 1 : mono-signataire
/// bout-en-bout — génération du document, signature de l'employé, scellement SHA-256).
/// La chaîne d'approbation multi-niveaux (étapes 4/5) est ajoutée en Phase 2.
/// </summary>
public interface ISignatureWorkflowService
{
    /// <summary>Génère le document (modèle de courrier), l'archive dans le coffre en
    /// « Pending Signature », crée la demande + l'étape signataire. Renvoie les ids créés.</summary>
    Task<SignatureStartResult> StartAsync(SignatureStartRequest req, string requestedByEmpcod, CancellationToken ct = default);

    /// <summary>Vue d'état d'un parcours : demande + étapes + actions (registre).</summary>
    Task<SignatureRequestView?> GetAsync(int requestId, CancellationToken ct = default);

    /// <summary>Étapes en attente pour un signataire donné (inbox).</summary>
    Task<IReadOnlyList<SignatureInboxItem>> InboxAsync(string empcod, CancellationToken ct = default);

    /// <summary>Signe l'étape courante : tamponne le PDF, journalise l'action, fait avancer
    /// le circuit ; à la dernière étape, scelle (SHA-256) et archive.</summary>
    Task<SignatureSignResult> SignStepAsync(int requestId, int stepId, SignStepInput input, CancellationToken ct = default);

    /// <summary>Recalcule le SHA-256 du PDF scellé et le compare au sceau stocké (intégrité).</summary>
    Task<SealVerifyResult> VerifySealAsync(int documentVaultId, CancellationToken ct = default);
}

public sealed record SignatureStartRequest(
    string SourceType,
    string? SourceId,
    string Empcod,
    string? DocName,
    Dictionary<string, string>? ExtraVars);

public sealed record SignatureStartResult(int RequestId, int DocumentVaultId, string DocName);

public sealed record SignStepInput(
    string SignatureData,
    string? SignerName,
    string? Mention,
    string? Location,
    string AuthMethod,
    string? Ip,
    string? UserAgent);

public sealed record SignatureSignResult(bool Completed, string? CertificateId, string WorkflowStatus, string? SealHash);

public sealed record SealVerifyResult(bool Sealed, bool Valid, string? StoredHash, string? ComputedHash);

public sealed record SignatureInboxItem(
    int RequestId, int StepId, int StepOrder, string SourceType, string? SourceId,
    int? DocumentVaultId, string DocName, DateTime CreatedAt);

public sealed record SignatureRequestView(
    int Id, string SourceType, string? SourceId, int? DocumentVaultId,
    string WorkflowStatus, int CurrentStep, DateTime CreatedAt, DateTime? CompletedAt,
    bool? SealValid, string? SealHash,
    List<SignatureStepView> Steps, List<SignatureActionView> Actions);

public sealed record SignatureStepView(int Id, int StepOrder, string SignerEmpcod, string SignerRole, string Status, string? PlaceholderKey, string? DelegatedTo);

public sealed record SignatureActionView(int StepId, string SignerEmpcod, string Action, string? CertificateId, string? AuthMethod, DateTime SignedAt, string? Motif);
