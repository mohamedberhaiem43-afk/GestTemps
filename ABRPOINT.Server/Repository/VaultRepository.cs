using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class VaultRepository : IVaultRepository
    {
        private readonly ApplicationDbContext _dbContext;

        public VaultRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<IEnumerable<DocumentVault>> GetDocumentsAsync(string soccod, string empcod)
        {
            return await _dbContext.DocumentVaults
                .Where(d => d.Soccod == soccod && d.Empcod == empcod)
                .OrderByDescending(d => d.DocDate)
                .ToListAsync();
        }

        public async Task<IEnumerable<DocumentVault>> GetAllDocumentsBySocAsync(string soccod)
        {
            return await _dbContext.DocumentVaults
                .Where(d => d.Soccod == soccod)
                .OrderByDescending(d => d.DocDate)
                .ToListAsync();
        }

        public async Task<DocumentVault?> GetDocumentByIdAsync(int id)
        {
            return await _dbContext.DocumentVaults.FindAsync(id);
        }

        public async Task<DocumentVault> AddDocumentAsync(DocumentVault document)
        {
            await _dbContext.DocumentVaults.AddAsync(document);
            await _dbContext.SaveChangesAsync();
            return document;
        }

        public async Task<DocumentVault> UpdateDocumentAsync(DocumentVault document)
        {
            _dbContext.DocumentVaults.Update(document);
            await _dbContext.SaveChangesAsync();
            return document;
        }

        public async Task<bool> DeleteDocumentAsync(int id)
        {
            var doc = await _dbContext.DocumentVaults.FindAsync(id);
            if (doc == null) return false;

            _dbContext.DocumentVaults.Remove(doc);
            await _dbContext.SaveChangesAsync();
            return true;
        }
    }
}
