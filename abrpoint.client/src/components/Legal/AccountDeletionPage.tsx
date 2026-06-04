import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../helper/AuthProvider';
import apiInstance from '../API/apiInstance';
import PageSeo from '../helper/PageSeo';

/**
 * Page publique « Suppression de compte et des données » (route `/suppression-compte`).
 *
 * EXIGENCE GOOGLE PLAY (Data deletion) — cette URL est déclarée dans Play Console
 * (« URL de suppression de compte ») et apparaît sur la fiche Play Store. Elle DOIT,
 * sans authentification :
 *   • référencer le nom de l'appli / éditeur (Concorde Workly) ;
 *   • décrire clairement la procédure de demande de suppression ;
 *   • inclure un moyen de demander la suppression ;
 *   • préciser les données supprimées vs conservées (renvoi à la politique de
 *     confidentialité pour le détail des durées).
 *
 * Bouton intégré : flux en 2 étapes (code email → confirmation), identique à celui du
 * profil. Si l'utilisateur n'est pas connecté, on le redirige vers /login (la demande
 * exige une session ; un secours par e-mail reste documenté plus bas).
 *
 * Doit rester PUBLIQUE (cf. PUBLIC_PATHS dans RouteGuards). Bilingue FR/EN.
 */

const SUPPORT_EMAIL = 'contact@concorde-tech.fr';
const PRIVACY_URL = '/docs/politique-confidentialite.pdf';

type Lang = 'fr' | 'en';

interface Dict {
  title: string;
  intro: string;
  howTitle: string;
  // Bloc bouton
  ctaTitle: string; ctaIntro: string;
  btnRequest: string; btnLogin: string;
  codeLabel: string; btnConfirm: string; btnResend: string;
  sending: string; confirming: string;
  okRequest: string; okConfirm: string; errGeneric: string; errCode: string;
  // Procédures alternatives
  inAppTitle: string; inAppSteps: string[];
  emailTitle: string; emailLead: string; emailSubject: string; emailFields: string;
  delay: string;
  deletedTitle: string; deletedLead: string; deletedItems: string[];
  keptTitle: string; keptLead: string; keptPolicy: string; policyLinkLabel: string;
  b2bTitle: string; b2bBody: string;
  contactTitle: string; contactBody: string;
  updated: string;
}

const FR: Dict = {
  title: 'Suppression de compte et des données — Concorde Workly',
  intro:
    "Cette page explique comment demander la suppression de votre compte Concorde Workly (édité par Concorde Tech) et des données personnelles associées, et précise les données supprimées et celles conservées.",
  howTitle: 'Comment demander la suppression',
  ctaTitle: 'Demander la suppression maintenant',
  ctaIntro:
    'Si vous êtes connecté, lancez la demande directement ici : un code de confirmation vous sera envoyé par e-mail, puis votre demande sera transmise à notre support et à l’administrateur de votre entreprise.',
  btnRequest: 'Demander la suppression de mon compte',
  btnLogin: 'Se connecter pour supprimer mon compte',
  codeLabel: 'Saisissez le code à 6 chiffres envoyé à {email}.',
  btnConfirm: 'Confirmer la suppression',
  btnResend: 'Renvoyer un code',
  sending: 'Envoi…',
  confirming: 'Confirmation…',
  okRequest: 'Un code de confirmation a été envoyé à votre adresse e-mail.',
  okConfirm:
    'Votre demande de suppression a été confirmée. Elle sera traitée sous 30 jours et vous recevrez une confirmation par e-mail.',
  errGeneric: `Échec de l’envoi. Écrivez à ${SUPPORT_EMAIL} (objet : « Suppression de compte »).`,
  errCode: 'Code invalide ou expiré.',
  inAppTitle: 'Depuis l’application',
  inAppSteps: [
    'Ouvrez l’application Concorde Workly (mobile) ou le tableau de bord web.',
    'Allez dans « Profil ».',
    'Appuyez sur « Supprimer mon compte » en bas de la page.',
    'Confirmez avec le code reçu par e-mail : votre accès est suspendu et la suppression est traitée par nos équipes.',
  ],
  emailTitle: 'Par e-mail',
  emailLead: `Si vous n’avez plus accès à l’application, envoyez votre demande à ${SUPPORT_EMAIL}.`,
  emailSubject: 'Objet : « Suppression de compte »',
  emailFields:
    'Indiquez votre nom, votre adresse e-mail de connexion et le nom de votre entreprise afin que nous puissions identifier votre compte.',
  delay:
    'Votre demande est traitée dans un délai maximum de 30 jours. Vous recevez une confirmation par e-mail une fois la suppression / anonymisation effectuée.',
  deletedTitle: 'Données supprimées',
  deletedLead:
    'À la suite de votre demande, les données personnelles suivantes sont supprimées ou anonymisées de manière irréversible :',
  deletedItems: [
    'Identité : nom, prénom, adresse e-mail, numéro de téléphone, adresse postale.',
    'Photo de profil et justificatifs / documents que vous avez téléversés.',
    'Données d’authentification : mot de passe, jeton biométrique (Face ID / Touch ID), 2FA.',
    'Identifiants techniques : identifiant d’appareil et jeton de notification push.',
    'Position GPS associée à vos pointages (anonymisée puis supprimée).',
  ],
  keptTitle: 'Données conservées et durées',
  keptLead:
    'Concorde Workly est un service RH professionnel (B2B). Certaines données constituent des registres légaux de votre employeur et doivent être conservées pour répondre à des obligations légales (paie, temps de travail, contrats, comptabilité), même après la suppression de votre compte. Elles sont alors anonymisées ou conservées de façon restreinte.',
  keptPolicy:
    'Le détail des catégories de données conservées et de leurs durées de conservation figure dans notre politique de confidentialité :',
  policyLinkLabel: 'Consulter la politique de confidentialité',
  b2bTitle: 'Important : comptes professionnels',
  b2bBody:
    'Si votre compte a été créé par votre employeur, la suppression concerne vos données personnelles d’usage. Les enregistrements requis par la loi (paie, temps de travail, contrats) restent sous la responsabilité de votre employeur, responsable de traitement, pour la durée légale applicable.',
  contactTitle: 'Contact',
  contactBody: `Pour toute question relative à vos données ou à cette procédure : ${SUPPORT_EMAIL}.`,
  updated: 'Dernière mise à jour : juin 2026.',
};

const EN: Dict = {
  title: 'Account & data deletion — Concorde Workly',
  intro:
    'This page explains how to request the deletion of your Concorde Workly account (published by Concorde Tech) and the associated personal data, and specifies which data is deleted and which is retained.',
  howTitle: 'How to request deletion',
  ctaTitle: 'Request deletion now',
  ctaIntro:
    'If you are logged in, start the request right here: a confirmation code will be emailed to you, then your request is sent to our support and your company administrator.',
  btnRequest: 'Request deletion of my account',
  btnLogin: 'Log in to delete my account',
  codeLabel: 'Enter the 6-digit code sent to {email}.',
  btnConfirm: 'Confirm deletion',
  btnResend: 'Resend code',
  sending: 'Sending…',
  confirming: 'Confirming…',
  okRequest: 'A confirmation code has been sent to your email address.',
  okConfirm:
    'Your deletion request has been confirmed. It will be processed within 30 days and you will receive an email confirmation.',
  errGeneric: `Sending failed. Email ${SUPPORT_EMAIL} (subject: “Account deletion”).`,
  errCode: 'Invalid or expired code.',
  inAppTitle: 'From the app',
  inAppSteps: [
    'Open the Concorde Workly app (mobile) or the web dashboard.',
    'Go to “Profile”.',
    'Tap “Delete my account” at the bottom of the page.',
    'Confirm with the code received by email: your access is suspended and the deletion is processed by our team.',
  ],
  emailTitle: 'By email',
  emailLead: `If you no longer have access to the app, send your request to ${SUPPORT_EMAIL}.`,
  emailSubject: 'Subject: “Account deletion”',
  emailFields:
    'Include your name, your login email address and your company name so we can identify your account.',
  delay:
    'Your request is processed within a maximum of 30 days. You receive an email confirmation once the deletion / anonymization is complete.',
  deletedTitle: 'Data that is deleted',
  deletedLead:
    'Following your request, the following personal data is irreversibly deleted or anonymized:',
  deletedItems: [
    'Identity: first/last name, email address, phone number, postal address.',
    'Profile photo and supporting documents / files you uploaded.',
    'Authentication data: password, biometric token (Face ID / Touch ID), 2FA.',
    'Technical identifiers: device ID and push notification token.',
    'GPS location attached to your clock-ins (anonymized then deleted).',
  ],
  keptTitle: 'Data retained and durations',
  keptLead:
    'Concorde Workly is a professional HR service (B2B). Some data constitutes your employer’s legal records and must be retained to meet legal obligations (payroll, working time, contracts, accounting), even after your account is deleted. Such data is anonymized or kept on a restricted basis.',
  keptPolicy:
    'The detailed categories of retained data and their retention periods are described in our privacy policy:',
  policyLinkLabel: 'Read the privacy policy',
  b2bTitle: 'Important: business accounts',
  b2bBody:
    'If your account was created by your employer, deletion covers your personal usage data. Records required by law (payroll, working time, contracts) remain under your employer’s responsibility, as data controller, for the applicable legal period.',
  contactTitle: 'Contact',
  contactBody: `For any question about your data or this procedure: ${SUPPORT_EMAIL}.`,
  updated: 'Last updated: June 2026.',
};

const LANG: Record<Lang, Dict> = { fr: FR, en: EN };

export default function AccountDeletionPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { uticod } = useAuth();
  const isAuthenticated = Boolean(uticod);
  const lang: Lang = i18n.language === 'en' ? 'en' : 'fr';
  const d = LANG[lang];

  // Flux de demande : 'idle' (bouton) → 'code' (saisie du code).
  const [step, setStep] = useState<'idle' | 'code'>('idle');
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const requestCode = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setLoading(true);
    setNotice(null);
    try {
      const res = await apiInstance.post('/account/request-deletion', {});
      setMaskedEmail(res?.data?.email ?? '');
      setStep('code');
      setNotice({ type: 'ok', text: res?.data?.message ?? d.okRequest });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setNotice({ type: 'err', text: msg ?? d.errGeneric });
    } finally {
      setLoading(false);
    }
  };

  const confirmDeletion = async () => {
    if (code.trim().length < 4) { setNotice({ type: 'err', text: d.errCode }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const res = await apiInstance.post('/account/confirm-deletion', { code: code.trim() });
      setStep('idle');
      setCode('');
      setNotice({ type: 'ok', text: res?.data?.message ?? d.okConfirm });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setNotice({ type: 'err', text: msg ?? d.errCode });
    } finally {
      setLoading(false);
    }
  };

  const dangerBtn: React.CSSProperties = {
    background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10,
    padding: '12px 20px', fontWeight: 700, fontSize: 14, cursor: loading ? 'wait' : 'pointer',
    opacity: loading ? 0.7 : 1,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f7f9fb', padding: '48px 20px', color: '#191c1e', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <PageSeo
        title={lang === 'en'
          ? 'Account & data deletion – Concorde Workforce'
          : 'Suppression de compte et des données – Concorde Workforce'}
        description={lang === 'en'
          ? 'Request the deletion of your Concorde Workforce account and personal data. Process, retention periods and dedicated contact.'
          : 'Demandez la suppression de votre compte Concorde Workforce et de vos données personnelles. Procédure, délais de conservation et contact dédié.'}
      />
      <div style={{ maxWidth: 820, margin: '0 auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 'clamp(24px, 5vw, 48px)', boxShadow: '0 4px 16px rgba(15,23,42,.06)' }}>
        <a href="/" style={{ color: '#0040a1', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>← Concorde Workly</a>
        <h1 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, margin: '16px 0 8px', lineHeight: 1.2 }}>{d.title}</h1>
        <p style={{ color: '#424654', lineHeight: 1.7 }}>{d.intro}</p>

        {/* ── Bouton de demande (flux code email → confirmation) ── */}
        <div style={{ border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 14, padding: '20px 24px', marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#b91c1c', margin: '0 0 6px' }}>{d.ctaTitle}</h2>
          <p style={{ color: '#7f1d1d', fontSize: 14, lineHeight: 1.6, margin: '0 0 14px' }}>{d.ctaIntro}</p>

          {notice && (
            <p style={{
              borderRadius: 10, padding: '10px 14px', margin: '0 0 14px', fontSize: 14, lineHeight: 1.5,
              background: notice.type === 'ok' ? '#ecfdf5' : '#fff1f2',
              border: `1px solid ${notice.type === 'ok' ? '#a7f3d0' : '#fecaca'}`,
              color: notice.type === 'ok' ? '#065f46' : '#b91c1c',
            }}>{notice.text}</p>
          )}

          {step === 'idle' ? (
            <button type="button" style={dangerBtn} onClick={requestCode} disabled={loading}>
              {loading ? d.sending : (isAuthenticated ? d.btnRequest : d.btnLogin)}
            </button>
          ) : (
            <div>
              <p style={{ color: '#7f1d1d', fontSize: 14, margin: '0 0 10px' }}>
                {d.codeLabel.replace('{email}', maskedEmail || (lang === 'fr' ? 'votre adresse e-mail' : 'your email address'))}
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="------"
                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '12px 14px', fontSize: 22, letterSpacing: 8, textAlign: 'center', marginBottom: 14 }}
              />
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" style={dangerBtn} onClick={confirmDeletion} disabled={loading}>
                  {loading ? d.confirming : d.btnConfirm}
                </button>
                <button type="button" onClick={requestCode} disabled={loading}
                  style={{ background: 'transparent', color: '#0040a1', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  {d.btnResend}
                </button>
              </div>
            </div>
          )}
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 32 }}>{d.howTitle}</h2>

        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0040a1', marginTop: 20 }}>{d.inAppTitle}</h3>
        <ol style={{ color: '#424654', lineHeight: 1.8, paddingLeft: 22 }}>
          {d.inAppSteps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>

        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0040a1', marginTop: 20 }}>{d.emailTitle}</h3>
        <p style={{ color: '#424654', lineHeight: 1.7, margin: '6px 0' }}>{d.emailLead}</p>
        <p style={{ color: '#424654', lineHeight: 1.7, margin: '6px 0' }}>
          <strong>{d.emailSubject}</strong> — <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(lang === 'fr' ? 'Suppression de compte' : 'Account deletion')}`} style={{ color: '#0040a1' }}>{SUPPORT_EMAIL}</a>
        </p>
        <p style={{ color: '#424654', lineHeight: 1.7, margin: '6px 0' }}>{d.emailFields}</p>

        <p style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 18px', color: '#1e40af', lineHeight: 1.6, marginTop: 18 }}>{d.delay}</p>

        <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 32 }}>{d.deletedTitle}</h2>
        <p style={{ color: '#424654', lineHeight: 1.7 }}>{d.deletedLead}</p>
        <ul style={{ color: '#424654', lineHeight: 1.8, paddingLeft: 22 }}>
          {d.deletedItems.map((s, i) => <li key={i}>{s}</li>)}
        </ul>

        <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 32 }}>{d.keptTitle}</h2>
        <p style={{ color: '#424654', lineHeight: 1.7 }}>{d.keptLead}</p>
        <p style={{ color: '#424654', lineHeight: 1.7 }}>
          {d.keptPolicy}{' '}
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#0040a1', fontWeight: 600 }}>
            {d.policyLinkLabel}
          </a>.
        </p>

        <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 32 }}>{d.b2bTitle}</h2>
        <p style={{ color: '#424654', lineHeight: 1.7 }}>{d.b2bBody}</p>

        <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 32 }}>{d.contactTitle}</h2>
        <p style={{ color: '#424654', lineHeight: 1.7 }}>{d.contactBody}</p>

        <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 28 }}>{d.updated}</p>
      </div>
    </div>
  );
}
