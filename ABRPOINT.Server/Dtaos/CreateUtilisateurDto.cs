using System.ComponentModel.DataAnnotations;

namespace ABRPOINT.Server.Dtaos
{
    /// <summary>
    /// SEC — DTO dédié à la création d'utilisateur. Whitelist explicite des champs
    /// acceptés depuis le body HTTP.
    ///
    /// Avant : <c>AddUtilisateur</c> bindait directement l'entité <see cref="Models.Utilisateur"/>,
    /// qui contient des champs sensibles (UtiTwoFactorSecret, UtiTwoFactorEnabled,
    /// UtiResetCode, UtiResetCodeExpiry, UtiFailedLogins, UtiLockoutUntil, DeletedAt
    /// hérité de BaseEntity) qu'un admin malveillant ou un attaquant XSS dans le
    /// dashboard admin pouvait forcer en ajoutant simplement ces clés au JSON.
    ///
    /// Tout champ absent de ce DTO est silencieusement ignoré au binding.
    /// </summary>
    public sealed class CreateUtilisateurDto
    {
        [Required, StringLength(20)]
        public string Uticod { get; set; } = string.Empty;

        [StringLength(20)]
        public string? Utinom { get; set; }

        [StringLength(20)]
        public string? Utiprn { get; set; }

        /// <summary>Mot de passe en clair, hashé via BCrypt côté serveur avant persistance.</summary>
        [Required, StringLength(100, MinimumLength = 1)]
        public string Utimps { get; set; } = string.Empty;

        [StringLength(1)]
        public string? Utiactif { get; set; }

        /// <summary>"1" = admin tenant, "0" sinon. Seul un caller [Admin] peut le poser à "1".</summary>
        [StringLength(150)]
        public string? Utiadm { get; set; }

        [StringLength(100), EmailAddress]
        public string? Utimail { get; set; }

        [StringLength(500)]
        public string? Utiimg { get; set; }

        /// <summary>Rôle RBAC. Si null, le repository force "Employee" par défaut.</summary>
        [StringLength(50)]
        public string? Utirole { get; set; }

        /// <summary>Service affecté (socuser.sercod) — ex. service géré par un manager. Optionnel.</summary>
        [StringLength(4)]
        public string? Sercod { get; set; }
    }
}
