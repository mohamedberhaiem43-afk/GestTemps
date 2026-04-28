namespace ABRPOINT.Server.Authorization;

/// <summary>
/// Source unique de vérité pour les modules fonctionnels et les rôles système du SaaS.
/// Les frontends + RolesController + ProvisioningService doivent référencer ces constantes
/// au lieu de hardcoder leurs propres listes.
/// </summary>
public static class PermissionCatalog
{
    // ─── Modules fonctionnels (utilisés en clé dans RolePermission.RpModule) ─────────
    public static class Modules
    {
        public const string AbsencesSanctions = "Absences et Sanctions";
        public const string PointageTemps = "Pointage et Temps";
        public const string GestionEmployes = "Gestion Employés";
        public const string ContratsAvenants = "Contrats et Avenants";
        public const string PaieRemuneration = "Paie et Rémunération";
        public const string GestionConges = "Gestion des Congés";
        public const string DonneesDeBase = "Données de Base";
        public const string ParametresTemps = "Paramètres de Temps";
        public const string RapportsStatistiques = "Rapports et Statistiques";
        public const string Administration = "Administration";

        public static readonly string[] All =
        {
            AbsencesSanctions, PointageTemps, GestionEmployes, ContratsAvenants,
            PaieRemuneration, GestionConges, DonneesDeBase, ParametresTemps,
            RapportsStatistiques, Administration,
        };
    }

    // ─── Rôles système (créés au provisioning, RoleIsSystem=true, non supprimables) ──
    public static class Roles
    {
        public const string Administrator = "Administrator";
        public const string Manager = "Manager";
        public const string Employee = "Employee";
    }

    // ─── Actions disponibles (utilisées pour comparer dans hasPermission côté UI) ────
    public static class Actions
    {
        public const string Consult = "consult";
        public const string Add = "add";
        public const string Modify = "modify";
        public const string Delete = "delete";
    }

    /// <summary>
    /// Modèle d'un rôle système (pour seed) : nom, description, couleur, et matrice de permissions.
    /// La matrice est { module → "CAMD" } où chaque caractère vaut '1' (autorisé) ou '0' (refusé)
    /// dans l'ordre Consult, Add, Modify, Delete.
    /// </summary>
    public sealed record SystemRoleSpec(string Name, string Description, string Color, IReadOnlyDictionary<string, string> Matrix);

    /// <summary>
    /// Trois rôles système livrés à chaque tenant. Personnalisables ensuite via l'UI Roles
    /// mais jamais supprimables (RoleIsSystem=true).
    /// </summary>
    public static IReadOnlyList<SystemRoleSpec> SystemRoles { get; } = new SystemRoleSpec[]
    {
        new(
            Roles.Administrator,
            "Accès complet à tous les modules. Gère les utilisateurs et les rôles.",
            "#dc2626", // rouge
            // Tout autorisé sur tous modules.
            Modules.All.ToDictionary(m => m, _ => "1111")
        ),
        new(
            Roles.Manager,
            "Supervision opérationnelle (employés, pointages, congés). Pas d'administration ni de paie.",
            "#2563eb", // bleu
            new Dictionary<string, string>
            {
                [Modules.AbsencesSanctions] = "1111",
                [Modules.PointageTemps] = "1111",
                [Modules.GestionEmployes] = "1110", // pas suppression
                [Modules.ContratsAvenants] = "1100", // consult + add
                [Modules.PaieRemuneration] = "1000", // consult seul
                [Modules.GestionConges] = "1111",
                [Modules.DonneesDeBase] = "1000",
                [Modules.ParametresTemps] = "1100",
                [Modules.RapportsStatistiques] = "1000",
                [Modules.Administration] = "0000",
            }
        ),
        new(
            Roles.Employee,
            "Utilisateur standard. Consultation uniquement de son propre dossier et des annonces.",
            "#16a34a", // vert
            new Dictionary<string, string>
            {
                [Modules.AbsencesSanctions] = "1000",
                [Modules.PointageTemps] = "1000",
                [Modules.GestionEmployes] = "0000",
                [Modules.ContratsAvenants] = "1000",
                [Modules.PaieRemuneration] = "0000",
                [Modules.GestionConges] = "1100", // consult + demande
                [Modules.DonneesDeBase] = "0000",
                [Modules.ParametresTemps] = "0000",
                [Modules.RapportsStatistiques] = "0000",
                [Modules.Administration] = "0000",
            }
        ),
    };

    /// <summary>True si le nom de rôle correspond à l'admin système.</summary>
    public static bool IsAdminRole(string? roleName) =>
        string.Equals(roleName, Roles.Administrator, StringComparison.OrdinalIgnoreCase);
}
