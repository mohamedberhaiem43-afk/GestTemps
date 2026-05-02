namespace ABRPOINT.Server.Dtaos
{
    public sealed record ContactSupportRequest(
        string Name,
        string Email,
        string Subject,
        string Message);

    public sealed record ContactSalesRequest(
        string Company,
        string ContactName,
        string Email,
        string? Phone,
        string Headcount,
        string? Needs);
}
