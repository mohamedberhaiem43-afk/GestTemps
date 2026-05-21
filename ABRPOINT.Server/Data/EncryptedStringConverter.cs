using ABRPOINT.Server.Services;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace ABRPOINT.Server.Data;

/// <summary>
/// EF Core ValueConverter qui chiffre transparentement une colonne `string?`
/// via <see cref="EncryptionService"/> à l'écriture et la déchiffre à la lecture.
///
/// **Pourquoi un converter** : avant cette classe, chaque controller appelait
/// manuellement <c>Encrypt()</c> avant d'écrire et <c>Decrypt()</c> après lecture.
/// Le moindre oubli — par exemple un nouvel endpoint qui persiste un employé
/// sans passer par la couche prévue — laissait fuiter le CIN en clair dans la
/// base. Avec ce converter, EF Core applique automatiquement le chiffrement à
/// la frontière SQL : il devient **impossible** pour un développeur de
/// persister une PII en clair, et chaque lecture remonte déjà décryptée.
///
/// **Idempotence** : l'<see cref="EncryptionService"/> détecte qu'une valeur
/// est déjà au format v2: et la retourne telle quelle sans la re-chiffrer.
/// Cela rend la cohabitation avec les appels <c>Encrypt()</c> existants dans
/// les controllers sans risque (chiffrement double impossible). Les appels
/// manuels deviennent redondants mais inoffensifs ; on les nettoiera dans
/// un commit ultérieur, sans urgence sécuritaire.
///
/// **Limites** :
///   - Pas d'égalité SQL sur le champ chiffré (nonce aléatoire → ciphertexts
///     différents pour deux mêmes plaintexts). Si une recherche par CIN est
///     introduite plus tard, ajouter une colonne `Empcin_Hash` déterministe.
///   - L'AuditLog (cf. ApplicationDbContext.CollectAuditEntries) ne capture
///     que les métadonnées (table, action, uticod), jamais les valeurs.
///     Donc aucune fuite indirecte vers la table d'audit.
/// </summary>
public sealed class EncryptedStringConverter : ValueConverter<string?, string?>
{
    public EncryptedStringConverter(EncryptionService encryption)
        : base(
            // OnSave : modèle → DB
            plain => encryption.Encrypt(plain),
            // OnRead : DB → modèle
            cipher => encryption.Decrypt(cipher))
    {
    }
}
