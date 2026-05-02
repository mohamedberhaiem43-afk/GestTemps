namespace ABRPOINT.Server.Tenancy;

/// <summary>
/// Limites métier appliquées en fonction du plan/abonnement du tenant. Source de vérité
/// unique côté backend ; le frontend reçoit l'état via /me et adapte la nav en conséquence.
/// </summary>
public sealed record PlanLimits(int? MaxEmployees, int? MaxSocietes, int? MaxSites)
{
    public bool IsEmployeeCapped => MaxEmployees.HasValue;
    public bool IsSocieteCapped => MaxSocietes.HasValue;
    public bool IsSiteCapped => MaxSites.HasValue;
}

public static class TrialPolicy
{
    // Quotas de l'essai gratuit : l'application reste fonctionnelle mais bridée pour
    // pousser à la conversion. Cf. landing pricing page pour la promesse commerciale.
    public const int MaxEmployees = 10;
    public const int MaxSocietes = 1;
    public const int MaxSites = 1;

    /// <summary>True ssi le tenant courant est en période d'essai gratuit.</summary>
    public static bool IsTrialing(Tenant? tenant)
        => tenant is not null && string.Equals(tenant.Status, "Trialing", System.StringComparison.OrdinalIgnoreCase);

    /// <summary>Nombre de jours restants avant fin d'essai (0 si déjà expiré, null si pas en essai).</summary>
    public static int? DaysRemaining(Tenant? tenant)
    {
        if (!IsTrialing(tenant) || tenant!.TrialEndsAt is null) return null;
        var diff = (tenant.TrialEndsAt.Value - System.DateTime.UtcNow).TotalDays;
        return diff < 0 ? 0 : (int)System.Math.Ceiling(diff);
    }

    /// <summary>
    /// Limites applicables au tenant courant. L'essai gratuit a priorité sur le plan ;
    /// au-delà, on lit Tenant.PlanCode :
    ///   - "Standard" → 50 collaborateurs, 1 société, 1 filiale
    ///   - "Essentiel" → mêmes garde-fous structurels que Standard mais 25 collaborateurs
    ///   - "Premium" / null → illimité
    /// </summary>
    public static PlanLimits GetLimits(Tenant? tenant)
    {
        if (IsTrialing(tenant))
            return new PlanLimits(MaxEmployees, MaxSocietes, MaxSites);

        var plan = tenant?.PlanCode?.Trim();
        if (string.Equals(plan, "Standard", System.StringComparison.OrdinalIgnoreCase))
            return new PlanLimits(MaxEmployees: 50, MaxSocietes: 1, MaxSites: 1);
        if (string.Equals(plan, "Essentiel", System.StringComparison.OrdinalIgnoreCase))
            return new PlanLimits(MaxEmployees: 25, MaxSocietes: 1, MaxSites: 1);

        // Premium ou plan non renseigné : pas de plafond.
        return new PlanLimits(MaxEmployees: null, MaxSocietes: null, MaxSites: null);
    }
}
