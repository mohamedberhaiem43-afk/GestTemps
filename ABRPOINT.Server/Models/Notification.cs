using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Centre de notifications : chaque ligne représente une notification reçue par un utilisateur
/// (push envoyé via Expo, ou alerte interne). Permet à l'employé de consulter l'historique
/// même s'il a manqué le toast système.
/// </summary>
[Table("notifications")]
public class Notification : BaseEntity
{
    [Key]
    [Column("notif_id")]
    public int Id { get; set; }

    [Required]
    [Column("uticod")]
    [StringLength(20)]
    public string Uticod { get; set; } = string.Empty;

    [Column("soccod")]
    [StringLength(15)]
    public string? Soccod { get; set; }

    [Required]
    [Column("title")]
    [MaxLength(150)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [Column("body")]
    [MaxLength(500)]
    public string Body { get; set; } = string.Empty;

    /// <summary>Categorie pour grouper / filtrer (ex: "leave_request_accepted", "reminder_in").</summary>
    [Column("category")]
    [MaxLength(50)]
    public string? Category { get; set; }

    /// <summary>Payload JSON additionnel (objet sérialisé) pour la navigation deep-link.</summary>
    [Column("data_json")]
    public string? DataJson { get; set; }

    [Column("read_at")]
    public DateTime? ReadAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
