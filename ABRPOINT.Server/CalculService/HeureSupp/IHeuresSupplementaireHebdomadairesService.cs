namespace ABRPOINT.Server.CalculService.HeureSupp
{
    public interface IHeuresSupplementaireHebdomadairesService
    {
        Task<HeuresSupplementairesResultat> CalculerHeuresSupplementairesHebdomadaires(string soccod,string empcod,string mois,
            string annee, string semaine,string empreg,string empniveau);
        Task<List<HeuresSupplementairesResultat>> CalculerHeuresSupplementairesMultiSemaines(string soccod, string empcod, string mois, string annee,string empreg, string empniveau);
    }
}
