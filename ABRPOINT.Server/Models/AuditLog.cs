using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

[Table("AuditLog")]
public class AuditLog
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [StringLength(20)]
    public string? Uticod { get; set; }

    [StringLength(100)]
    public string? Action { get; set; }

    [StringLength(100)]
    public string? TableName { get; set; }

    public DateTime DateAction { get; set; } = DateTime.UtcNow;

    public DateTime? CreatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime? RetentionDate { get; set; }
}
