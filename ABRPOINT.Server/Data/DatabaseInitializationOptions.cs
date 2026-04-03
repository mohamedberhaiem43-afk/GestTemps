namespace ABRPOINT.Server.Data;

public sealed class DatabaseInitializationOptions
{
    public const string SectionName = "DatabaseInitialization";

    public bool Enabled { get; set; } = true;

    public int RetryCount { get; set; } = 20;

    public int RetryDelaySeconds { get; set; } = 5;

    public string SocieteCode { get; set; } = "01";

    public string SocieteName { get; set; } = "Default Company";

    public string SiteCode { get; set; } = "01";

    public string SiteName { get; set; } = "Main Site";

    public string AdminCode { get; set; } = "AD";

    public string AdminFirstName { get; set; } = "Admin";

    public string AdminLastName { get; set; } = "System";

    public string AdminEmail { get; set; } = "admin@abrpoint.local";

    public string AdminPassword { get; set; } = "123";

    public string ApplicationCode { get; set; } = "GRH";
}
