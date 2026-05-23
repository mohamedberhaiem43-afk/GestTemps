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
    // Tarification 2026-05 (cf. tarifs.txt — grille commerciale officielle) :
    //   • FlatPriceMonthlyEur     = prix d'engagement MENSUEL (sans engagement annuel).
    //   • FlatPriceAnnualMonthlyEur = équivalent mensuel quand l'engagement est ANNUEL
    //     (= MontantAnnuel / 12). Le montant annuel total est ces deux × 12.
    // Les deux prix sont stockés explicitement : le ratio n'est PAS uniforme entre les
    // packs (Starter ~30%, Standard ~46%, Business ~45% de remise annuelle), donc on
    // ne peut plus dériver l'un de l'autre via un coefficient global.
    decimal FlatPriceMonthlyEur,
    decimal FlatPriceAnnualMonthlyEur,
    int IncludedEmployees,
    // Nombre d'administrateurs inclus dans le pack. null = illimité (Business).
    int? IncludedAdmins,
    decimal OverageRatePerEmployeeEur,
    // Plafond ABSOLU de salariés autorisés sur le pack — au-delà, l'admin doit
    // upgrader (Starter→Standard→Business→Enterprise). Soft cap : retournés
    // par EmployesController.Post avec un 402 "plan_max_employees_reached".
    //   Starter  →  25 salariés max  (10 inclus + jusqu'à 15 supplémentaires)
    //   Standard → 100 salariés max  (25 inclus + jusqu'à 75 supplémentaires)
    //   Business → 250 salariés max  (50 inclus + jusqu'à 200 supplémentaires)
    int MaxEmployees,
    int? MaxSocietes,
    int? MaxSites,
    // Quota de stockage par tenant (Mo binaires, 1 Mo = 1 048 576 octets).
    // Grille 2026-05 (cf. tarifs.txt) :
    //   Starter   10 240 Mo →  10 Go inclus  (max 50 Go avec stockage supplémentaire)
    //   Standard  51 200 Mo →  50 Go inclus  (max 300 Go avec stockage supplémentaire)
    //   Business 204 800 Mo → 200 Go inclus  (max 2 To  avec stockage supplémentaire)
    // Mesure = pg_database_size(DbName) + taille du dossier uploads/{slug}/, refresh hourly.
    long StorageQuotaMb,
    // Prix HT du bloc de stockage supplémentaire (29 € / 100 Go sur Starter/Standard,
    // 49 € / 100 Go sur Business). Marketing : exposé sur la page tarifs et MonAbonnement.
    decimal StorageSupplementBlockEur,
    // Plafond ABSOLU du stockage (Mo). Au-delà, l'admin doit passer au pack supérieur.
    long MaxStorageMb,
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
        // Grille tarifs.txt 2026-05 : 99 €/mois en mensuel, 69 €/mois en annuel
        // (soit 828 € HT / an, ~30 % de remise sur l'engagement annuel).
        FlatPriceMonthlyEur: 99m,
        FlatPriceAnnualMonthlyEur: 69m,
        IncludedEmployees: 10,
        IncludedAdmins: 1,
        OverageRatePerEmployeeEur: 4.90m,
        MaxEmployees: 25,             // cap dur : jusqu'à 25 salariés max (10 inclus + 15 supplémentaires)
        MaxSocietes: 1,
        MaxSites: 1,
        StorageQuotaMb: 10L * 1024,   // 10 Go inclus
        StorageSupplementBlockEur: 29m, // +29 € / 100 Go supplémentaires
        MaxStorageMb: 50L * 1024,     // 50 Go max
        // 2026-05 — repositionnement commercial : le Starter intègre désormais
        // le pointage MOBILE (web était trop restrictif vs concurrence) et la
        // gestion congés / autorisations (essentielle même pour une TPE). Les
        // features réservées Standard/Premium restent : géolocalisation, coffre
        // numérique, signature, multi-sites, dashboards avancés, missions, audit.
        Features: new PlanFeatures(
            MobileApp: true,
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
            LeaveManagement: true,
            AuthorizationManagement: true));

    public static readonly PlanDefinition Standard = new(
        Code: StandardCode,
        DisplayName: "Standard",
        // Grille tarifs.txt 2026-05 : 219 €/mois en mensuel, 119 €/mois en annuel
        // (soit 1 428 € HT / an, ~46 % de remise sur l'engagement annuel).
        // 25 salariés inclus (était 15) pour mieux capter les PME en croissance.
        FlatPriceMonthlyEur: 219m,
        FlatPriceAnnualMonthlyEur: 119m,
        IncludedEmployees: 25,
        IncludedAdmins: 3,
        OverageRatePerEmployeeEur: 6.90m,
        MaxEmployees: 100,            // cap dur : 25 inclus + jusqu'à 75 supplémentaires
        // 2026-05 : Standard capé à 1 société / 1 filiale (avant : 3 sites). Le multi-filiales
        // devient un différenciateur exclusif Business pour clarifier le positionnement
        // commercial (Standard = PME mono-entité, Business = groupes multi-entités).
        MaxSocietes: 1,
        MaxSites: 1,
        StorageQuotaMb: 50L * 1024,   // 50 Go inclus
        StorageSupplementBlockEur: 29m, // +29 € / 100 Go supplémentaires
        MaxStorageMb: 300L * 1024,    // 300 Go max
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
        // Code interne « Premium » conservé pour compat ascendante (price_id Stripe,
        // tenants legacy, références dans EF et Stripe metadata). DisplayName commercial
        // 2026-05 = « Business » (cf. tarifs.txt). Cohérent avec le naming UI du Home /
        // PricingPage / ChangePlanModal qui affichent déjà « Business » à l'utilisateur.
        DisplayName: "Business",
        // Grille tarifs.txt 2026-05 : 449 €/mois en mensuel, 249 €/mois en annuel
        // (soit 2 988 € HT / an, ~45 % de remise sur l'engagement annuel).
        // 50 salariés inclus (était 30), cap pack 250 (était 200) — alignés sur le
        // positionnement « PME structurées + groupes multi-sites ».
        FlatPriceMonthlyEur: 449m,
        FlatPriceAnnualMonthlyEur: 249m,
        IncludedEmployees: 50,
        IncludedAdmins: null,         // administrateurs illimités
        OverageRatePerEmployeeEur: 9.90m,
        MaxEmployees: 250,            // cap dur : 50 inclus + jusqu'à 200 supplémentaires
        MaxSocietes: null,
        MaxSites: null,
        StorageQuotaMb: 200L * 1024,  // 200 Go inclus
        StorageSupplementBlockEur: 49m, // +49 € / 100 Go supplémentaires
        MaxStorageMb: 2048L * 1024,   // 2 To (= 2 048 Go) max
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
