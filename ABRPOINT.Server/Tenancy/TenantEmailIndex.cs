using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Tenancy;

/// <summary>
/// Index global email → slug du tenant. Permet à la page de login (sur le domaine racine,
/// sans sous-domaine) de retrouver le tenant d'un utilisateur depuis son email avant
/// d'appeler /Utilisateurs/connect. Stocké dans la base master.
///
/// Email est unique : un même email ne peut appartenir qu'à un seul tenant. Si un humain
/// veut accéder à plusieurs tenants, il utilise des emails distincts.
/// </summary>
[Table("TenantEmailIndex")]
public class TenantEmailIndex
{
    [Key, MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [Required, MaxLength(30)]
    public string Slug { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
