
namespace ABRPOINT.Server.Dtaos
{
    public class RubriqueDto
    {
        public string? Rubcod { get; set; }
        public string? Soccod { get; set; }
        public string? Rublib { get; set; }
        // ⚠ Avant ce correctif, le DTO retourné par GET /api/Rubriques/{soccod} n'exposait
        // que Rubcod/Soccod/Rublib. Conséquence : sur RubriqueModern, le tableau affichait
        // "—" pour Unité et Variable de pointage, et le formulaire d'édition affichait des
        // selects vides — même quand la rubrique avait des valeurs valides en base. L'export
        // « Intégration Paie » lit via /get-paires/{soccod} (RubriquePaireDto, qui contient
        // déjà ces champs) → l'utilisateur pouvait croire que ses rubriques étaient vides.
        public string? Rubunite { get; set; }
        public string? Vartype { get; set; }
        public string? Rubregime { get; set; }
        public float? Rubtaux { get; set; }

    }
    public class RubriquePaireDto
    {
        public string? Rubcod { get; set; }
        public string? Soccod { get; set; }
        public string? Rublib { get; set; }
        public string? Vartype { get; set; }
        public string? Rubunite { get; set; }
        public string? Rubregime { get; set; }

    }
}
