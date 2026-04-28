using System.ComponentModel.DataAnnotations;

namespace ABRPOINT.Server.Dtaos
{
    public class UserLoginModel
    {
        [Required]
        [StringLength(150)]
        public string? Utimail { get; set; }
        // Pas de StringLength : un mot de passe peut dépasser 10 caractères ; BCrypt côté serveur
        // gère n'importe quelle longueur.
        [Required]
        public string? Utimps { get; set; }
        [StringLength(2)]
        public string? Usersit { get; set; }
        [StringLength(15)]
        public string? Company { get; set; }
    }

}
