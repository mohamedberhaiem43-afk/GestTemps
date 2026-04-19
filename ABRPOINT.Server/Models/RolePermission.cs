using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models
{
    [Table("role_permissions")]
    public class RolePermission : BaseEntity
    {
        [Key]
        [Column("rp_id")]
        public int RpId { get; set; }

        [Column("rp_role_id")]
        public int RpRoleId { get; set; }

        [Required]
        [Column("rp_module")]
        [MaxLength(100)]
        public string RpModule { get; set; } = string.Empty;

        [Column("rp_consult")]
        public string RpConsult { get; set; } = "0";

        [Column("rp_add")]
        public string RpAdd { get; set; } = "0";

        [Column("rp_modify")]
        public string RpModify { get; set; } = "0";

        [Column("rp_delete")]
        public string RpDelete { get; set; } = "0";

        // Navigation property
        [ForeignKey("RpRoleId")]
        public Role? Role { get; set; }
    }
}