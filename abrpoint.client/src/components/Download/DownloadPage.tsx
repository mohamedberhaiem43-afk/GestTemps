import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageSeo from '../helper/PageSeo';
import { trackEvent } from '../../analytics/ga';
import './DownloadPage.css';

// Page publique servie sous /download. Le domaine concordeworkly.com redirige
// (côté OVH) vers https://concorde-work-force.com/download, donc ce qui s'affiche
// ici est ce que voient les utilisateurs qui scannent "concordeworkly.com".
//
// La page :
//  - détecte l'OS via navigator.userAgent
//  - propose le bon CTA en haut (Play Store + APK direct pour Android, version
//    web sur iPhone — l'app n'est pas publiée sur iOS —, QR code pour desktop)
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
};

const APK_DIRECT_URL = '/api/download/android';
const APK_INFO_URL = '/api/download/android/info';

// Build Android (APK) publié sur Expo / EAS — lien de téléchargement officiel tant
// que l'app n'est pas sur les stores. La page Expo expose le bouton « Install » qui
// sert le .apk signé. Sert de source garantie quand aucun APK auto-hébergé n'est
// disponible via /api/download/android (sinon ce dernier reste prioritaire).
const EXPO_BUILD_URL = 'https://expo.dev/accounts/concorde-tech-innovation/projects/concorde-workly/builds/eaa49a17-4adf-4cb6-bc59-47c473547136';

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

  // Contenu bilingue FR/EN piloté par i18n.language (langue forcée par l'URL :
  // /download = FR, /en/download = EN — cf. Navigation).
  const { i18n } = useTranslation();
  const lang: 'fr' | 'en' = i18n.language === 'en' ? 'en' : 'fr';
  const L = lang === 'en'
    ? {
        seoTitle: 'Download Concorde Workly – Mobile HR time-tracking app',
        seoDesc: 'Download the Concorde Workly app on Android: geolocated clock-in, leave management and field-team tracking, wherever you are.',
        backToSite: '← Back to site',
        tag: '📱 Mobile app',
        titlePre: 'Download ',
        sub: "The official mobile app for clock-in, leave and HR notifications — Android. Canonical link: ",
        osAndroid: '🤖 Android detected',
        osIos: '🌐 Web version recommended',
        osDesktop: '💻 Desktop — scan the QR code',
        checking: 'Checking availability…',
        dlApk: 'Download the APK',
        directInstall: 'Direct install',
        dlAndroidApp: 'Download the Android app',
        directInstallApk: 'Direct install (APK)',
        expoBuild: 'Official build hosted on Expo',
        availableOn: 'AVAILABLE ON',
        howtoSummary: 'How to install the APK?',
        howto1: 'Download the APK file with the button above.',
        howto2Pre: 'Open the file from your ',
        howto2Em: 'Downloads',
        howto2Post: ' folder.',
        howto3Pre: 'If Android asks for permission, allow “Unknown sources” ',
        howto3Strong: 'for this installation only',
        howto3Post: '.',
        howto4: 'The app will appear on your home screen.',
        goTo: 'Go to',
        webApp: 'The web app',
        iosNote: 'The mobile app is available on Android. On this device, access Concorde Workforce directly from your browser.',
        desktopIntro: 'Scan the QR code with your phone to download the app directly. Or click one of the links below.',
        checkingApk: 'Checking the direct APK…',
        dlApkDirect: 'Download the Android APK directly',
        dlApkExpo: 'Download the Android APK (Expo)',
        scanTitle: 'Scan with your phone',
        qrAlt: (u: string) => `QR code pointing to ${u}`,
        copyLink: '📋 Copy the link',
        featPunch: 'Time tracking', featPunchSub: 'Geolocated · offline',
        featLeave: 'Leave', featLeaveSub: 'Request in 2 clicks',
        featSecure: 'Secure', featSecureSub: 'Biometrics · AES-256',
        featMulti: 'Multi-country', featMultiSub: 'FR · BE · MA · SN',
        footerBack: 'Back to site',
      }
    : {
        seoTitle: 'Télécharger Concorde Workly – App pointage mobile RH',
        seoDesc: "Téléchargez l'application Concorde Workly sur Android : pointage géolocalisé, gestion des congés et suivi des équipes terrain, où que vous soyez.",
        backToSite: '← Retour au site',
        tag: '📱 Application mobile',
        titlePre: 'Téléchargez ',
        sub: "L'app mobile officielle de pointage, congés et notifications RH — Android. Lien canonique : ",
        osAndroid: '🤖 Android détecté',
        osIos: '🌐 Version web recommandée',
        osDesktop: '💻 Ordinateur — scannez le QR code',
        checking: 'Vérification de la disponibilité…',
        dlApk: "Télécharger l'APK",
        directInstall: 'Installation directe',
        dlAndroidApp: "Télécharger l'app Android",
        directInstallApk: 'Installation directe (APK)',
        expoBuild: 'Build officiel hébergé sur Expo',
        availableOn: 'DISPONIBLE SUR',
        howtoSummary: "Comment installer l'APK ?",
        howto1: "Téléchargez le fichier APK avec le bouton ci-dessus.",
        howto2Pre: 'Ouvrez le fichier depuis votre dossier ',
        howto2Em: 'Téléchargements',
        howto2Post: '.',
        howto3Pre: "Si Android demande l'autorisation, acceptez « Sources inconnues » ",
        howto3Strong: 'pour cette installation uniquement',
        howto3Post: '.',
        howto4: "L'app apparaîtra sur votre écran d'accueil.",
        goTo: 'Accéder à',
        webApp: "L'application web",
        iosNote: "L'application mobile est disponible sur Android. Sur cet appareil, accédez à Concorde Workforce directement depuis votre navigateur.",
        desktopIntro: "Scannez le QR code avec votre téléphone pour télécharger l'app directement. Ou cliquez sur l'un des liens ci-dessous.",
        checkingApk: "Vérification de l'APK direct…",
        dlApkDirect: "Télécharger l'APK Android directement",
        dlApkExpo: "Télécharger l'APK Android (Expo)",
        scanTitle: 'Scannez avec votre téléphone',
        qrAlt: (u: string) => `QR code pointant vers ${u}`,
        copyLink: '📋 Copier le lien',
        featPunch: 'Pointage', featPunchSub: 'Géolocalisé · offline',
        featLeave: 'Congés', featLeaveSub: 'Demande en 2 clics',
        featSecure: 'Sécurisé', featSecureSub: 'Biométrie · AES-256',
        featMulti: 'Multi-pays', featMultiSub: 'FR · BE · MA · SN',
        footerBack: 'Retour au site',
      };

  return (
    <div className="dl-page">
      <PageSeo title={L.seoTitle} description={L.seoDesc} />
      <div className="dl-bg" />

      <header className="dl-header">
        <a className="dl-brand" href="/">
          <img src="/concorde-workly-light.jpg" alt="Concorde Workforce" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 8 }} />
          <span className="dl-brand-name">Concorde Workforce</span>
        </a>
        <a className="dl-back" href="/">{L.backToSite}</a>
      </header>

      <main className="dl-main">
        <div className="dl-hero">
          <div className="dl-tag">{L.tag}</div>
          <h1 className="dl-title">
            {L.titlePre}<span className="dl-accent">Concorde Workly</span>
          </h1>
          <p className="dl-sub">
            {L.sub}<strong>concordeworkly.com</strong>.
          </p>
        </div>

        <div className="dl-grid">
          {/* Colonne CTA : choix automatique selon l'OS détecté. */}
          <section className="dl-cta-card">
            <div className="dl-os-badge">
              {os === 'android' && L.osAndroid}
              {os === 'ios' && L.osIos}
              {os === 'desktop' && L.osDesktop}
            </div>

            {os === 'android' && (
              <>
                {apkInfo === null ? (
                  // Chargement initial des métadonnées de l'APK (taille / date / disponibilité).
                  <div className="dl-btn dl-btn-loading">
                    <span className="dl-btn-icon">⏳</span>
                    <span className="dl-btn-content">
                      <span className="dl-btn-large">{L.checking}</span>
                    </span>
                  </div>
                ) : apkInfo.available ? (
                  <a className="dl-btn dl-btn-primary" href={apkInfo?.downloadUrl || APK_DIRECT_URL} download onClick={() => trackEvent('app_download_click', { platform: 'android', method: 'apk' })}>
                    <span className="dl-btn-icon">⬇</span>
                    <span className="dl-btn-content">
                      <span className="dl-btn-small">{L.dlApk}</span>
                      <span className="dl-btn-large">{L.directInstall}</span>
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
                  <a className="dl-btn dl-btn-primary" href={EXPO_BUILD_URL} target="_blank" rel="noreferrer" onClick={() => trackEvent('app_download_click', { platform: 'android', method: 'expo' })}>
                    <span className="dl-btn-icon">⬇</span>
                    <span className="dl-btn-content">
                      <span className="dl-btn-small">{L.dlAndroidApp}</span>
                      <span className="dl-btn-large">{L.directInstallApk}</span>
                      <span className="dl-btn-meta">{L.expoBuild}</span>
                    </span>
                  </a>
                )}
                <a className="dl-btn dl-btn-secondary" href={STORE_LINKS.android} target="_blank" rel="noreferrer" onClick={() => trackEvent('app_download_click', { platform: 'android', method: 'play_store' })}>
                  <span className="dl-btn-icon">▶</span>
                  <span className="dl-btn-content">
                    <span className="dl-btn-small">{L.availableOn}</span>
                    <span className="dl-btn-large">Google Play</span>
                  </span>
                </a>
                {apkInfo !== null && (
                  <details className="dl-howto">
                    <summary>{L.howtoSummary}</summary>
                    <ol>
                      <li>{L.howto1}</li>
                      <li>{L.howto2Pre}<em>{L.howto2Em}</em>{L.howto2Post}</li>
                      <li>{L.howto3Pre}<strong>{L.howto3Strong}</strong>{L.howto3Post}</li>
                      <li>{L.howto4}</li>
                    </ol>
                  </details>
                )}
              </>
            )}

            {os === 'ios' && (
              <>
                <a className="dl-btn dl-btn-primary" href="/" onClick={() => trackEvent('app_download_click', { platform: 'web' })}>
                  <span className="dl-btn-icon">🌐</span>
                  <span className="dl-btn-content">
                    <span className="dl-btn-small">{L.goTo}</span>
                    <span className="dl-btn-large">{L.webApp}</span>
                  </span>
                </a>
                <p className="dl-note">{L.iosNote}</p>
              </>
            )}

            {os === 'desktop' && (
              <>
                <p className="dl-desktop-intro">{L.desktopIntro}</p>
                {apkInfo === null ? (
                  <div className="dl-btn dl-btn-loading">
                    <span className="dl-btn-icon">⏳</span>
                    <span className="dl-btn-content">
                      <span className="dl-btn-large">{L.checkingApk}</span>
                    </span>
                  </div>
                ) : apkInfo.available ? (
                  <a className="dl-btn dl-btn-apk-inline" href={apkInfo?.downloadUrl || APK_DIRECT_URL} download onClick={() => trackEvent('app_download_click', { platform: 'android', method: 'apk' })}>
                    <span className="dl-btn-icon">⬇</span>
                    <span className="dl-btn-content">
                      <span className="dl-btn-large">{L.dlApkDirect}</span>
                      <span className="dl-btn-meta">{apkInfo.sizeMb} Mo · {apkInfo.publishedAt?.slice(0, 10)}</span>
                    </span>
                  </a>
                ) : (
                  <a className="dl-btn dl-btn-apk-inline" href={EXPO_BUILD_URL} target="_blank" rel="noreferrer" onClick={() => trackEvent('app_download_click', { platform: 'android', method: 'expo' })}>
                    <span className="dl-btn-icon">⬇</span>
                    <span className="dl-btn-content">
                      <span className="dl-btn-large">{L.dlApkExpo}</span>
                      <span className="dl-btn-meta">{L.expoBuild}</span>
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
            <h2 className="dl-qr-title">{L.scanTitle}</h2>
            <img className="dl-qr-img" src={qrSrc} alt={L.qrAlt(scanUrl)} />
            <div className="dl-qr-brand">{brandedLabel}</div>
            <div className="dl-qr-url">{scanUrl}</div>
            <button
              type="button"
              className="dl-qr-copy"
              onClick={() => {
                navigator.clipboard?.writeText(scanUrl);
              }}
            >
              {L.copyLink}
            </button>
          </section>
        </div>

        <section className="dl-features">
          <div className="dl-feat"><span>⏱</span><strong>{L.featPunch}</strong><span>{L.featPunchSub}</span></div>
          <div className="dl-feat"><span>📅</span><strong>{L.featLeave}</strong><span>{L.featLeaveSub}</span></div>
          <div className="dl-feat"><span>🔒</span><strong>{L.featSecure}</strong><span>{L.featSecureSub}</span></div>
          <div className="dl-feat"><span>🌍</span><strong>{L.featMulti}</strong><span>{L.featMultiSub}</span></div>
        </section>
      </main>

      <footer className="dl-footer">
        © 2026 Concorde Workforce · <a href="/">{L.footerBack}</a>
      </footer>
    </div>
  );
}
