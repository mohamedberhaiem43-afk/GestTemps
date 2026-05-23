namespace ABRPOINT.Server.Annotations.SocieteAttributes
{
    /// <summary>
    /// Permission pour supprimer une société. Module « Données de Base » + action
    /// Delete. Voir <see cref="CanAddSocieteAttribute"/> pour le contexte.
    /// </summary>
    public class CanDeleteSocieteAttribute : PermissionAttribute
    {
        public CanDeleteSocieteAttribute() : base("base", "Delete") { }
    }
}
