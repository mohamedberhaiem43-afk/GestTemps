using System.Linq;
using System.Reflection;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace ABRPOINT.Server.Tests.Security;

/// <summary>
/// Audit automatisé d'autorisation par réflexion sur tous les contrôleurs du
/// projet serveur. But : attraper IMMEDIATEMENT — au build des tests — l'oubli
/// classique « j'ai créé un nouveau controller et oublié [Authorize] ».
///
/// Stratégie :
///   1. On scanne tous les types qui héritent de <see cref="ControllerBase"/>
///      dans l'assembly serveur.
///   2. Pour chaque controller, on regarde la combinaison des attributs au
///      niveau classe : [Authorize], [AllowAnonymous], ou un filtre custom
///      qui exige un user authentifié (ValidateSoccod, Admin, …).
///   3. On déclare valide :
///        a) [AllowAnonymous] explicite au niveau classe → endpoint public assumé.
///        b) [Authorize] au niveau classe → user authentifié exigé.
///        c) Filtre custom equivalent (ValidateSoccod, Admin) → user authentifié
///           exigé implicitement (le filtre rejette le User.NameIdentifier null).
///   4. Sinon le controller est ajouté à la liste des suspects.
///
/// Allowlist :
///   - <c>DownloadController</c> (téléchargement APK public, intentionnellement
///     anonyme — pas d'[AllowAnonymous] historique, à ajouter pour normaliser).
///   - <c>MobileAuthController</c> (endpoints d'auth eux-mêmes, par construction
///     accessibles sans token).
/// </summary>
public class ControllerAuthAuditTests
{
    /// <summary>
    /// Noms de controllers explicitement autorisés à ne pas avoir [Authorize] /
    /// [AllowAnonymous] au niveau classe. Toute addition ici doit être justifiée.
    ///
    /// Pattern accepté : la sécurité est gérée par méthode (chaque action a son propre
    /// [Authorize] / [AllowAnonymous] / [Admin]). Moins défensif que le class-level
    /// (un nouvel endpoint sans attribut serait public), mais acceptable quand le
    /// controller mixe auth flows (login = anonyme) et opérations authentifiées.
    /// </summary>
    private static readonly HashSet<string> AnonymousAllowlist = new(StringComparer.Ordinal)
    {
        // Téléchargement APK public — pas d'[AllowAnonymous] explicite pour rester
        // accessible aux scrapers d'install (Play Store v2 mid-roll, sites de mirroring).
        "DownloadController",
        // Endpoints d'auth — décorés [AllowAnonymous] par méthode et non par classe.
        "MobileAuthController",
        // Mix login (connect, refresh, forgot-password) + opérations authentifiées
        // (me, change-password). Chaque méthode déclare son propre [Authorize] /
        // [Admin], et les endpoints publics ont [EnableRateLimiting("auth-login")]
        // pour brider le brute-force. Recommandation future : remonter [Authorize]
        // au niveau classe et tagger [AllowAnonymous] les 5 endpoints publics.
        "UtilisateursController",
    };

    /// <summary>
    /// Types d'attributs custom qui exigent implicitement un user authentifié
    /// (ils rejettent si <c>User.FindFirst(NameIdentifier)</c> est null).
    /// Doivent être maintenus en sync avec
    /// <c>ABRPOINT.Server.Authorization.ValidateSoccodAttribute</c> et
    /// <c>ABRPOINT.Server.Annotations.AdminAttributes.AdminAttribute</c>.
    /// </summary>
    private static readonly string[] AuthEquivalentAttributeNames =
    {
        "ValidateSoccodAttribute",
        "AdminAttribute",
    };

    private static IEnumerable<Type> AllControllers()
    {
        // On utilise un type PUBLIC connu du serveur pour récupérer l'assembly.
        // typeof(Program) ne marche pas : le Program implicite de .NET 8 top-level
        // statements est internal et non visible depuis le projet de tests.
        var asm = typeof(ABRPOINT.Server.Tenancy.PlanCatalog).Assembly;
        return asm.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && typeof(ControllerBase).IsAssignableFrom(t));
    }

    [Fact]
    public void EveryController_DeclaresAuthOrAnonymousAtClassLevel()
    {
        var offenders = new List<string>();

        foreach (var ctl in AllControllers())
        {
            if (AnonymousAllowlist.Contains(ctl.Name)) continue;

            var attrs = ctl.GetCustomAttributes(inherit: true);
            var hasAuthorize = attrs.OfType<AuthorizeAttribute>().Any();
            var hasAnonymous = attrs.OfType<AllowAnonymousAttribute>().Any();
            var hasAuthEquivalent = attrs.Any(a => AuthEquivalentAttributeNames.Contains(a.GetType().Name));

            // Un controller couvert par un filtre custom est OK même sans [Authorize] :
            // les filtres custom rejettent les anonymous. Idéalement on cumule les deux
            // (defense-in-depth), mais on accepte l'un ou l'autre côté audit.
            if (!hasAuthorize && !hasAnonymous && !hasAuthEquivalent)
            {
                offenders.Add($"{ctl.FullName} (aucun [Authorize] / [AllowAnonymous] / filtre custom au niveau classe)");
            }
        }

        offenders.Should().BeEmpty(
            "tout controller doit déclarer explicitement son mode d'authentification au niveau classe — " +
            "soit [Authorize] (cas standard), soit [AllowAnonymous] (cas public assumé, ex: signup), " +
            "soit un filtre custom équivalent comme [ValidateSoccod] ou [Admin]. " +
            "Si vous ajoutez un nouveau controller public, ajoutez-le à AnonymousAllowlist ET justifiez " +
            "pourquoi il n'a pas [AllowAnonymous] explicite.");
    }

    /// <summary>
    /// Les controllers qui se déclarent <see cref="AllowAnonymousAttribute"/> au
    /// niveau classe ne doivent PAS lire <c>User.FindFirst(NameIdentifier)</c>
    /// sans vérifier la null-safety — ce qui ouvrirait la porte à un NRE en
    /// production. Plus important : ils ne doivent pas exposer accidentellement
    /// des opérations critiques. On le matérialise par un opt-in volontaire
    /// (cf. liste blanche ci-dessous), pour qu'ajouter un nouveau endpoint
    /// anonyme nécessite une revue.
    /// </summary>
    [Fact]
    public void AnonymousControllers_AreOnlyTheKnownPublicSurface()
    {
        // NB : on liste uniquement les controllers dont [AllowAnonymous] est posé
        // AU NIVEAU CLASSE. Les controllers comme BillingController, RagController ou
        // TenantPilotController qui ont [AllowAnonymous] sur certaines méthodes mais
        // [Authorize] au niveau classe ne sont PAS dans cette liste — leur surface
        // publique est cadrée méthode par méthode, pas globalement.
        var expected = new HashSet<string>(StringComparer.Ordinal)
        {
            "AuthLookupController",     // login lookup, mot de passe oublié
            "ContactController",        // formulaire public de contact (rate-limited)
            "SignupController",         // création tenant
            "StripeWebhookController",  // webhook entrant signé HMAC par Stripe
        };

        var actual = AllControllers()
            .Where(c => c.GetCustomAttributes(inherit: true).OfType<AllowAnonymousAttribute>().Any())
            .Select(c => c.Name)
            .ToHashSet();

        actual.Should().BeEquivalentTo(expected,
            "la surface publique (anonymous) doit rester strictement maîtrisée. " +
            "Si vous ajoutez intentionnellement un endpoint anonyme, ajoutez-le ici APRÈS " +
            "revue sécurité. Tout retrait inattendu est aussi un signal — vérifier qu'aucun " +
            "endpoint anonyme n'a été supprimé sans contrepartie d'auth.");
    }
}
