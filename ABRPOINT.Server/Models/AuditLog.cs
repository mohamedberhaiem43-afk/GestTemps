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

    // IP du client à l'origine de l'action — capturée via X-Forwarded-For ou
    // HttpContext.Connection.RemoteIpAddress. Limité à 45 chars pour couvrir un IPv6
    // complet (39) + suffixe scope éventuel.
    [StringLength(45)]
    public string? IpAddress { get; set; }
}
