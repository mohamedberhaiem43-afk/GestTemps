using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models
{
    [Table("role_pointdroit")]
    public class RolePointdroit : BaseEntity
    {
        [Key]
        [Column("rpd_id")]
        public int RpdId { get; set; }

        [Column("rpd_role_id")]
        public int RpdRoleId { get; set; }

        [Required]
        [Column("rpd_poicod")]
        [StringLength(10)]
        public string RpdPoicod { get; set; } = string.Empty;

        [Required]
        [Column("rpd_soccod")]
        [StringLength(10)]
        public string RpdSoccod { get; set; } = string.Empty;

        [Column("rpd_lire")]
        [StringLength(1)]
        public string RpdLire { get; set; } = "0";

        [Column("rpd_purger")]
        [StringLength(1)]
        public string RpdPurger { get; set; } = "0";

        [Column("rpd_config")]
        [StringLength(1)]
        public string RpdConfig { get; set; } = "0";

        // Navigation
        [ForeignKey("RpdRoleId")]
        public Role? Role { get; set; }
    }
}