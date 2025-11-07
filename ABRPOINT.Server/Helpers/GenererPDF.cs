namespace ABRPOINT.Helper
{
    public class GenererPDF
    {
        public GenererPDF()
        {
        }

        public string GetPath(string titre, int nF_No)
        {
            var WebRootPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var path = Path.Combine(WebRootPath, "NotesFraisRapports");
            //string path = Android.OS.Environment.ExternalStorageDirectory.AbsolutePath + "/NotesFrais";
            Directory.CreateDirectory(path);
            return Path.Combine(path, titre + nF_No + ".pdf");
        }
        public string GetPathDoc(string Matricule, string dos, string name)
        {
            var WebRootPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var path = Path.Combine(WebRootPath, dos);
            //string path = Android.OS.Environment.ExternalStorageDirectory.AbsolutePath + "/NotesFrais";
            Directory.CreateDirectory(path);
            return Path.Combine(path, name + " (" + Matricule + ").pdf");
        }

     
    }
}
