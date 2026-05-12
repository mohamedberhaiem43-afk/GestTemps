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
}
