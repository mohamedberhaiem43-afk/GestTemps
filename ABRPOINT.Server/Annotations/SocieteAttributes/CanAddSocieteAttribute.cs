namespace ABRPOINT.Server.Annotations.SocieteAttributes
{
    /// <summary>
    /// Permission pour créer une société. Module « Données de Base » (code interne
    /// <c>base</c> dans <see cref="Helpers.PermissionChecker"/>) + action Add.
    /// Avant ajout (2026-05-23) : POST /api/Societes était <c>[Authorize]</c> nu
    /// → tout utilisateur authentifié pouvait créer une société tant que le
    /// plafond plan le permettait. Désormais gated par la matrice CAMD.
    /// </summary>
    public class CanAddSocieteAttribute : PermissionAttribute
    {
        public CanAddSocieteAttribute() : base("base", "Add") { }
    }
}
