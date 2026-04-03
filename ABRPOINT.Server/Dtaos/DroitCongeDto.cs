namespace ABRPOINT.Server.Dtaos
{
    public class DroitCongeDto
    {
        public string? Empmat { get; set; }
        public string? Emplib { get; set; }
        public string? Empreg { get; set; }
        public DateTime? Empemb { get; set; }
        public string? Annee { get; set; }
        public float? Soldeinit { get; set; }
        public float? Droitconge { get; set; }
        public float? Jourancien { get; set; }
        public float? Nbconges { get; set; }
        public float? Nbcongerecu { get; set; }
        public float? Nbabsences { get; set; }
        public float? Droitrestant { get; set; }
        public IDictionary<string,float?>? Nbcongerecuparmois { get; set; }
        public IDictionary<string,float?>? Nbabsenceparmois { get; set; }
    }
}
