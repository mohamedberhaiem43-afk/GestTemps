using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Base entity with RGPD compliance fields: CreatedAt, DeletedAt, RetentionDate.
/// All entities inheriting from this support soft-delete and data retention tracking.
/// </summary>
public abstract class BaseEntity
{
    [Column("created_at", TypeName = "datetime")]
    public DateTime? CreatedAt { get; set; }

    [Column("deleted_at", TypeName = "datetime")]
    public DateTime? DeletedAt { get; set; }

    [Column("retention_date", TypeName = "datetime")]
    public DateTime? RetentionDate { get; set; }
}