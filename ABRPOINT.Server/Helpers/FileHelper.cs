namespace ABRPOINT.Server.Helpers
{
    public static class FileHelper
    {
        public static string GetUploadsPath()
        {
            var inDocker = Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER") == "true";
            var path = inDocker
                ? "/app/uploads"
                : Path.Combine(Directory.GetCurrentDirectory(), "uploads");

            Console.WriteLine($"[FileHelper] Uploads path: {path}"); // verify in logs
            return path;
        }

        public static async Task<(bool Success, string FilePath, string Error)> SaveFile(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return (false, null, "No file uploaded.");

            var uploads = GetUploadsPath();
            Directory.CreateDirectory(uploads);

            var fileName = Guid.NewGuid() + Path.GetExtension(file.FileName);
            var filePath = Path.Combine(uploads, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return (true, "/api/uploads/" + fileName, null);
        }

        public static async Task<(bool Success, string FilePath, string Error)> SaveBase64Image(string base64Data)
        {
            try
            {
                if (string.IsNullOrEmpty(base64Data)) return (false, null, "No data.");
                
                // Data format: "data:image/png;base64,....." or "drawn:data:..." or "phrase:..."
                string pureBase64 = base64Data;
                if (base64Data.Contains(",")) pureBase64 = base64Data.Split(',')[1];
                else if (base64Data.Contains(":")) pureBase64 = base64Data.Split(':')[1];

                var bytes = Convert.FromBase64String(pureBase64);
                var uploads = GetUploadsPath();
                Directory.CreateDirectory(uploads);
                
                var fileName = "sig_" + Guid.NewGuid() + ".png";
                var filePath = Path.Combine(uploads, fileName);
                
                await File.WriteAllBytesAsync(filePath, bytes);
                return (true, "/api/uploads/" + fileName, null);
            }
            catch (Exception ex)
            {
                return (false, null, ex.Message);
            }
        }
    }
}
