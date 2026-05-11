using System.Reflection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ABRPOINT.Server.Tenancy;

/// <summary>
/// Bloque l'accès au contrôleur/action si le plan du tenant courant n'a pas la
/// feature donnée. Retourne HTTP 402 avec un code stable que le front utilise
/// pour afficher le pop-up "Upgradez votre plan".
///
/// Usage :
/// <code>
/// [RequirePlanFeature(nameof(PlanFeatures.RagAi))]
/// public async Task&lt;IActionResult&gt; Ask(...) { ... }
/// </code>
///
/// Pendant l'essai (status=Trialing), on accorde TOUTES les features pour que
/// l'utilisateur puisse tester l'intégralité de la solution avant de choisir.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public sealed class RequirePlanFeatureAttribute : ActionFilterAttribute
{
    private readonly string _featureName;

    public RequirePlanFeatureAttribute(string featureName)
    {
        _featureName = featureName;
    }

    public override void OnActionExecuting(ActionExecutingContext ctx)
    {
        var current = ctx.HttpContext.RequestServices.GetService(typeof(ICurrentTenant)) as ICurrentTenant;
        var tenant = current?.Current;

        // Pendant l'essai, on accorde l'accès à toutes les features.
        if (TrialPolicy.IsTrialing(tenant))
        {
            base.OnActionExecuting(ctx);
            return;
        }

        var plan = PlanCatalog.GetPlan(tenant?.PlanCode);
        if (plan is null)
        {
            // Plan legacy / non défini → on laisse passer pour ne pas casser les tenants
            // créés avant l'introduction du gating. Migration manuelle attendue.
            base.OnActionExecuting(ctx);
            return;
        }

        var prop = typeof(PlanFeatures).GetProperty(_featureName, BindingFlags.Public | BindingFlags.Instance);
        if (prop is null)
        {
            // Erreur de configuration côté dev (nom de feature inexistant) : on log et
            // on laisse passer plutôt que de planter en prod.
            base.OnActionExecuting(ctx);
            return;
        }

        var enabled = (bool)(prop.GetValue(plan.Features) ?? false);
        if (!enabled)
        {
            ctx.Result = new ObjectResult(new
            {
                code = "plan_feature_locked",
                feature = _featureName,
                currentPlan = plan.Code,
                message = $"Cette fonctionnalité ({_featureName}) n'est pas incluse dans le plan {plan.DisplayName}. Upgradez pour y accéder.",
            })
            {
                StatusCode = StatusCodes.Status402PaymentRequired,
            };
            return;
        }

        base.OnActionExecuting(ctx);
    }
}
