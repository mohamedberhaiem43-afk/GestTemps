using System.Linq.Expressions;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace ABRPOINT.Server.Data;

/// <summary>
/// Soft-delete + INSERT collision résolveur global.
///
/// ApplicationDbContext applique :
///   - un soft-delete sur tous les BaseEntity (OnBeforeSave : Deleted → Modified, DeletedAt = now).
///   - un filtre global HasQueryFilter (DeletedAt IS NULL) qui masque les lignes soft-deleted.
///
/// Conséquence : tout repository qui INSERT un BaseEntity dont la PK existe encore physiquement
/// en base (ligne précédemment soft-deleted) explose en violation PK — l'existence check filtré
/// la rate, mais SQL Server, lui, voit toujours la ligne.
///
/// Plutôt que de patcher chaque AddAsync, on intercepte ici : pour chaque entité ajoutée dont la PK
/// collisionne avec une ligne soft-deleted, on "ressuscite" la ligne existante (DeletedAt = null +
/// copie des champs métier de la nouvelle saisie) et on détache l'entité ajoutée. C'est la sémantique
/// implicite du pattern soft-delete : "soft-deleted = créneau libre pour réutilisation".
/// </summary>
public partial class ApplicationDbContext
{
    private async Task ResurrectSoftDeletedConflictsAsync(CancellationToken ct)
    {
        // Snapshot : on va muter le change tracker.
        var addedEntries = ChangeTracker.Entries<BaseEntity>()
            .Where(e => e.State == EntityState.Added)
            .ToList();

        foreach (var entry in addedEntries)
        {
            var pk = entry.Metadata.FindPrimaryKey();
            if (pk == null) continue;

            // Identity / valeur générée à l'insert : SQL choisit un nouvel ID, pas de collision possible.
            if (pk.Properties.Any(p => p.ValueGenerated == ValueGenerated.OnAdd))
                continue;

            var keyValues = new object?[pk.Properties.Count];
            var anyNullKey = false;
            for (int i = 0; i < pk.Properties.Count; i++)
            {
                var v = entry.Property(pk.Properties[i].Name).CurrentValue;
                if (v == null) { anyNullKey = true; break; }
                keyValues[i] = v;
            }
            if (anyNullKey) continue; // PK partielle : pas de query déterministe possible.

            var existing = await FindIgnoringFiltersAsync(entry.Metadata, keyValues!, ct);
            if (existing == null) continue;

            // BaseEntity garantit DeletedAt — l'entité a été détectée par PK exacte.
            if (existing is not BaseEntity existingBase) continue;
            if (existingBase.DeletedAt == null)
                continue; // ligne vivante : on laisse EF lever le doublon naturellement.

            CopyScalarBusinessFields(from: entry.Entity, to: existing, pk);
            existingBase.DeletedAt = null;

            var existingEntry = Entry(existing);
            existingEntry.State = EntityState.Modified;
            entry.State = EntityState.Detached;
        }
    }

    /// <summary>
    /// Set&lt;T&gt;().IgnoreQueryFilters().FirstOrDefaultAsync(e =&gt; e.PK1 == k1 &amp;&amp; e.PK2 == k2 &amp;&amp; ...)
    /// construit dynamiquement parce que T n'est pas connu statiquement ici.
    /// </summary>
    private async Task<object?> FindIgnoringFiltersAsync(IEntityType entityType, object[] keyValues, CancellationToken ct)
    {
        var clrType = entityType.ClrType;

        // Set<T>()
        var setMethod = typeof(DbContext)
            .GetMethod(nameof(Set), 1, Type.EmptyTypes)!
            .MakeGenericMethod(clrType);
        var queryable = (IQueryable)setMethod.Invoke(this, null)!;

        // .IgnoreQueryFilters()
        var ignoreFiltersMethod = typeof(EntityFrameworkQueryableExtensions)
            .GetMethods()
            .First(m => m.Name == nameof(EntityFrameworkQueryableExtensions.IgnoreQueryFilters)
                        && m.GetParameters().Length == 1)
            .MakeGenericMethod(clrType);
        queryable = (IQueryable)ignoreFiltersMethod.Invoke(null, new object[] { queryable })!;

        // e => e.PK1 == k1 && e.PK2 == k2 && ...
        var pkProps = entityType.FindPrimaryKey()!.Properties;
        var param = Expression.Parameter(clrType, "e");
        Expression? body = null;
        for (int i = 0; i < pkProps.Count; i++)
        {
            var prop = pkProps[i];
            var memberAccess = Expression.PropertyOrField(param, prop.Name);
            var keyValue = Expression.Constant(keyValues[i], memberAccess.Type);
            var equality = Expression.Equal(memberAccess, keyValue);
            body = body == null ? equality : Expression.AndAlso(body, equality);
        }
        var lambda = Expression.Lambda(body!, param);

        // .Where(lambda)
        var whereMethod = typeof(Queryable).GetMethods()
            .First(m => m.Name == nameof(Queryable.Where)
                        && m.GetParameters().Length == 2
                        && IsExpressionOfFuncTBool(m.GetParameters()[1].ParameterType))
            .MakeGenericMethod(clrType);
        queryable = (IQueryable)whereMethod.Invoke(null, new object[] { queryable, lambda })!;

        // .FirstOrDefaultAsync(ct)
        var firstAsyncMethod = typeof(EntityFrameworkQueryableExtensions).GetMethods()
            .First(m => m.Name == nameof(EntityFrameworkQueryableExtensions.FirstOrDefaultAsync)
                        && m.GetParameters().Length == 2)
            .MakeGenericMethod(clrType);
        var task = (Task)firstAsyncMethod.Invoke(null, new object[] { queryable, ct })!;
        await task.ConfigureAwait(false);
        return task.GetType().GetProperty("Result")!.GetValue(task);
    }

    private static bool IsExpressionOfFuncTBool(Type t)
    {
        if (!t.IsGenericType) return false;
        if (t.GetGenericTypeDefinition() != typeof(Expression<>)) return false;
        var inner = t.GetGenericArguments()[0];
        if (!inner.IsGenericType) return false;
        if (inner.GetGenericTypeDefinition() != typeof(Func<,>)) return false;
        return inner.GetGenericArguments()[1] == typeof(bool);
    }

    /// <summary>
    /// Copie les propriétés scalaires "métier" de l'entité ajoutée vers la ligne ressuscitée :
    /// on saute la PK, les champs d'audit BaseEntity (CreatedAt, DeletedAt, RetentionDate) et
    /// toutes les propriétés non-scalaires (navigations, collections, types complexes).
    /// </summary>
    private static void CopyScalarBusinessFields(object from, object to, IKey pk)
    {
        var pkNames = new HashSet<string>(pk.Properties.Select(p => p.Name), StringComparer.OrdinalIgnoreCase);
        var auditFields = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            nameof(BaseEntity.CreatedAt),
            nameof(BaseEntity.DeletedAt),
            nameof(BaseEntity.RetentionDate),
        };

        foreach (var prop in from.GetType().GetProperties())
        {
            if (!prop.CanRead || !prop.CanWrite) continue;
            if (pkNames.Contains(prop.Name)) continue;
            if (auditFields.Contains(prop.Name)) continue;
            if (!IsScalar(prop.PropertyType)) continue;

            var value = prop.GetValue(from);
            prop.SetValue(to, value);
        }
    }

    private static bool IsScalar(Type t)
    {
        var u = Nullable.GetUnderlyingType(t) ?? t;
        if (u.IsPrimitive || u.IsEnum) return true;
        if (u == typeof(string)) return true;
        if (u == typeof(decimal)) return true;
        if (u == typeof(DateTime) || u == typeof(DateTimeOffset)) return true;
        if (u == typeof(TimeSpan)) return true;
        if (u == typeof(Guid)) return true;
        if (u == typeof(byte[])) return true;
        return false;
    }
}
