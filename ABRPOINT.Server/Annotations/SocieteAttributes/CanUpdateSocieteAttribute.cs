namespace ABRPOINT.Server.Annotations.SocieteAttributes
{
    /// <summary>
    /// Permission pour modifier une société. Module « Données de Base » + action
    /// Modify. Voir <see cref="CanAddSocieteAttribute"/> pour le contexte.
    /// </summary>
    public class CanUpdateSocieteAttribute : PermissionAttribute
    {
        public CanUpdateSocieteAttribute() : base("base", "Modify") { }
    }
}
