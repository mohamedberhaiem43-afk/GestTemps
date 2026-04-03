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

            return (true, "/uploads/" + fileName, null);
        }
    }
}


