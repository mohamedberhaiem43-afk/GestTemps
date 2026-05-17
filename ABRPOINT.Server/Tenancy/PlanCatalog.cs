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
    // Plafond ABSOLU de salariés autorisés sur le pack — au-delà, l'admin doit
    // upgrader (Starter→Standard→Premium→Enterprise). Soft cap : retournés
    // par EmployesController.Post avec un 402 "plan_max_employees_reached".
    //   Starter  →  30 salariés max  (10 inclus + jusqu'à 20 supplémentaires)
    //   Standard → 100 salariés max  (15 inclus + jusqu'à 85 supplémentaires)
    //   Premium  → 200 salariés max  (30 inclus + jusqu'à 170 supplémentaires)
    int MaxEmployees,
    int? MaxSocietes,
    int? MaxSites,
    // Quota de stockage par tenant (Mo binaires, 1 Mo = 1 048 576 octets).
    // Affiché en "Go" côté UI (binary GiB ≈ Go en français marketing) :
    //   Starter   5 120 Mo →  5 Go
    //   Standard 20 480 Mo → 20 Go
    //   Premium 102 400 Mo → 100 Go
    // Mesure = pg_database_size(DbName) + taille du dossier uploads/{slug}/, refresh hourly.
    long StorageQuotaMb,
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
    bool GeneralExit,
    // 2026-05-12 : ajout LeaveManagement / AuthorizationManagement. Sur Starter,
    // la gestion des congés (demande + titre) et des autorisations de sortie
    // (demande + saisie) est masquée. L'état périodique reste accessible —
    // c'est le seul rapport conservé sur Starter (cf. positionnement "pointage
    // simple, sans workflow RH").
    bool LeaveManagement,
    bool AuthorizationManagement);

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
        MaxEmployees: 30,             // cap dur : 10 inclus + 20 supplémentaires
        MaxSocietes: 1,
        MaxSites: 1,
        StorageQuotaMb: 5L * 1024,    // 5 Go
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
            GeneralExit: false,
            LeaveManagement: false,
            AuthorizationManagement: false));

    public static readonly PlanDefinition Standard = new(
        Code: StandardCode,
        DisplayName: "Standard",
        // 2026-05-17 : grille Early Launch — 54€ flat, 15 salariés inclus (avant 59.50€/25).
        // L'offre est réservée aux 10 premières entreprises partenaires avec engagement
        // annuel ; les anciens tenants déjà sur Standard conservent leur price_id Stripe
        // (grandfathering implicite — le price_id ne change pas, seule la grille publique).
        FlatPriceMonthlyEur: 54m,
        IncludedEmployees: 15,
        OverageRatePerEmployeeEur: 6.90m,
        MaxEmployees: 100,            // cap dur : 15 inclus + jusqu'à 85 supplémentaires
        // 2026-05 : Standard capé à 1 société / 1 filiale (avant : 3 sites). Le multi-filiales
        // devient un différenciateur exclusif Premium pour clarifier le positionnement
        // commercial (Standard = PME mono-entité, Premium = groupes multi-entités).
        MaxSocietes: 1,
        MaxSites: 1,
        StorageQuotaMb: 20L * 1024,   // 20 Go
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
            GeneralExit: true,
            LeaveManagement: true,
            AuthorizationManagement: true));

    public static readonly PlanDefinition Premium = new(
        Code: PremiumCode,
        DisplayName: "Premium",
        // 2026-05-17 : grille Early Launch — 149€ flat, 30 salariés inclus (avant 119€/50).
        // Premium devient repositionné "entreprises structurées" : moins de salariés
        // inclus mais cap pack à 200 (multi-sites/multi-filiales reste exclusif Premium).
        // Au-delà de 200, l'offre Enterprise sur devis prend le relais.
        FlatPriceMonthlyEur: 149m,
        IncludedEmployees: 30,
        OverageRatePerEmployeeEur: 9.90m,
        MaxEmployees: 200,            // cap dur : 30 inclus + jusqu'à 170 supplémentaires
        MaxSocietes: null,
        MaxSites: null,
        StorageQuotaMb: 100L * 1024,  // 100 Go
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
            GeneralExit: true,
            LeaveManagement: true,
            AuthorizationManagement: true));

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

    /// <summary>
    /// Quota de stockage en Mo pour un PlanCode donné. Fallback Starter quand le
    /// plan est inconnu/null (tenant en trial sans plan choisi) : le quota le
    /// plus restrictif protège contre les abus, et basculer vers Standard/Premium
    /// élargit immédiatement le quota au prochain refresh du tenant.
    /// </summary>
    public static long GetStorageQuotaMb(string? planCode)
    {
        var plan = GetPlan(planCode) ?? Starter;
        return plan.StorageQuotaMb;
    }

    /// <summary>
    /// Vrai si l'effectif actuel est strictement supérieur au nombre de salariés
    /// inclus dans le pack. Sert de gate à la création d'un nouveau collaborateur :
    /// au-delà du seuil, l'admin doit explicitement confirmer le paiement d'un
    /// supplément (cf. EmployesController.Post, paramètre confirmOverage).
    /// </summary>
    public static bool IsOverIncludedCapacity(PlanDefinition plan, int currentActiveCount)
    {
        return currentActiveCount >= plan.IncludedEmployees;
    }

    /// <summary>
    /// Nombre de salariés "supplémentaires" facturables = au-delà du quota inclus
    /// dans le pack. Pousse cette quantité sur l'item Stripe <c>user_supp</c> via
    /// <see cref="ABRPOINT.Server.Billing.IBillingService.SyncSupplementaryEmployeesAsync"/>.
    /// </summary>
    public static int ComputeSupplementaryCount(PlanDefinition plan, int currentActiveCount)
    {
        return System.Math.Max(0, currentActiveCount - plan.IncludedEmployees);
    }

    /// <summary>
    /// Vrai si l'ajout d'un collaborateur supplémentaire ferait dépasser le
    /// plafond ABSOLU du pack (<see cref="PlanDefinition.MaxEmployees"/>). Au-delà,
    /// l'admin doit upgrader le pack (Starter→Standard→Premium) — pas d'option
    /// de paiement à la carte ni de débordement toléré (limite commerciale dure).
    /// </summary>
    public static bool WouldExceedPlanMax(PlanDefinition plan, int currentActiveCount)
    {
        return currentActiveCount >= plan.MaxEmployees;
    }
}
