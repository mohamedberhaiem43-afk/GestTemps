import { useTranslation } from 'react-i18next';

/**
 * Page publique « Suppression de compte et des données » (route `/suppression-compte`).
 *
 * EXIGENCE GOOGLE PLAY (Data deletion) — cette URL est déclarée dans Play Console
 * (« URL de suppression de compte ») et apparaît sur la fiche Play Store. Elle DOIT,
 * sans authentification :
 *   • référencer le nom de l'appli / éditeur (Concorde Workly) ;
 *   • décrire clairement la procédure de demande de suppression ;
 *   • préciser les données supprimées vs conservées et les durées de conservation.
 *
 * Doit donc rester PUBLIQUE (cf. PUBLIC_PATHS dans RouteGuards) et accessible aux
 * reviewers anonymes. Bilingue FR/EN via i18n.language (même pattern que les autres
 * pages marketing : dictionnaire local, pas de dépendance au fichier de traduction).
 */

const SUPPORT_EMAIL = 'contact@concorde-tech.fr';

type Lang = 'fr' | 'en';

interface RetRow { data: string; keep: string; why: string }
interface Dict {
  title: string;
  intro: string;
  howTitle: string;
  inAppTitle: string; inAppSteps: string[];
  emailTitle: string; emailLead: string; emailSubject: string; emailFields: string;
  delay: string;
  deletedTitle: string; deletedLead: string; deletedItems: string[];
  keptTitle: string; keptLead: string;
  colData: string; colKeep: string; colWhy: string;
  keptRows: RetRow[];
  b2bTitle: string; b2bBody: string;
  contactTitle: string; contactBody: string;
  updated: string;
}

const FR: Dict = {
  title: 'Suppression de compte et des données — Concorde Workly',
  intro:
    "Cette page explique comment demander la suppression de votre compte Concorde Workly (édité par Concorde Tech) et des données personnelles associées, et précise les données supprimées, celles conservées et leur durée de conservation.",
  howTitle: 'Comment demander la suppression',
  inAppTitle: 'Depuis l’application (recommandé)',
  inAppSteps: [
    'Ouvrez l’application Concorde Workly (mobile) ou le tableau de bord web.',
    'Allez dans « Profil ».',
    'Appuyez sur « Supprimer mon compte » en bas de la page.',
    'Confirmez la demande : votre accès est suspendu immédiatement et la suppression est traitée par nos équipes.',
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
    'Concorde Workly est un service RH professionnel (B2B). Certaines données constituent des registres légaux de votre employeur et doivent être conservées pour répondre à des obligations légales, même après la suppression de votre compte. Elles sont alors anonymisées ou conservées de façon restreinte :',
  colData: 'Donnée', colKeep: 'Durée de conservation', colWhy: 'Raison',
  keptRows: [
    { data: 'Relevés de pointage / présence', keep: 'Anonymisés puis supprimés selon la politique de rétention de l’employeur (par défaut ~1 an, puis suppression)', why: 'Obligation de preuve du temps de travail' },
    { data: 'Bulletins de paie et données associées', keep: 'Jusqu’à 5 ans', why: 'Obligation légale (Code du travail)' },
    { data: 'Contrats et documents RH', keep: 'Selon obligations légales applicables', why: 'Conformité sociale et légale' },
    { data: 'Factures et données comptables', keep: 'Jusqu’à 10 ans', why: 'Obligation comptable et fiscale' },
  ],
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
    'This page explains how to request the deletion of your Concorde Workly account (published by Concorde Tech) and the associated personal data, and specifies which data is deleted, which is retained, and for how long.',
  howTitle: 'How to request deletion',
  inAppTitle: 'From the app (recommended)',
  inAppSteps: [
    'Open the Concorde Workly app (mobile) or the web dashboard.',
    'Go to “Profile”.',
    'Tap “Delete my account” at the bottom of the page.',
    'Confirm the request: your access is suspended immediately and the deletion is processed by our team.',
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
    'Concorde Workly is a professional HR service (B2B). Some data constitutes your employer’s legal records and must be retained to meet legal obligations, even after your account is deleted. Such data is anonymized or kept on a restricted basis:',
  colData: 'Data', colKeep: 'Retention period', colWhy: 'Reason',
  keptRows: [
    { data: 'Time / attendance records', keep: 'Anonymized then deleted per the employer’s retention policy (default ~1 year, then deletion)', why: 'Proof of working time' },
    { data: 'Payslips and related data', keep: 'Up to 5 years', why: 'Legal obligation (labor law)' },
    { data: 'Contracts and HR documents', keep: 'As required by applicable law', why: 'Labor & legal compliance' },
    { data: 'Invoices and accounting data', keep: 'Up to 10 years', why: 'Accounting & tax obligation' },
  ],
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
  const lang: Lang = i18n.language === 'en' ? 'en' : 'fr';
  const d = LANG[lang];

  return (
    <div style={{ minHeight: '100vh', background: '#f7f9fb', padding: '48px 20px', color: '#191c1e', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 'clamp(24px, 5vw, 48px)', boxShadow: '0 4px 16px rgba(15,23,42,.06)' }}>
        <a href="/" style={{ color: '#0040a1', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>← Concorde Workly</a>
        <h1 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, margin: '16px 0 8px', lineHeight: 1.2 }}>{d.title}</h1>
        <p style={{ color: '#424654', lineHeight: 1.7 }}>{d.intro}</p>

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
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 12, marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f7f9fb' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 700, borderBottom: '2px solid #e5e7eb' }}>{d.colData}</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 700, borderBottom: '2px solid #e5e7eb' }}>{d.colKeep}</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 700, borderBottom: '2px solid #e5e7eb' }}>{d.colWhy}</th>
              </tr>
            </thead>
            <tbody>
              {d.keptRows.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb', color: '#0f172a', fontWeight: 600, verticalAlign: 'top' }}>{r.data}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb', color: '#334155', verticalAlign: 'top' }}>{r.keep}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb', color: '#334155', verticalAlign: 'top' }}>{r.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 32 }}>{d.b2bTitle}</h2>
        <p style={{ color: '#424654', lineHeight: 1.7 }}>{d.b2bBody}</p>

        <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 32 }}>{d.contactTitle}</h2>
        <p style={{ color: '#424654', lineHeight: 1.7 }}>{d.contactBody}</p>

        <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 28 }}>{d.updated}</p>
      </div>
    </div>
  );
}
