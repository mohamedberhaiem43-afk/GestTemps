namespace ABRPOINT.Server.Dtaos;

/// <summary>DTO retourné au frontend pour l'écran de gestion des documents juridiques.</summary>
public sealed class RagDocumentDto
{
    public int Id { get; set; }
    public string OriginalName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string Category { get; set; } = "autre";
    public string? UploadedBy { get; set; }
    public DateTime UploadedAt { get; set; }
    public string Status { get; set; } = "pending";
    public int? ChunksCount { get; set; }
    public string? ErrorMessage { get; set; }
}
