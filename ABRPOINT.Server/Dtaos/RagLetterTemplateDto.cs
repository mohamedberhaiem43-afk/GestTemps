namespace ABRPOINT.Server.Dtaos;

public sealed class RagLetterTemplateDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string BodyHtml { get; set; } = string.Empty;
    public List<string> Placeholders { get; set; } = new();
    public string? Category { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public sealed class RagLetterTemplateUpsertRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string BodyHtml { get; set; } = string.Empty;
    public string? Category { get; set; }
}

public sealed class RagLetterGenerateRequest
{
    public int TemplateId { get; set; }
    public string Empcod { get; set; } = string.Empty;
    public bool PolishWithAi { get; set; } = false;
    /// <summary>"docx" ou "pdf". Défaut docx.</summary>
    public string Format { get; set; } = "docx";
    /// <summary>Variables additionnelles non issues de la base (ex: motif, date personnalisée).</summary>
    public Dictionary<string, string>? ExtraVars { get; set; }
}
