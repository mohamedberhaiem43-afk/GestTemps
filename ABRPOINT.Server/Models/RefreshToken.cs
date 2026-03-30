using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

[Table("refresh_tokens")]
public class RefreshToken
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("uticod")]
    [StringLength(20)]
    public string? Uticod { get; set; }

    [Required]
    [Column("token")]
    [StringLength(500)]
    public string? Token { get; set; }

    [Required]
    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("revoked")]
    public bool Revoked { get; set; } = false;
}
