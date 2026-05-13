using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Tenancy;

/// <summary>
/// Tenant (= client SaaS) stocké dans la base "master" (control plane).
/// Chaque tenant pointe vers sa propre base de données SQL Server.
/// </summary>
[Table("Tenants")]
public class Tenant
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Slug URL (sous-domaine). Ex: "acme" → acme.concorde.com. Lowercase, [a-z0-9-]{3,30}.</summary>
    [Required, MaxLength(30)]
    public string Slug { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string CompanyName { get; set; } = string.Empty;

    /// <summary>Nom de la base SQL Server (ex: tenant_acme_a1b2c3d4).</summary>
    [Required, MaxLength(64)]
    public string DbName { get; set; } = string.Empty;

    /// <summary>Provisioning, Trialing, Active, PastDue, Suspended, Cancelled, Failed.</summary>
    [Required, MaxLength(20)]
    public string Status { get; set; } = "Provisioning";

    [MaxLength(150)]
    public string? AdminEmail { get; set; }

    /// <summary>
    /// Numéro SIRET de l'entreprise (14 chiffres). Saisi à l'inscription et vérifié contre
    /// l'API gouvernementale recherche-entreprises.api.gouv.fr. Sert de clé anti-fraude :
    /// un même SIRET ne peut pas obtenir plusieurs essais gratuits (un seul tenant
    /// Trialing/Active par SIRET hors lignes Failed et Cancelled-au-delà-rétention).
    /// Nullable pour préserver la rétro-compat avec les tenants legacy créés avant 2026-05.
    /// </summary>
    [MaxLength(14)]
    public string? Siret { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? TrialEndsAt { get; set; }

    [MaxLength(64)]
    public string? StripeCustomerId { get; set; }

    [MaxLength(64)]
    public string? StripeSubscriptionId { get; set; }

    [MaxLength(20)]
    public string Region { get; set; } = "eu-fr";

    public bool OnboardingCompleted { get; set; } = false;

    /// <summary>Soccod hérité (pour compat avec le code existant qui filtre toujours par Soccod). Court (≤6).</summary>
    [MaxLength(6)]
    public string? LegacySoccod { get; set; }

    /// <summary>
    /// Code du plan souscrit : Starter | Standard | Premium. null = pas encore choisi (legacy/dev).
    /// L'ancien libellé "Essentiel" reste accepté en lecture par PlanCatalog.Normalize pour
    /// rétro-compat avec les tenants créés avant 2026-05.
    /// </summary>
    [MaxLength(20)]
    public string? PlanCode { get; set; }

    /// <summary>
    /// Date d'envoi du rappel "fin d'essai imminente" (J-4 par défaut) aux admins et
    /// managers du tenant. Null = jamais envoyé. Sert d'anti-doublon pour la sweep
    /// horaire — on n'envoie le rappel qu'une seule fois par essai même si le job
    /// passe plusieurs fois dans la fenêtre J-4 / J-3.
    /// </summary>
    public DateTime? TrialReminderSentAt { get; set; }

    /// <summary>
    /// Date à laquelle l'utilisateur a demandé la résiliation (immédiate ou fin de période).
    /// Null = aucune résiliation en cours. Permet l'audit/affichage côté UI.
    /// </summary>
    public DateTime? CancellationRequestedAt { get; set; }

    /// <summary>
    /// Si true : la résiliation a été planifiée pour la fin de la période en cours
    /// (l'abonnement Stripe reste actif jusqu'à <see cref="CurrentPeriodEndsAt"/>).
    /// Si false : résiliation immédiate (l'abonnement Stripe est annulé tout de suite,
    /// le tenant bascule en "Cancelled" et perd l'accès).
    /// </summary>
    public bool CancelAtPeriodEnd { get; set; } = false;

    /// <summary>
    /// Fin de la période de facturation Stripe en cours — synchronisé via webhook
    /// customer.subscription.updated. Sert d'affichage UI ("Vous garderez l'accès jusqu'au …").
    /// </summary>
    public DateTime? CurrentPeriodEndsAt { get; set; }
}
