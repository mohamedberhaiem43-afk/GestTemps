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
    // 2026-05-23 — Plafond ABSOLU supprimé : aucun pack ne plafonne le nombre
    // de salariés. Tous les packs facturent simplement l'overage au-delà de
    // `IncludedEmployees` via l'item Stripe user_supp. Le champ est gardé
    // nullable pour rétrocompat (anciens contrôleurs qui le lisent encore
    // → traités comme « illimité »).
    int? MaxEmployees,
    int? MaxSocietes,
    int? MaxSites,
    // Quota de stockage par tenant (Mo binaires, 1 Mo = 1 048 576 octets).
    // Grille 2026-05 (cf. tarifs.txt) :
    //   Starter   10 240 Mo →  10 Go inclus
    //   Standard  51 200 Mo →  50 Go inclus
    //   Premium  204 800 Mo → 200 Go inclus
    // Mesure = pg_database_size(DbName) + taille du dossier uploads/{slug}/, refresh hourly.
    long StorageQuotaMb,
    // Prix HT du bloc de stockage supplémentaire (29 € / 100 Go sur Starter/Standard,
    // 49 € / 100 Go sur Premium). Marketing : exposé sur la page tarifs et MonAbonnement.
    decimal StorageSupplementBlockEur,
    // Plafond ABSOLU du stockage (Mo). 2026-05-27 : null = pas de plafond commercial,
    // l'admin peut étendre via blocs de stockage supplémentaires autant que nécessaire.
    // Conservé nullable pour permettre de réintroduire un cap par pack si la stratégie
    // commerciale change.
    long? MaxStorageMb,
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
    bool AuthorizationManagement,
    // 2026-05-23 : modules métier facturables — exclus du Starter par défaut.
    // ExpenseReports         = saisie/validation des notes de frais (NoteDeFraisController).
    // BreastfeedingManagement = gestion des heures d'allaitement (AllaitementsController).
    // ContractManagement      = saisie/édition des contrats employés (ContratsController).
    // DocumentScanOcr         = scan OCR de pièces d'identité pour ajout d'un collaborateur
    //                           (DocumentScanController).
    // BulkImport             = imports en masse Excel pour toutes les données de base
    //                           (Services, Fonctions, Employés, Directions, Sections,
    //                           Villes, Pays, Qualifications, Rubriques — cf.
    //                           BulkImportController + ExcelImportButton côté front).
    bool ExpenseReports,
    bool BreastfeedingManagement,
    bool ContractManagement,
    bool DocumentScanOcr,
    bool BulkImport,
    // 2026-05-26 — Addon-only flags : aucun pack ne les active par défaut,
    // ils se débloquent UNIQUEMENT via les addons souscrits au signup
    // (apiAvancee → ApiAccess, supportPrioritaire → PrioritySupport).
    // Avant cette extension, ces deux addons étaient validés et facturés mais
    // restaient invisibles côté UI — le client payait pour rien de tangible.
    // ApiAccess         = sidebar "API & Intégrations" + endpoints d'API publique
    //                     (à implémenter par lots — pour l'instant juste la
    //                     visibilité du module pour signaler la souscription).
    // PrioritySupport   = badge "Prioritaire" sur le menu Support + canal de
    //                     contact dédié affiché dans SupportPage.
    bool ApiAccess,
    bool PrioritySupport,
    // 2026-06 — Assistant IA conversationnel (chatbot opérationnel /AIAssistant/chat : KPIs,
    // présence, congés, navigation). C'est l'addon self-service « Assistant RH IA » (aiAssistantRh),
    // DISTINCT du RAG documentaire (RagAi, /ChatRag/ask) qui reste « sur devis » (iaDocumentaireAvancee).
    // Défaut false → Starter/Standard ne l'ont pas sans l'addon. Premium l'inclut.
    bool AiChatbot = false);

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
        MaxEmployees: null,           // 2026-05-23 : plafond supprimé — overage facturé sans plafond
        MaxSocietes: 1,
        MaxSites: 1,
        StorageQuotaMb: 10L * 1024,   // 10 Go inclus
        StorageSupplementBlockEur: 29m, // +29 € / 100 Go supplémentaires
        MaxStorageMb: null,           // 2026-05-27 : plus de plafond, extension illimitée par blocs
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
            AuthorizationManagement: true,
            // Starter exclut explicitement les 5 modules métier avancés (l'import en
            // masse fait partie du package Standard pour cohérence avec la grille).
            ExpenseReports: false,
            BreastfeedingManagement: false,
            ContractManagement: false,
            DocumentScanOcr: false,
            BulkImport: false,
            // Addon-only — aucun pack ne les inclut, débloqués via addons souscrits.
            ApiAccess: false,
            PrioritySupport: false));

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
        MaxEmployees: null,           // 2026-05-23 : plafond supprimé — overage facturé sans plafond
        // Positionnement commercial 2026-05 :
        //   • Standard = 1 société (= 1 entité juridique), MULTI-SITES jusqu'à 5
        //     (= « multi-sites simple » promis sur la grille tarifaire — typique
        //     d'une PME avec siège + agences/dépôts). Au-delà → Business.
        //   • Business = multi-sociétés ET multi-sites illimités (groupes).
        MaxSocietes: 1,
        MaxSites: 5,
        StorageQuotaMb: 50L * 1024,   // 50 Go inclus
        StorageSupplementBlockEur: 29m, // +29 € / 100 Go supplémentaires
        MaxStorageMb: null,           // 2026-05-27 : plus de plafond, extension illimitée par blocs
        Features: new PlanFeatures(
            MobileApp: true,
            Geolocation: true,
            DigitalVault: true,
            ElectronicSignature: true,
            MultiSite: true,
            MultiSociete: false,
            AdvancedDashboards: true,
            RagAi: false,
            // 2026-05-23 — Journaux d'audit RÉSERVÉS au pack Business uniquement
            // (décision commerciale : différenciateur Business + Audit log = besoin
            // d'entreprises structurées, pas critique pour une PME en pack Standard).
            // Toute l'UI (sidebar « Journaux d'audit » + page /dashboard/audit-logs)
            // disparait pour Standard via `planAllows('advancedAuditLogs')`.
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
            AuthorizationManagement: true,
            // Modules métier inclus dès Standard.
            ExpenseReports: true,
            BreastfeedingManagement: true,
            ContractManagement: true,
            DocumentScanOcr: true,
            BulkImport: true,
            // Addon-only sur Standard (le tenant peut les ajouter explicitement).
            ApiAccess: false,
            PrioritySupport: false));

    public static readonly PlanDefinition Premium = new(
        Code: PremiumCode,
        // Code interne « Premium » conservé pour compat ascendante (price_id Stripe,
        // tenants legacy, références dans EF et Stripe metadata). DisplayName commercial
        // 2026-05-27 = « Premium » (était « Business » jusqu'au 2026-05-26 — décision
        // commerciale de réaligner le nom commercial sur le code interne). Tout l'UI
        // (Home / PricingPage / ChangePlanModal / MonAbonnement) lit ce displayName.
        DisplayName: "Premium",
        // Grille tarifs.txt 2026-05 : 449 €/mois en mensuel, 249 €/mois en annuel
        // (soit 2 988 € HT / an, ~45 % de remise sur l'engagement annuel).
        // 50 salariés inclus (était 30), cap pack 250 (était 200) — alignés sur le
        // positionnement « PME structurées + groupes multi-sites ».
        FlatPriceMonthlyEur: 449m,
        FlatPriceAnnualMonthlyEur: 249m,
        IncludedEmployees: 50,
        IncludedAdmins: null,         // administrateurs illimités
        OverageRatePerEmployeeEur: 9.90m,
        MaxEmployees: null,           // 2026-05-23 : plafond supprimé — overage facturé sans plafond
        MaxSocietes: null,
        MaxSites: null,
        StorageQuotaMb: 200L * 1024,  // 200 Go inclus
        StorageSupplementBlockEur: 49m, // +49 € / 100 Go supplémentaires
        MaxStorageMb: null,            // 2026-05-27 : plus de plafond, extension illimitée par blocs
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
            AuthorizationManagement: true,
            // Tout ce qui est métier est inclus dès Standard ; Premium ne fait que
            // l'hériter (différenciation Premium = multi-filiales / IA / sécurité).
            ExpenseReports: true,
            BreastfeedingManagement: true,
            ContractManagement: true,
            DocumentScanOcr: true,
            BulkImport: true,
            // Addon-only sur Premium aussi (le client doit explicitement souscrire,
            // c'est un service supplémentaire facturé en plus du pack).
            ApiAccess: false,
            PrioritySupport: false,
            // Premium inclut l'assistant IA conversationnel (aiAssistantRh bundlé).
            AiChatbot: true));

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
    /// 2026-05-23 : plafond absolu supprimé sur tous les packs payants. Retourne
    /// toujours <c>false</c> tant que <see cref="PlanDefinition.MaxEmployees"/>
    /// reste <c>null</c> (situation actuelle). Conservé pour rétrocompatibilité
    /// des appelants ; si un futur produit Enterprise réintroduit un plafond,
    /// il suffira de re-renseigner MaxEmployees sur le pack concerné.
    /// </summary>
    public static bool WouldExceedPlanMax(PlanDefinition plan, int currentActiveCount)
    {
        if (plan.MaxEmployees is not int maxCap) return false;
        return currentActiveCount >= maxCap;
    }

    /// <summary>
    /// Clés d'addons valides (cf. PlanPicker.tsx côté frontend). Toute clé hors de
    /// cette liste est silencieusement ignorée à l'agrégation — protège contre les
    /// chaînes parasites stockées en base (saisie manuelle, ancien addon retiré).
    /// </summary>
    public static readonly IReadOnlySet<string> ValidAddonKeys = new HashSet<string>(System.StringComparer.OrdinalIgnoreCase)
    {
        "aiAssistantRh",
        "iaDocumentaireAvancee",
        "signatureElectronique",
        "apiAvancee",
        "supportPrioritaire",
    };

    /// <summary>
    /// Parse la chaîne CSV des addons souscrits (cf. <see cref="Tenant.Addons"/>) en
    /// HashSet de clés valides. Tolère les espaces et le casing. Retourne un set vide
    /// si la chaîne est null/vide.
    /// </summary>
    public static HashSet<string> ParseAddons(string? csv)
    {
        var result = new HashSet<string>(System.StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(csv)) return result;
        foreach (var raw in csv.Split(new[] { ',', ';' }, System.StringSplitOptions.RemoveEmptyEntries))
        {
            var k = raw.Trim();
            if (ValidAddonKeys.Contains(k)) result.Add(k);
        }
        return result;
    }

    /// <summary>
    /// Calcule les <see cref="PlanFeatures"/> EFFECTIVES pour un tenant en combinant
    /// les features incluses dans son <paramref name="planCode"/> avec les addons
    /// souscrits (<paramref name="addonsCsv"/>). Mapping addon → flag :
    /// <list type="bullet">
    /// <item><c>aiAssistantRh</c>          → (plus aucun flag RAG — voir note RAG sur devis ci-dessous)</item>
    /// <item><c>iaDocumentaireAvancee</c>  → <c>RagAi = true</c> (addon RAG « sur devis »)</item>
    /// <item><c>signatureElectronique</c>  → <c>ElectronicSignature = true</c> ET <c>DigitalVault = true</c>
    ///   (cascade obligatoire : on ne peut pas signer sans coffre-fort pour stocker
    ///   les documents signés. Sans ce cascade, un client Starter qui souscrivait
    ///   signatureElectronique payait l'addon mais ne voyait rien apparaître dans
    ///   son espace — l'entrée sidebar "Coffre-fort" reste gatée par DigitalVault
    ///   qui restait false sur Starter.)</item>
    /// <item><c>apiAvancee</c>             → <c>ApiAccess = true</c></item>
    /// <item><c>supportPrioritaire</c>     → <c>PrioritySupport = true</c></item>
    /// </list>
    /// Tous les addons reconnus ont désormais un flag fonctionnel : la garantie produit
    /// est qu'un client qui paie un module optionnel le voit se matérialiser dans son
    /// espace (sidebar / badge). Retourne le record PlanFeatures à passer à <c>/me</c>.
    /// </summary>
    public static PlanFeatures GetEffectiveFeatures(string? planCode, string? addonsCsv)
    {
        var basePlan = GetPlan(planCode) ?? Starter;
        var feat = basePlan.Features;
        var addons = ParseAddons(addonsCsv);
        if (addons.Count == 0) return feat;

        // OR-merge : on ne RETIRE jamais une feature plan (les addons ne servent qu'à
        // débloquer en plus). Le with-expression record copy garantit l'immutabilité.
        // RAG = « sur devis » : débloqué UNIQUEMENT par l'addon négocié iaDocumentaireAvancee
        // (ou un plan l'incluant nativement). L'addon self-service aiAssistantRh (« Assistant RH IA »)
        // ne donne PLUS accès au RAG — décision produit 2026-06 : le RAG n'est pas inclus dans
        // l'aide RH, il reste commercialisé sur devis via iaDocumentaireAvancee.
        bool ragAi = feat.RagAi
            || addons.Contains("iaDocumentaireAvancee");

        bool hasSignAddon = addons.Contains("signatureElectronique");
        bool eSign = feat.ElectronicSignature || hasSignAddon;
        // Cascade : la signature électronique exige un coffre-fort pour héberger les
        // documents signés (cf. VaultController.Sign endpoint qui combine DigitalVault +
        // ElectronicSignature côté [RequirePlanFeature]). Si on n'active pas DigitalVault
        // en même temps, le bouton "Signer" reste injoignable sur Starter → addon mort.
        bool digitalVault = feat.DigitalVault || hasSignAddon;

        bool apiAccess = feat.ApiAccess || addons.Contains("apiAvancee");
        bool prioritySupport = feat.PrioritySupport || addons.Contains("supportPrioritaire");

        // Assistant IA conversationnel : débloqué par l'addon self-service aiAssistantRh.
        // Le RAG (sur devis) est un sur-ensemble fonctionnel → un tenant RAG a aussi le chatbot.
        bool aiChatbot = feat.AiChatbot || addons.Contains("aiAssistantRh") || ragAi;

        return feat with
        {
            RagAi = ragAi,
            ElectronicSignature = eSign,
            DigitalVault = digitalVault,
            ApiAccess = apiAccess,
            PrioritySupport = prioritySupport,
            AiChatbot = aiChatbot,
        };
    }
}
