namespace ABRPOINT.Server.Tenancy;

/// <summary>
/// Définition d'un plan tarifaire. Source de vérité unique pour :
///   - le prix forfaitaire mensuel,
///   - le nombre de salariés inclus,
///   - le tarif par salarié supplémentaire (overage),
///   - la matrice fonctionnelle (module × plan).
///
/// Les limites de comptage (cf. <see cref="PlanLimits"/>) sont dérivées d'ici via
/// <see cref="PlanCatalog.GetLimits"/>. Les feature flags sont consommés par le
/// middleware <c>RequirePlanFeatureAttribute</c> côté API et exposés au frontend
/// via le endpoint <c>/api/Utilisateurs/me</c> (clé <c>planFeatures</c>).
/// </summary>
public sealed record PlanDefinition(
    string Code,
    string DisplayName,
    decimal FlatPriceMonthlyEur,
    int IncludedEmployees,
    decimal OverageRatePerEmployeeEur,
    int? MaxSocietes,
    int? MaxSites,
    PlanFeatures Features);

/// <summary>
/// Drapeaux fonctionnels disponibles par plan. Liste figée — ajouter ici toute
/// nouvelle fonctionnalité commerciale et mettre à jour la matrice dans
/// <see cref="PlanCatalog"/>. Le frontend reçoit ce record sérialisé.
/// </summary>
public sealed record PlanFeatures(
    bool MobileApp,
    bool Geolocation,
    bool DigitalVault,
    bool ElectronicSignature,
    bool MultiSite,
    bool MultiSociete,
    bool AdvancedDashboards,
    bool RagAi,
    bool AdvancedAuditLogs,
    bool CustomBranding,
    bool DeviceTrustEnforced,
    bool ScreenshotProtection,
    bool CertificatePinning,
    // Modules RH avancés réservés Standard/Premium (2026-05). Sur Starter, ces
    // sections sont masquées dans la nav et les endpoints API renvoient 402.
    bool Missions,
    bool CompensationDays,
    bool GeneralLeave,
    bool GeneralExit);

/// <summary>
/// Catalogue des plans commerciaux (Starter / Standard / Premium) et des
/// limites/features associées. Les valeurs reflètent la grille de tasks.md
/// (cf. document commercial 2026-05).
/// </summary>
public static class PlanCatalog
{
    public const string StarterCode = "Starter";
    public const string StandardCode = "Standard";
    public const string PremiumCode = "Premium";

    /// <summary>
    /// Renvoie le code canonique pour un input potentiellement legacy ou casse mixte.
    /// "Essentiel" (ancien nom du pack 0€ → 25 salariés) est redirigé vers "Starter".
    /// </summary>
    public static string Normalize(string? raw)
    {
        var v = (raw ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(v)) return string.Empty;
        if (string.Equals(v, "Essentiel", System.StringComparison.OrdinalIgnoreCase)) return StarterCode;
        if (string.Equals(v, "Starter", System.StringComparison.OrdinalIgnoreCase)) return StarterCode;
        if (string.Equals(v, "Standard", System.StringComparison.OrdinalIgnoreCase)) return StandardCode;
        if (string.Equals(v, "Premium", System.StringComparison.OrdinalIgnoreCase)) return PremiumCode;
        return v; // inconnu — laissé tel quel pour traçabilité, GetPlan retournera null
    }

    public static readonly PlanDefinition Starter = new(
        Code: StarterCode,
        DisplayName: "Starter",
        FlatPriceMonthlyEur: 29.50m,
        IncludedEmployees: 10,
        OverageRatePerEmployeeEur: 4.90m,
        MaxSocietes: 1,
        MaxSites: 1,
        Features: new PlanFeatures(
            MobileApp: false,
            Geolocation: false,
            DigitalVault: false,
            ElectronicSignature: false,
            MultiSite: false,
            MultiSociete: false,
            AdvancedDashboards: false,
            RagAi: false,
            AdvancedAuditLogs: false,
            CustomBranding: false,
            DeviceTrustEnforced: false,
            ScreenshotProtection: false,
            CertificatePinning: false,
            Missions: false,
            CompensationDays: false,
            GeneralLeave: false,
            GeneralExit: false));

    public static readonly PlanDefinition Standard = new(
        Code: StandardCode,
        DisplayName: "Standard",
        FlatPriceMonthlyEur: 59.50m,
        IncludedEmployees: 25,
        OverageRatePerEmployeeEur: 6.90m,
        // 2026-05 : Standard capé à 1 société / 1 filiale (avant : 3 sites). Le multi-filiales
        // devient un différenciateur exclusif Premium pour clarifier le positionnement
        // commercial (Standard = PME mono-entité, Premium = groupes multi-entités).
        MaxSocietes: 1,
        MaxSites: 1,
        Features: new PlanFeatures(
            MobileApp: true,
            Geolocation: true,
            DigitalVault: true,
            ElectronicSignature: true,
            MultiSite: true,
            MultiSociete: false,
            AdvancedDashboards: true,
            RagAi: false,
            AdvancedAuditLogs: false,
            CustomBranding: false,
            DeviceTrustEnforced: false,
            ScreenshotProtection: false,
            CertificatePinning: false,
            Missions: true,
            CompensationDays: true,
            GeneralLeave: true,
            GeneralExit: true));

    public static readonly PlanDefinition Premium = new(
        Code: PremiumCode,
        DisplayName: "Premium",
        FlatPriceMonthlyEur: 119m,
        IncludedEmployees: 50,
        OverageRatePerEmployeeEur: 9.90m,
        MaxSocietes: null,
        MaxSites: null,
        Features: new PlanFeatures(
            MobileApp: true,
            Geolocation: true,
            DigitalVault: true,
            ElectronicSignature: true,
            MultiSite: true,
            MultiSociete: true,
            AdvancedDashboards: true,
            RagAi: true,
            AdvancedAuditLogs: true,
            CustomBranding: true,
            DeviceTrustEnforced: true,
            ScreenshotProtection: true,
            CertificatePinning: true,
            Missions: true,
            CompensationDays: true,
            GeneralLeave: true,
            GeneralExit: true));

    /// <summary>Retourne la définition pour un code donné, ou null si inconnu.</summary>
    public static PlanDefinition? GetPlan(string? rawCode)
    {
        var code = Normalize(rawCode);
        return code switch
        {
            StarterCode => Starter,
            StandardCode => Standard,
            PremiumCode => Premium,
            _ => null,
        };
    }

    /// <summary>Tous les plans, dans l'ordre commercial (du moins cher au plus cher).</summary>
    public static IReadOnlyList<PlanDefinition> All { get; } = new[] { Starter, Standard, Premium };

    /// <summary>
    /// Calcule le total mensuel (hors taxes) pour un plan et un effectif donnés.
    /// Formule : <c>flat + max(0, count - included) × overage</c>.
    /// </summary>
    public static decimal ComputeMonthlyTotal(PlanDefinition plan, int employeeCount)
    {
        var overage = System.Math.Max(0, employeeCount - plan.IncludedEmployees);
        return plan.FlatPriceMonthlyEur + overage * plan.OverageRatePerEmployeeEur;
    }
}
