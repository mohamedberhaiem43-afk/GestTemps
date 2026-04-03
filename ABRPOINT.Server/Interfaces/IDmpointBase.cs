namespace ABRPOINT.Server.Interfaces
{
    public interface IDmpointBase
    {
        string Empcod { get; }
        DateTime Dmdat { get; }
        DateTime? Dmhre { get; }
        string Soccod { get; }
        string Dmlue { get; set; }
    }
}
