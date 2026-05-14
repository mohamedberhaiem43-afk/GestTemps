using System.Security.Cryptography;
using System.Text;

namespace ABRPOINT.Server.Services
{
    /// <summary>
    /// Service de chiffrement symétrique des PII (CIN, téléphones, etc.).
    ///
    /// Format v2 (nouvel écrit) : "v2:" + base64( nonce[12] || ciphertext || tag[16] )
    ///   AES-256-GCM authentifié, nonce aléatoire à chaque chiffrement (IND-CPA).
    ///
    /// Format legacy (lecture compatible) : base64( AES-256-CBC + IV statique )
    ///   Conservé en lecture seule pour les données chiffrées avant la migration.
    ///   Toute écriture passe en v2.
    ///
    /// Note SEC — la version précédente utilisait un IV statique dérivé de la clé,
    /// rendant le chiffrement déterministe (deux PII identiques → mêmes ciphertexts,
    /// fuite par comparaison). Et `Decrypt` retournait silencieusement le ciphertext
    /// brut en cas d'erreur, mélangeant données chiffrées et clair.
    /// </summary>
    public class EncryptionService
    {
        private const string V2Prefix = "v2:";
        private const int GcmNonceSize = 12; // bytes
        private const int GcmTagSize = 16;   // bytes

        private readonly byte[] _key;
        private readonly byte[] _legacyIv;

        public EncryptionService(IConfiguration configuration)
        {
            var key = configuration["Encryption:AesKey"]
                ?? throw new InvalidOperationException("Encryption:AesKey not configured");
            using var sha256 = SHA256.Create();
            _key = sha256.ComputeHash(Encoding.UTF8.GetBytes(key));
            _legacyIv = _key.Take(16).ToArray();
        }

        public string? Encrypt(string? plainText)
        {
            if (string.IsNullOrEmpty(plainText)) return plainText;

            // Idempotence : si l'entrée est DÉJÀ un ciphertext v2 valide, on la retourne
            // telle quelle. Sans ce garde, un upsert dont la form data conserve la valeur
            // chiffrée (ex: champ non modifié populé depuis un cache front non déchiffré)
            // produisait `v2:base64(v2:base64(plain))`. Au prochain Decrypt, on récupérait
            // le ciphertext interne `v2:base64(plain)` qui s'affichait tel quel dans l'UI
            // (CIN/téléphone "cryptés" sur la fiche collaborateur).
            if (IsValidV2Ciphertext(plainText)) return plainText;

            var plainBytes = Encoding.UTF8.GetBytes(plainText);
            var nonce = RandomNumberGenerator.GetBytes(GcmNonceSize);
            var cipher = new byte[plainBytes.Length];
            var tag = new byte[GcmTagSize];

            using var aes = new AesGcm(_key, GcmTagSize);
            aes.Encrypt(nonce, plainBytes, cipher, tag);

            // Format : nonce || cipher || tag (concaténation simple, désérialisation
            // par offsets — le tag est en fin pour rester compatible avec l'usage
            // standard de la plupart des bibliothèques GCM.)
            var combined = new byte[GcmNonceSize + cipher.Length + GcmTagSize];
            Buffer.BlockCopy(nonce, 0, combined, 0, GcmNonceSize);
            Buffer.BlockCopy(cipher, 0, combined, GcmNonceSize, cipher.Length);
            Buffer.BlockCopy(tag, 0, combined, GcmNonceSize + cipher.Length, GcmTagSize);

            return V2Prefix + Convert.ToBase64String(combined);
        }

        public string? Decrypt(string? cipherText)
        {
            if (string.IsNullOrEmpty(cipherText)) return cipherText;

            // v2 — AES-GCM authentifié
            if (cipherText.StartsWith(V2Prefix, StringComparison.Ordinal))
            {
                var payload = Convert.FromBase64String(cipherText.AsSpan(V2Prefix.Length).ToString());
                if (payload.Length < GcmNonceSize + GcmTagSize)
                    throw new CryptographicException("Payload GCM tronqué.");

                var nonce = new byte[GcmNonceSize];
                var tag = new byte[GcmTagSize];
                var cipherLen = payload.Length - GcmNonceSize - GcmTagSize;
                var cipher = new byte[cipherLen];

                Buffer.BlockCopy(payload, 0, nonce, 0, GcmNonceSize);
                Buffer.BlockCopy(payload, GcmNonceSize, cipher, 0, cipherLen);
                Buffer.BlockCopy(payload, GcmNonceSize + cipherLen, tag, 0, GcmTagSize);

                var plain = new byte[cipherLen];
                using var aes = new AesGcm(_key, GcmTagSize);
                // Lèvera CryptographicException si le tag d'auth ne match pas
                // (donnée tampered ou clé incorrecte) — c'est le comportement voulu :
                // on N'AVALE PLUS l'erreur, on remonte.
                aes.Decrypt(nonce, cipher, tag, plain);
                var result = Encoding.UTF8.GetString(plain);

                // Récupération des données déjà doublement chiffrées en base (bug
                // historique : Encrypt n'était pas idempotent, certaines updates
                // ré-encryptaient une valeur déjà v2: → `v2:base64(v2:base64(plain))`).
                // Si le clair décodé est lui-même un ciphertext v2 valide, on dépile
                // une couche supplémentaire pour restituer le vrai plaintext.
                if (IsValidV2Ciphertext(result))
                    return Decrypt(result);

                return result;
            }

            // Legacy — AES-CBC, IV statique. Conservé en lecture pour les données
            // chiffrées avant la migration. Comportement tolérant pour ce format
            // historique uniquement : certaines lignes (CIN/téléphone de comptes
            // anciens, imports, données seed) sont stockées en clair et ne sont
            // jamais passées par Encrypt. On retourne alors la valeur brute plutôt
            // que de casser les écrans utilisateur. Une migration de fond devra
            // ré-écrire toutes ces valeurs en v2 puis retirer ce fallback.
            try
            {
                using var aesLegacy = Aes.Create();
                aesLegacy.Key = _key;
                aesLegacy.IV = _legacyIv;
                aesLegacy.Mode = CipherMode.CBC;
                aesLegacy.Padding = PaddingMode.PKCS7;

                using var decryptor = aesLegacy.CreateDecryptor();
                var cipherBytes = Convert.FromBase64String(cipherText);
                var decryptedBytes = decryptor.TransformFinalBlock(cipherBytes, 0, cipherBytes.Length);
                return Encoding.UTF8.GetString(decryptedBytes);
            }
            catch
            {
                return cipherText;
            }
        }

        /// <summary>
        /// Variante "tolérante" pour les contextes où une donnée peut être en clair
        /// historique (avant tout chiffrement). Utiliser avec parcimonie : seul un
        /// usage transitoire de migration est légitime.
        /// </summary>
        public string? DecryptOrPassthrough(string? value)
        {
            if (string.IsNullOrEmpty(value)) return value;
            try { return Decrypt(value); }
            catch { return value; }
        }

        /// <summary>
        /// Vérifie si une chaîne ressemble à un ciphertext v2 valide :
        /// préfixe "v2:" + base64 décodable + taille payload >= nonce + tag.
        /// On NE déchiffre PAS — pas de coût AES, pas de besoin de la bonne clé —
        /// on vérifie juste que la forme est cohérente, suffisant pour rejeter
        /// un re-encrypt qui produirait une double-couche.
        /// </summary>
        private static bool IsValidV2Ciphertext(string value)
        {
            if (!value.StartsWith(V2Prefix, StringComparison.Ordinal)) return false;
            try
            {
                var payload = Convert.FromBase64String(value.AsSpan(V2Prefix.Length).ToString());
                return payload.Length >= GcmNonceSize + GcmTagSize;
            }
            catch (FormatException)
            {
                return false;
            }
        }
    }
}
