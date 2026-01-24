namespace ABRPOINT.Server.Dtaos
{
    public class PresenceSemaineData
    {
        public float? TotalHours { get; set; }
        public float? TotalRetards { get; set; }
        public float? TotalAbsence { get; set; }
        public string? Caltype { get; set; }
        public int? Panier { get; set; }
        public int? NbNuits { get; set; }
        public float? HreNuits { get; set; }
        public float? NbhFerierTrv { get; set; }
        public float? HreFerier { get; set; }
        public int? NbJourFerier { get; set; }
        public float? NbhAllaitement { get; set; }
        public int? NbJourPointer { get; set; }
        public float? NbJourCngPaye { get; set; }
        public float? NbJourConge { get; set; }
        public float? NbHeureConge { get; set; }
        public float? HeureRepos { get; set; }
        public IDictionary<string, float> WorkDayHours { get; set; }
        public int JourRepos { get; set; }
        public float? Deplacement { get; set; }
        public float? NbJours { get; set; }
        public float? ACT { get; set; }
        public float? CSS { get; set; }
        public float? CSF { get; set; }
        public float? HCSF { get; set; }
        public float? Maladie { get; set; }
        public float? MAP { get; set; }
        public float? FM { get; set; }
        public float? Absnj { get; set; }
        public float? Absj { get; set; }
        public float? Absnp { get; set; }
        public float? CT { get; set; }
        public float? JourSamediTrv { get; set; }
        public float? HreDimTrv { get; set; }
        public float? HreSamediTrv { get; set; }
        public float? ResHreSamediTrv { get; set; }
        public float? NbHeuresDebutCalcul { get; set; }
        public IDictionary<string, string> WeekDetails { get; set; }
    }
}
