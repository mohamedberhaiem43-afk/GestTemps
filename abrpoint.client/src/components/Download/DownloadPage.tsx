import { useEffect, useMemo, useState } from 'react';
import './DownloadPage.css';

// Page publique servie sous /download. Le domaine concordeworkly.com redirige
// (côté OVH) vers https://concorde-work-force.com/download, donc ce qui s'affiche
// ici est ce que voient les utilisateurs qui scannent "concordeworkly.com".
//
// La page :
//  - détecte l'OS via navigator.userAgent
//  - propose le bon CTA en haut (Play Store + APK direct pour Android, App Store
//    pour iOS, QR code pour desktop)
//  - propose un QR code généré côté client (Google Charts API, gratuit, sans
//    dépendance npm) qui pointe vers cette même page → un visiteur desktop le
//    scanne avec son téléphone et arrive sur la bonne version
//
// AVERTISSEMENT URLs : les liens Play Store / App Store ne sont actifs qu'une
// fois les builds publiés sur les stores. Tant que c'est le cas, on affiche
// "Bientôt sur le Play Store" et on rabat les utilisateurs vers l'APK direct.

type DetectedOs = 'android' | 'ios' | 'desktop';

const STORE_LINKS = {
  android: 'https://play.google.com/store/apps/details?id=com.concorde.workforce',
  ios: 'https://apps.apple.com/app/concorde-workforce/id000000000',
};

const APK_DIRECT_URL = '/api/download/android';
const APK_INFO_URL = '/api/download/android/info';

// Build Android (APK) publié sur Expo / EAS — lien de téléchargement officiel tant
// que l'app n'est pas sur les stores. La page Expo expose le bouton « Install » qui
// sert le .apk signé. Sert de source garantie quand aucun APK auto-hébergé n'est
// disponible via /api/download/android (sinon ce dernier reste prioritaire).
const EXPO_BUILD_URL = 'https://expo.dev/accounts/concorde-tech-innovation/projects/concorde-workly/builds/72ec5992-7f5e-41ba-9ea6-bac3415b7022';

interface ApkInfo {
  available: boolean;
  fileName?: string;
  sizeMb?: number;
  version?: string;
  publishedAt?: string;
  // URL effective à utiliser pour le bouton de download. Soit /api/download/android
  // (qui sert le fichier local ou fait un 302 vers EAS selon la config serveur),
  // soit potentiellement une URL externe absolue.
  downloadUrl?: string;
  source?: 'local' | 'external';
}

function detectOs(): DetectedOs {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  // iPad iPadOS 13+ se déclare comme MacIntel : on regarde aussi le touch support.
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/macintel/i.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  return 'desktop';
}

export default function DownloadPage() {
  const [os, setOs] = useState<DetectedOs>('desktop');
  const [apkInfo, setApkInfo] = useState<ApkInfo | null>(null);

  useEffect(() => {
    setOs(detectOs());
    fetch(APK_INFO_URL)
      .then((r) => r.json())
      .then((data) => setApkInfo(data))
      .catch(() => setApkInfo({ available: false }));
  }, []);

  // URL encodée dans le QR. Stratégie :
  //   1) Si `VITE_DOWNLOAD_VANITY_URL` est défini dans la conf build (ex:
  //      "https://concordeworkly.com"), on l'utilise — utile UNIQUEMENT quand
  //      la redirection OVH concordeworkly.com → /download est active.
  //   2) Sinon, on retombe sur window.location.origin + /download, c'est-à-dire
  //      l'URL qui sert effectivement la page (par ex.
  //      https://www.concorde-work-force.com/download). Garanti de fonctionner.
  //
  // Pour activer le vanity URL : ajouter VITE_DOWNLOAD_VANITY_URL=https://concordeworkly.com
  // dans .env / .env.production / docker-compose.yml et rebuild le client.
  // Les anciens QR déjà imprimés/partagés continuent de fonctionner car ils
  // encodaient la version origin/download (qui ne change pas).
  const scanUrl = useMemo(() => {
    const vanity = (import.meta.env.VITE_DOWNLOAD_VANITY_URL as string | undefined)?.trim();
    if (vanity) return vanity.replace(/\/+$/, ''); // strip trailing slash(es)
    if (typeof window === 'undefined') return '/download';
    return `${window.location.origin}/download`;
  }, []);

  // Label affiché sous le QR pour le branding. On l'extrait du vanity URL si
  // défini (host), sinon on retombe sur "concordeworkly.com" comme marque
  // visuelle même si on encode une autre URL (cohérent avec le reste du site).
  const brandedLabel = useMemo(() => {
    const vanity = (import.meta.env.VITE_DOWNLOAD_VANITY_URL as string | undefined)?.trim();
    if (vanity) {
      try { return new URL(vanity).host; } catch { /* noop */ }
    }
    return 'concordeworkly.com';
  }, []);

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(scanUrl)}`;

  return (
    <div className="dl-page">
      <div className="dl-bg" />

      <header className="dl-header">
        <a className="dl-brand" href="/">
          <span className="dl-logo">C</span>
          <span className="dl-brand-name">Concorde Workforce</span>
        </a>
        <a className="dl-back" href="/">← Retour au site</a>
      </header>

      <main className="dl-main">
        <div className="dl-hero">
          <div className="dl-tag">📱 Application mobile</div>
          <h1 className="dl-title">
            Téléchargez <span className="dl-accent">Concorde Workly</span>
          </h1>
          <p className="dl-sub">
            L'app mobile officielle de pointage, congés et notifications RH —
            iOS et Android. Lien canonique :{' '}
            <strong>concordeworkly.com</strong>.
          </p>
        </div>

        <div className="dl-grid">
          {/* Colonne CTA : choix automatique selon l'OS détecté. */}
          <section className="dl-cta-card">
            <div className="dl-os-badge">
              {os === 'android' && '🤖 Android détecté'}
              {os === 'ios' && '🍎 iOS détecté'}
              {os === 'desktop' && '💻 Ordinateur — scannez le QR code'}
            </div>

            {os === 'android' && (
              <>
                {apkInfo === null ? (
                  // Chargement initial des métadonnées de l'APK (taille / date / disponibilité).
                  <div className="dl-btn dl-btn-loading">
                    <span className="dl-btn-icon">⏳</span>
                    <span className="dl-btn-content">
                      <span className="dl-btn-large">Vérification de la disponibilité…</span>
                    </span>
                  </div>
                ) : apkInfo.available ? (
                  <a className="dl-btn dl-btn-primary" href={apkInfo?.downloadUrl || APK_DIRECT_URL} download>
                    <span className="dl-btn-icon">⬇</span>
                    <span className="dl-btn-content">
                      <span className="dl-btn-small">Télécharger l'APK</span>
                      <span className="dl-btn-large">Installation directe</span>
                      <span className="dl-btn-meta">
                        {[
                          apkInfo.version ? `v. ${apkInfo.version}` : (apkInfo.publishedAt ? apkInfo.publishedAt.slice(0, 10) : null),
                          apkInfo.sizeMb ? `${apkInfo.sizeMb} Mo` : null,
                        ].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </a>
                ) : (
                  // Aucun APK auto-hébergé : on sert le build officiel publié sur Expo.
                  // Lien externe (page Expo "Install") → target _blank, pas d'attribut
                  // download (c'est une page, pas un fichier direct).
                  <a className="dl-btn dl-btn-primary" href={EXPO_BUILD_URL} target="_blank" rel="noreferrer">
                    <span className="dl-btn-icon">⬇</span>
                    <span className="dl-btn-content">
                      <span className="dl-btn-small">Télécharger l'app Android</span>
                      <span className="dl-btn-large">Installation directe (APK)</span>
                      <span className="dl-btn-meta">Build officiel hébergé sur Expo</span>
                    </span>
                  </a>
                )}
                <a className="dl-btn dl-btn-secondary" href={STORE_LINKS.android} target="_blank" rel="noreferrer">
                  <span className="dl-btn-icon">▶</span>
                  <span className="dl-btn-content">
                    <span className="dl-btn-small">DISPONIBLE SUR</span>
                    <span className="dl-btn-large">Google Play</span>
                  </span>
                </a>
                {apkInfo !== null && (
                  <details className="dl-howto">
                    <summary>Comment installer l'APK ?</summary>
                    <ol>
                      <li>Téléchargez le fichier APK avec le bouton ci-dessus.</li>
                      <li>Ouvrez le fichier depuis votre dossier <em>Téléchargements</em>.</li>
                      <li>Si Android demande l'autorisation, acceptez « Sources inconnues » <strong>pour cette installation uniquement</strong>.</li>
                      <li>L'app apparaîtra sur votre écran d'accueil.</li>
                    </ol>
                  </details>
                )}
              </>
            )}

            {os === 'ios' && (
              <>
                <a className="dl-btn dl-btn-primary" href={STORE_LINKS.ios} target="_blank" rel="noreferrer">
                  <span className="dl-btn-icon"></span>
                  <span className="dl-btn-content">
                    <span className="dl-btn-small">Télécharger sur</span>
                    <span className="dl-btn-large">App Store</span>
                  </span>
                </a>
                <p className="dl-note">
                  iOS n'autorise pas l'installation directe d'IPA hors App Store ou
                  TestFlight. Si l'app n'est pas encore publiée, contactez-nous pour
                  recevoir une invitation TestFlight.
                </p>
              </>
            )}

            {os === 'desktop' && (
              <>
                <p className="dl-desktop-intro">
                  Scannez le QR code avec votre téléphone pour télécharger l'app
                  directement. Ou cliquez sur l'un des liens ci-dessous.
                </p>
                <div className="dl-stores-row">
                  <a className="dl-btn dl-btn-secondary" href={STORE_LINKS.ios} target="_blank" rel="noreferrer">
                    <span className="dl-btn-icon"></span>
                    <span className="dl-btn-content">
                      <span className="dl-btn-small">Télécharger sur</span>
                      <span className="dl-btn-large">App Store</span>
                    </span>
                  </a>
                  <a className="dl-btn dl-btn-secondary" href={STORE_LINKS.android} target="_blank" rel="noreferrer">
                    <span className="dl-btn-icon">▶</span>
                    <span className="dl-btn-content">
                      <span className="dl-btn-small">DISPONIBLE SUR</span>
                      <span className="dl-btn-large">Google Play</span>
                    </span>
                  </a>
                </div>
                {apkInfo === null ? (
                  <div className="dl-btn dl-btn-loading">
                    <span className="dl-btn-icon">⏳</span>
                    <span className="dl-btn-content">
                      <span className="dl-btn-large">Vérification de l'APK direct…</span>
                    </span>
                  </div>
                ) : apkInfo.available ? (
                  <a className="dl-btn dl-btn-apk-inline" href={apkInfo?.downloadUrl || APK_DIRECT_URL} download>
                    <span className="dl-btn-icon">⬇</span>
                    <span className="dl-btn-content">
                      <span className="dl-btn-large">Télécharger l'APK Android directement</span>
                      <span className="dl-btn-meta">{apkInfo.sizeMb} Mo · {apkInfo.publishedAt?.slice(0, 10)}</span>
                    </span>
                  </a>
                ) : (
                  <a className="dl-btn dl-btn-apk-inline" href={EXPO_BUILD_URL} target="_blank" rel="noreferrer">
                    <span className="dl-btn-icon">⬇</span>
                    <span className="dl-btn-content">
                      <span className="dl-btn-large">Télécharger l'APK Android (Expo)</span>
                      <span className="dl-btn-meta">Build officiel hébergé sur Expo</span>
                    </span>
                  </a>
                )}
              </>
            )}
          </section>

          {/* Colonne QR + URL. Le QR encode l'URL réellement servie (origin/download)
              et non l'URL « vanity » concordeworkly.com, qui n'est pas encore active
              côté DNS — sinon le scan tomberait sur "site indisponible". */}
          <section className="dl-qr-card">
            <h2 className="dl-qr-title">Scannez avec votre téléphone</h2>
            <img className="dl-qr-img" src={qrSrc} alt={`QR code pointant vers ${scanUrl}`} />
            <div className="dl-qr-brand">{brandedLabel}</div>
            <div className="dl-qr-url">{scanUrl}</div>
            <button
              type="button"
              className="dl-qr-copy"
              onClick={() => {
                navigator.clipboard?.writeText(scanUrl);
              }}
            >
              📋 Copier le lien
            </button>
          </section>
        </div>

        <section className="dl-features">
          <div className="dl-feat"><span>⏱</span><strong>Pointage</strong><span>Géolocalisé · offline</span></div>
          <div className="dl-feat"><span>📅</span><strong>Congés</strong><span>Demande en 2 clics</span></div>
          <div className="dl-feat"><span>🔒</span><strong>Sécurisé</strong><span>Biométrie · AES-256</span></div>
          <div className="dl-feat"><span>🌍</span><strong>Multi-pays</strong><span>FR · BE · MA · SN</span></div>
        </section>
      </main>

      <footer className="dl-footer">
        © 2026 Concorde Workforce · <a href="/">Retour au site</a>
      </footer>
    </div>
  );
}
