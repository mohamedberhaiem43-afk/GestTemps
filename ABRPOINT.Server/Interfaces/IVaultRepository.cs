using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Interfaces
{
    public interface IVaultRepository
    {
        Task<IEnumerable<DocumentVault>> GetDocumentsAsync(string soccod, string empcod);
        Task<IEnumerable<DocumentVault>> GetAllDocumentsBySocAsync(string soccod);
        Task<DocumentVault?> GetDocumentByIdAsync(int id);
        Task<DocumentVault> AddDocumentAsync(DocumentVault document);
        Task<DocumentVault> UpdateDocumentAsync(DocumentVault document);
        Task<bool> DeleteDocumentAsync(int id);
    }
}
