using System.Security.Cryptography;
using System.Text;

namespace ABRPOINT.Server.Services
{
    /// <summary>
    /// SEC — Chiffre/déchiffre les secrets TOTP stockés en base (colonne
    /// <c>UtiTwoFactorSecret</c>). Avant cette protection, le secret Base32 était
    /// stocké en clair dans le NVARCHAR DB ; un attaquant qui obtenait un dump
    /// SQL régénérait immédiatement les codes 2FA de tous les comptes —
    /// effondrement complet de la 2FA sans aucun élément de signature à fournir.
    ///
    /// Clé dérivée de <c>Encryption:AesKey</c> via HKDF SHA-256 avec un label
    /// constant "2fa-totp". Une compromission de la clé principale n'expose pas
    /// directement les secrets 2FA (la dérivation HKDF n'est pas inversible), et
    /// inversement. Le format de stockage est compatible AES-GCM (cf.
    /// <see cref="EncryptionService"/>) :
    ///   "2fa:v1:" + base64(nonce[12] || cipher || tag[16])
    ///
    /// Lecture rétrocompatible : si le secret stocké ne porte pas le préfixe, on
    /// considère qu'il est en clair (historique pré-protection) et on le renvoie tel
    /// quel. À la prochaine ré-activation 2FA il sera ré-écrit chiffré.
    /// </summary>
    public sealed class TwoFactorSecretProtector
    {
        private const string Prefix = "2fa:v1:";
        private const int NonceSize = 12;
        private const int TagSize = 16;

        private readonly byte[] _key;

        public TwoFactorSecretProtector(IConfiguration configuration)
        {
            var masterKey = configuration["Encryption:AesKey"]
                ?? throw new InvalidOperationException("Encryption:AesKey not configured");

            // HKDF-SHA256(IKM=masterKey, info="2fa-totp", L=32 bytes)
            var ikm = Encoding.UTF8.GetBytes(masterKey);
            _key = HKDF.DeriveKey(
                hashAlgorithmName: HashAlgorithmName.SHA256,
                ikm: ikm,
                outputLength: 32,
                salt: Encoding.UTF8.GetBytes("ABRPOINT-2FA-2026"),
                info: Encoding.UTF8.GetBytes("2fa-totp"));
        }

        public string? Protect(string? plain)
        {
            if (string.IsNullOrEmpty(plain)) return plain;

            var plainBytes = Encoding.UTF8.GetBytes(plain);
            var nonce = RandomNumberGenerator.GetBytes(NonceSize);
            var cipher = new byte[plainBytes.Length];
            var tag = new byte[TagSize];

            using var gcm = new AesGcm(_key, TagSize);
            gcm.Encrypt(nonce, plainBytes, cipher, tag);

            var combined = new byte[NonceSize + cipher.Length + TagSize];
            Buffer.BlockCopy(nonce, 0, combined, 0, NonceSize);
            Buffer.BlockCopy(cipher, 0, combined, NonceSize, cipher.Length);
            Buffer.BlockCopy(tag, 0, combined, NonceSize + cipher.Length, TagSize);

            return Prefix + Convert.ToBase64String(combined);
        }

        public string? Unprotect(string? stored)
        {
            if (string.IsNullOrEmpty(stored)) return stored;
            if (!stored.StartsWith(Prefix, StringComparison.Ordinal))
            {
                // Legacy : secret écrit avant la protection → lu en clair.
                return stored;
            }

            var payload = Convert.FromBase64String(stored.AsSpan(Prefix.Length).ToString());
            if (payload.Length < NonceSize + TagSize)
                throw new CryptographicException("2FA secret tronqué.");

            var nonce = new byte[NonceSize];
            var tag = new byte[TagSize];
            var cipherLen = payload.Length - NonceSize - TagSize;
            var cipher = new byte[cipherLen];

            Buffer.BlockCopy(payload, 0, nonce, 0, NonceSize);
            Buffer.BlockCopy(payload, NonceSize, cipher, 0, cipherLen);
            Buffer.BlockCopy(payload, NonceSize + cipherLen, tag, 0, TagSize);

            var plain = new byte[cipherLen];
            using var gcm = new AesGcm(_key, TagSize);
            gcm.Decrypt(nonce, cipher, tag, plain);
            return Encoding.UTF8.GetString(plain);
        }
    }
}
