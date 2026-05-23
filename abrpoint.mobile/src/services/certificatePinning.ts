/**
 * Certificate pinning — fonctionnalité commerciale du pack Business
 * (cf. PlanFeatures.CertificatePinning côté backend).
 *
 * STATUT D'IMPLÉMENTATION
 * ───────────────────────
 * Le pinning TLS nécessite du code natif (TrustKit sur iOS, NetworkSecurityConfig
 * sur Android). En React Native, la bibliothèque canonique est
 * `react-native-ssl-public-key-pinning` (alternative : `react-native-ssl-pinning`).
 *
 * Pour ne pas casser le build quand la lib n'est pas encore installée (workflow
 * Expo managé ou EAS Build en cours de configuration), ce module utilise un
 * `require` dynamique :
 *   • Si la lib est présente → on active le pinning avec les hashes SPKI fournis.
 *   • Si elle est absente → on log un warning explicite et on laisse les
 *     requêtes passer (fail-open). C'est un choix pragmatique : bloquer
 *     toutes les requêtes Business le temps d'installer le natif rendrait
 *     l'app inutilisable. La feature reste à activer côté infra.
 *
 * INSTALLATION (à faire par l'équipe mobile pour activer réellement le pinning)
 * ────────────────────────────────────────────────────────────────────────────
 *   npx expo install react-native-ssl-public-key-pinning
 *   (puis EAS build natif — la lib publie des prebuilds via Config Plugins)
 *
 * Récupérer les hashes SPKI du certificat actuel de concorde-work-force.com :
 *   echo | openssl s_client -connect concorde-work-force.com:443 -showcerts 2>/dev/null \
 *     | openssl x509 -pubkey -noout | openssl rsa -pubin -outform der 2>/dev/null \
 *     | openssl dgst -sha256 -binary | openssl enc -base64
 *
 * Renseigner les hashes (cert courant + un backup) dans PIN_HASHES ci-dessous.
 */

// Hashes SPKI base64 (sha256) du / des certificats acceptés. ⚠ Mettre au moins
// 2 valeurs (cert actif + cert de rotation futur) pour ne pas faire crasher
// l'app lors d'un renouvellement de cert sans MAJ mobile préalable.
const PIN_HASHES: string[] = [
  // 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX=', // cert prod actuel
  // 'YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY=', // cert backup (rotation)
];

const PINNED_HOST = 'concorde-work-force.com';

let isActive = false;

/**
 * Active le pinning si la lib native est installée ET le plan le requiert.
 * Idempotent — un second appel ne reconfigure pas (les libs RN persistent
 * la config au niveau natif). On expose néanmoins `isCertPinningActive` pour
 * la télémétrie / les bannières de diagnostic.
 */
export function setupCertificatePinning(enabledByPlan: boolean): void {
  if (!enabledByPlan) {
    isActive = false;
    return;
  }
  if (isActive) return;

  // Pas de hashes configurés → on log et on sort. Sans hash, la lib ne saurait
  // pas contre quoi valider — autant ne rien faire que faire mal.
  if (PIN_HASHES.length === 0) {
    console.warn(
      '[CertificatePinning] Plan Business actif (CertificatePinning=true) mais ' +
      'aucun hash SPKI configuré dans certificatePinning.ts (PIN_HASHES). ' +
      'Le pinning N\'EST PAS APPLIQUÉ — voir le commentaire d\'installation en ' +
      'tête du fichier pour générer et renseigner les hashes.'
    );
    return;
  }

  // Dynamic require : la lib peut être absente du bundle. On ne casse rien.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const lib = require('react-native-ssl-public-key-pinning');
    if (lib && typeof lib.initializeSslPinning === 'function') {
      lib.initializeSslPinning({
        [PINNED_HOST]: {
          includeSubdomains: true,
          publicKeyHashes: PIN_HASHES,
        },
      });
      isActive = true;
      console.log(`[CertificatePinning] Activé pour ${PINNED_HOST} (${PIN_HASHES.length} hashes).`);
    } else {
      console.warn(
        '[CertificatePinning] Lib `react-native-ssl-public-key-pinning` importée ' +
        'mais l\'API initializeSslPinning n\'est pas disponible — version incompatible ?'
      );
    }
  } catch (e) {
    // Lib pas installée — c'est le cas par défaut tant que le natif n'a pas
    // été ajouté. Warning unique pour ne pas spammer la console.
    console.warn(
      '[CertificatePinning] Plan Business actif mais lib native absente. ' +
      'Installer `react-native-ssl-public-key-pinning` + rebuild natif EAS ' +
      'pour activer la protection (voir commentaire en tête du fichier).'
    );
  }
}

/** True si le pinning est effectivement en place pour la session courante. */
export function isCertPinningActive(): boolean {
  return isActive;
}
