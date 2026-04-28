namespace ABRPOINT.Server.Tenancy;

/// <summary>
/// Accès au tenant courant pour la requête en cours. Implémenté via AsyncLocal pour
/// rester safe à travers les await/Task.Run.
/// </summary>
public interface ICurrentTenant
{
    Tenant? Current { get; }
    void Set(Tenant tenant);
    void Clear();
}

public sealed class AsyncLocalCurrentTenant : ICurrentTenant
{
    private static readonly System.Threading.AsyncLocal<Tenant?> _holder = new();

    public Tenant? Current => _holder.Value;
    public void Set(Tenant tenant) => _holder.Value = tenant;
    public void Clear() => _holder.Value = null;
}
