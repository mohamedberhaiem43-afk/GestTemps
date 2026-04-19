using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models
{
    [Table("roles")]
    public class Role : BaseEntity
    {
        [Key]
        [Column("role_id")]
        public int RoleId { get; set; }

        [Required]
        [Column("role_name")]
        [MaxLength(100)]
        public string RoleName { get; set; } = string.Empty;

        [Column("role_description")]
        [MaxLength(255)]
        public string? RoleDescription { get; set; }

        [Column("role_color")]
        [MaxLength(20)]
        public string? RoleColor { get; set; }

        [Column("role_is_system")]
        public bool RoleIsSystem { get; set; } = false;

        [Column("role_created_at")]
        public DateTime RoleCreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation property
        public List<RolePermission>? Permissions { get; set; }
        public List<RolePointdroit>? Pointdroits { get; set; }
    }
}