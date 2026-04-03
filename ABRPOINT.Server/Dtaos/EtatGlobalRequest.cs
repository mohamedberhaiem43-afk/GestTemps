using ABRPOINT.Server.Dtaos;

public class EtatGlobalRequest
{
    public string soccod { get; set; }
    public string? soclib { get; set; }

    public DateTime datedebut { get; set; }
    public DateTime datefin { get; set; }

    public List<EtatGlobalData> data { get; set; }
}