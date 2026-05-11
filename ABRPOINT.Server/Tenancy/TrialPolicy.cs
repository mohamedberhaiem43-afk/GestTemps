namespace ABRPOINT.Server.Tenancy;

/// <summary>
/// Limites métier appliquées en fonction du plan/abonnement du tenant.
///
/// <para>
/// Modèle V2 (depuis 2026-05) — packs commerciaux Starter/Standard/Premium :
///   - <see cref="MaxEmployees"/> = null sur tous les packs payants : pas de plafond dur,
///     les salariés au-delà de <see cref="IncludedEmployees"/> sont facturés au tarif
///     <see cref="OverageRatePerEmployee"/> (cf. <see cref="PlanCatalog"/>).
///   - L'essai gratuit (30 j) garde un plafond dur à 10 salariés pour limiter l'abus.
/// </para>
/// </summary>
public sealed record PlanLimits(
    int? MaxEmployees,
    int? MaxSocietes,
    int? MaxSites,
    int IncludedEmployees = 0,
    decimal OverageRatePerEmployee = 0m)
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
    /// <summary>Durée par défaut de l'essai gratuit (jours). Doit matcher Stripe:TrialDays.</summary>
    public const int TrialDurationDays = 30;

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
    /// au-delà, on délègue à <see cref="PlanCatalog"/> (Starter/Standard/Premium).
    /// Plan inconnu / null → comportement "Premium" (rétrocompatible : tenants legacy sans
    /// plan choisi gardent un accès large jusqu'à migration explicite).
    /// </summary>
    public static PlanLimits GetLimits(Tenant? tenant)
    {
        if (IsTrialing(tenant))
        {
            // Pendant l'essai, on borne dur à 10 salariés / 1 société / 1 site même si le
            // tenant a déjà coché un plan supérieur — l'essai sert à valider la solution
            // sur un échantillon, pas à utiliser la full grille.
            return new PlanLimits(
                MaxEmployees: MaxEmployees,
                MaxSocietes: MaxSocietes,
                MaxSites: MaxSites,
                IncludedEmployees: MaxEmployees,
                OverageRatePerEmployee: 0m);
        }

        var plan = PlanCatalog.GetPlan(tenant?.PlanCode);
        if (plan is null)
        {
            // Tenant legacy ou plan supprimé : illimité pour ne pas casser l'app.
            return new PlanLimits(MaxEmployees: null, MaxSocietes: null, MaxSites: null);
        }

        // Modèle pay-as-you-grow : pas de plafond dur sur le nombre de salariés.
        // L'overage est calculé/facturé séparément (cf. PlanCatalog.ComputeMonthlyTotal).
        return new PlanLimits(
            MaxEmployees: null,
            MaxSocietes: plan.MaxSocietes,
            MaxSites: plan.MaxSites,
            IncludedEmployees: plan.IncludedEmployees,
            OverageRatePerEmployee: plan.OverageRatePerEmployeeEur);
    }
}
