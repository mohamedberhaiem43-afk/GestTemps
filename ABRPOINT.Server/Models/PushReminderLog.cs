using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Journal des rappels push envoyés à un employé pour un jour donné. Sert à la dédup
/// du PunctualityReminderHostedService (un seul rappel par {empcod, date, type}).
/// Persisté en DB pour survivre au redémarrage du serveur.
/// </summary>
[Table("push_reminder_log")]
public class PushReminderLog : BaseEntity
{
    [Key]
    [Column("prl_id")]
    public int Id { get; set; }

    [Required]
    [Column("empcod")]
    [StringLength(20)]
    public string Empcod { get; set; } = string.Empty;

    [Column("soccod")]
    [StringLength(15)]
    public string? Soccod { get; set; }

    /// <summary>"in" = rappel entrée, "out" = rappel sortie.</summary>
    [Required]
    [Column("type")]
    [StringLength(10)]
    public string Type { get; set; } = string.Empty;

    [Required]
    [Column("for_date")]
    public DateTime ForDate { get; set; }

    [Column("sent_at")]
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}
