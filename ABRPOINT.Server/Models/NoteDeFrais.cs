using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models
{
    [Table("notedefrais")]
    public partial class NoteDeFrais : BaseEntity
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("soccod")]
        [StringLength(6)]
        public string Soccod { get; set; } = null!;

        [Required]
        [Column("empcod")]
        [StringLength(12)]
        public string Empcod { get; set; } = null!;

        [Required]
        [Column("titre")]
        [StringLength(100)]
        public string Titre { get; set; } = null!;

        [Required]
        [Column("categorie")]
        [StringLength(50)]
        public string Categorie { get; set; } = null!;

        [Column("montant")]
        public double Montant { get; set; }

        [Column("projet")]
        [StringLength(100)]
        public string? Projet { get; set; }

        /// <summary>
        /// Mission rattachée (FK vers gt_mission.id). Toute note de frais doit pointer
        /// sur une mission validée — c'est elle qui porte la nature d'absence
        /// "Formation et mission" (abscng="6") qui sert au rapprochement paie.
        /// </summary>
        [Required]
        [Column("missionid")]
        public int MissionId { get; set; }

        [ForeignKey(nameof(MissionId))]
        public virtual Mission? Mission { get; set; }

        [Column("datedepense", TypeName = "datetime")]
        public DateTime DateDepense { get; set; }

        [Column("justificatif")]
        [StringLength(255)]
        public string? Justificatif { get; set; }

        [Column("etat")]
        [StringLength(20)]
        public string Etat { get; set; } = "Pending"; // Pending, Approved, Reimbursed, Rejected

        /// <summary>
        /// Code ISO 4217 de la devise (EUR, USD, TND, MAD, GBP…). NULL = devise
        /// tenant par défaut (côté client, EUR par défaut). Sert à éviter de
        /// figer toutes les notes en EUR pour les déplacements internationaux.
        /// </summary>
        [Column("devise")]
        [StringLength(3)]
        public string? Devise { get; set; }
    }
}
