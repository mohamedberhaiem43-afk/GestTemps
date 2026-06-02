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
    /// Identifiant entreprise (SIRET FR / BCE BE / ICE MA / NINEA SN). Le format dépend
    /// de <see cref="CountryCode"/>. Sert de clé anti-fraude : un même ID ne peut pas
    /// obtenir plusieurs essais gratuits (un seul tenant Trialing/Active par ID hors lignes
    /// Failed et Cancelled-au-delà-rétention). Stocké en NVARCHAR(20) pour accommoder le
    /// plus long format (ICE 15 chiffres). Nullable pour rétro-compat tenants legacy.
    /// </summary>
    [MaxLength(20)]
    public string? Siret { get; set; }

    /// <summary>
    /// Code pays ISO 3166-1 alpha-2 : FR / BE / MA / SN. Détermine le format attendu pour
    /// <see cref="Siret"/> et l'API de validation utilisée au signup. Nullable = legacy
    /// (avant le support multi-pays) → traité comme "FR" par défaut côté code.
    /// </summary>
    [MaxLength(2)]
    public string? CountryCode { get; set; }

    /// <summary>
    /// Secteur d'activité de l'entreprise (libellé libre, ex: « Conseil pour les
    /// affaires et autres conseils de gestion »). Pour les pays disposant d'une API
    /// publique de répertoire (FR Sirene, BE BCE), le champ est pré-rempli au signup
    /// avec l'activité principale renvoyée par l'API. Le tenant peut le surcharger
    /// manuellement. Sert au profilage commercial (segmenter les comm/onboarding par
    /// vertical métier) et au routing IA (prompts adaptés à un BTP vs un cabinet
    /// d'audit). Optionnel — un signup ancien sans ce champ reste valide.
    /// </summary>
    [MaxLength(200)]
    public string? ActivitySector { get; set; }

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

    /// <summary>
    /// Stockage consommé par le tenant (en Mo binaires = 1 048 576 octets). Somme de :
    ///   - <c>pg_database_size(DbName)</c> (taille on-disk de la base PG du tenant)
    ///   - taille récursive du dossier <c>uploads/{slug}/</c> (fichiers utilisateurs)
    /// Refresh horaire par <c>StorageUsageHostedService</c>. 0 tant que jamais mesuré.
    /// Comparé à <see cref="PlanCatalog.GetStorageQuotaMb(string?)"/>(PlanCode) côté guard.
    /// </summary>
    public long StorageUsedMb { get; set; } = 0;

    /// <summary>
    /// Timestamp du dernier passage du job de mesure de stockage. Null = jamais mesuré
    /// (tenant fraîchement créé, le job rattrape au prochain tour). Affiché en UI sous
    /// la jauge "X Go / Y Go — dernière mesure il y a N minutes".
    /// </summary>
    public DateTime? StorageUsageCheckedAt { get; set; }

    /// <summary>
    /// Nombre de blocs de stockage supplémentaires achetés (1 bloc = 100 Go, cf.
    /// <see cref="PlanCatalog.ExtraStorageBlockMb"/>). Incrémenté par le webhook
    /// <c>checkout.session.completed</c> quand le module « Stockage supplémentaire 100 Go »
    /// est payé via son Payment Link (price <c>Storage:block100Go:monthly</c>). Le quota
    /// effectif du tenant = quota du pack + <c>ExtraStorageBlocks × 100 Go</c>
    /// (cf. <see cref="PlanCatalog.GetStorageQuotaMb(string?, int)"/> consommé par
    /// <c>StorageQuotaGuard</c>). 0 par défaut.
    /// </summary>
    public int ExtraStorageBlocks { get; set; } = 0;

    /// <summary>
    /// Sièges (collaborateurs supplémentaires) pré-achetés via un <b>Payment Link dédié</b>
    /// « Collaborateur supplémentaire pack {plan} » — chacun facturé par son PROPRE abonnement
    /// Stripe (≠ l'item <c>user_supp</c> de l'abonnement de pack). Incrémenté par le webhook
    /// <c>checkout.session.completed</c> quand un tel abonnement autonome est payé.
    /// Conséquences :
    ///   • le seuil d'overage de création d'employé est relevé de ce montant
    ///     (cf. <c>EmployesController.Post</c>) ;
    ///   • <c>StripeBillingService.SyncSupplementaryEmployeesAsync</c> RETIRE ce montant de
    ///     l'overage facturé sur l'abonnement de pack → pas de double-facturation.
    /// 0 par défaut.
    /// </summary>
    public int LinkPurchasedSeats { get; set; } = 0;

    /// <summary>
    /// Modules optionnels souscrits (ajoutés au-delà des features incluses dans
    /// <see cref="PlanCode"/>). Liste de clés en CSV, ex.
    /// <c>"aiAssistantRh,signatureElectronique,apiAvancee"</c>.
    /// Valeurs valides : aiAssistantRh, iaDocumentaireAvancee, signatureElectronique,
    /// apiAvancee, supportPrioritaire (cf. AddonKey côté frontend PlanPicker).
    /// Mergé avec PlanFeatures dans <see cref="PlanCatalog.GetEffectiveFeatures"/>
    /// pour produire les features effectives renvoyées à /me.
    /// Null = pas d'addons souscrits.
    /// </summary>
    [MaxLength(200)]
    public string? Addons { get; set; }

    /// <summary>
    /// Date d'envoi du rappel "renouvellement abonnement imminent" (J-7 par défaut)
    /// aux admins du tenant. Null = jamais envoyé pour la période en cours. Sert
    /// d'anti-doublon pour la sweep horaire — on n'envoie le rappel qu'une fois par
    /// période. Reset implicite à chaque nouvelle période (webhook
    /// customer.subscription.updated met à jour CurrentPeriodEndsAt → la nouvelle
    /// fenêtre J-7 sera distincte, donc TrialReminderSentAt redevient < new window).
    /// Comparé à <see cref="CurrentPeriodEndsAt"/>.
    /// </summary>
    public DateTime? SubscriptionRenewalReminderSentAt { get; set; }
}
