namespace ABRPOINT.Server.Authorization;

/// <summary>
/// Source unique des catégories de notification connues. Utilisée par :
///   - UserNotificationService pour filtrer selon les préférences user.
///   - L'endpoint GET preferences pour proposer la liste à l'UI.
///   - Les frontends (web + mobile) qui consomment le mapping libellé/icône.
///
/// Une catégorie absente ici reste fonctionnelle (envoyée par défaut) mais ne sera pas
/// proposée dans l'UI de préférences. Ajouter ici dès qu'on introduit un nouveau type.
/// </summary>
public static class NotificationCategoryCatalog
{
    public sealed record CategorySpec(string Code, string Label, string Description, string Group);

    public const string GroupReminders = "reminders";
    public const string GroupLeaves = "leaves";
    public const string GroupAuthorizations = "authorizations";
    public const string GroupPunctuality = "punctuality";
    public const string GroupSystem = "system";

    public static IReadOnlyList<CategorySpec> All { get; } = new CategorySpec[]
    {
        new("reminder_in",            "Rappel pointage entrée",     "M'avertir si j'ai oublié de pointer mon entrée.",        GroupReminders),
        new("reminder_out",           "Rappel pointage sortie",     "M'avertir si j'ai oublié de pointer ma sortie.",         GroupReminders),
        new("leave_request_created",  "Nouvelle demande de congé",  "Pour les managers : nouvelle demande à valider.",        GroupLeaves),
        new("leave_request_accepted", "Congé accepté",              "Confirmation quand ma demande de congé est acceptée.",   GroupLeaves),
        new("leave_request_refused",  "Congé refusé",               "Confirmation quand ma demande de congé est refusée.",    GroupLeaves),
        new("auth_request_created",   "Nouvelle autorisation",      "Pour les managers : nouvelle autorisation à valider.",   GroupAuthorizations),
        new("auth_request_accepted",  "Autorisation acceptée",      "Confirmation quand ma demande d'autorisation est acceptée.", GroupAuthorizations),
        new("auth_request_refused",   "Autorisation refusée",       "Confirmation quand ma demande d'autorisation est refusée.",  GroupAuthorizations),
        new("late_arrival",           "Retard de pointage",         "Pour les managers/RH : un collaborateur a pointé en retard.", GroupPunctuality),
        new("early_leave",            "Départ anticipé",            "Pour les managers/RH : un collaborateur a pointé sa sortie en avance.", GroupPunctuality),
        new("test_push",              "Notification de test",       "Notification de test envoyée par un administrateur.",    GroupSystem),
    };

    public static bool IsKnown(string? category)
        => !string.IsNullOrEmpty(category) && All.Any(c => string.Equals(c.Code, category, StringComparison.OrdinalIgnoreCase));
}
