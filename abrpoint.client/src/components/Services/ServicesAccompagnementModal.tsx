import { useEffect, useState } from 'react';
import {
  Dialog, Box, Typography, IconButton, Tabs, Tab, useMediaQuery, useTheme,
} from '@mui/material';
import { X as CloseIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/* ════════════════════════════════════════════════════════════════════════════
   POPUP « Nos services & accompagnement » (Espace client).
   Auparavant affichée comme une section de la landing publique (HomePage), cette
   offre est désormais réservée aux utilisateurs CONNECTÉS et présentée dans une
   popup ouverte manuellement (menu avatar → « Nos services & accompagnement »).

   Déclenchement : on écoute l'évènement window `cw:open-services` (dispatché par
   le menu utilisateur), exactement comme le pattern `cookie-consent:open` déjà en
   place. Le composant est monté une fois dans le shell authentifié (Navigation).

   Deux onglets :
   - « Services & formation » : prestations ponctuelles → Payment Link Stripe (le
     slug du tenant est injecté en client_reference_id pour rattacher l'achat).
   - « Modules sur devis » : solutions avancées → « Demander un devis » (mailto au
     support, l'app n'a pas de formulaire de contact public comme la landing).
   ════════════════════════════════════════════════════════════════════════════ */

export const SERVICES_MODAL_EVENT = 'cw:open-services';

const QUOTE_EMAIL = 'postmaster@concorde-work-force.com';

// Payment Links Stripe des services ponctuels (ordre = serviceItems ci-dessous).
const SERVICE_LINKS = [
  'https://buy.stripe.com/3cI14g7Cl4RjaNF9NL0000d', // Formation administrateurs (visio) — 290 €
  'https://buy.stripe.com/aFa3coe0J97zcVN3pn0000e', // Accompagnement Expert (visio) — 190 €
  'https://buy.stripe.com/3cI00c6yhbfH8Fxgc90000f', // Accompagnement demi-journée — 490 €
  'https://buy.stripe.com/dRmcMY5udabDaNF1hf0000g', // Journée complète d'accompagnement — 890 €
];

type Lang = 'fr' | 'en';
interface ServiceItem { name: string; desc: string; price: string; }
interface QuoteItem { name: string; desc: string; }
interface Dict {
  badge: string; title: string; subtitle: string;
  tabServices: string; tabQuote: string;
  svcSectionTitle: string; svcSectionSub: string;
  svcCol: string; descCol: string; tarifCol: string; addBtn: string;
  quoteSectionTitle: string; quoteSectionSub: string;
  modCol: string; quoteBtn: string; quoteSubject: string;
  serviceItems: ServiceItem[]; quoteModules: QuoteItem[];
}

const LANG: Record<Lang, Dict> = {
  fr: {
    badge: 'Espace client · Concorde Workforce',
    title: 'Nos services & accompagnement',
    subtitle: 'Formation, accompagnement et modules avancés pour tirer le meilleur de la plateforme.',
    tabServices: 'Services & formation',
    tabQuote: 'Modules sur devis',
    svcSectionTitle: 'Nos services',
    svcSectionSub: 'Formation et accompagnement par nos experts pour tirer le meilleur de la plateforme.',
    svcCol: 'Service', descCol: 'Description', tarifCol: 'Tarif', addBtn: 'Ajouter',
    quoteSectionTitle: 'Modules et services sur devis',
    quoteSectionSub: 'Solutions avancées étudiées selon vos besoins — contactez-nous pour un devis personnalisé.',
    modCol: 'Module', quoteBtn: 'Demander un devis',
    quoteSubject: 'Demande de devis — {module}',
    serviceItems: [
      { name: 'Formation administrateurs (visio)', desc: 'Session de formation à distance destinée aux administrateurs pour prendre en main Concorde Workforce : gestion des salariés, pointage, congés, validations, tableau de bord et paramétrage principal. Durée indicative : 2h30.', price: '290 €' },
      { name: 'Accompagnement Expert (visio)', desc: "Session d'accompagnement personnalisée à distance pour assistance, optimisation, conseils ou accompagnement opérationnel autour de Concorde Workforce. Durée indicative : 1h30.", price: '190 €' },
      { name: 'Accompagnement demi-journée', desc: "Accompagnement personnalisé dédié au déploiement, à l'organisation RH ou à l'optimisation de l'utilisation de la plateforme.", price: '490 €' },
      { name: "Journée complète d'accompagnement", desc: "Journée complète d'accompagnement opérationnel et stratégique : déploiement, structuration RH, formation avancée ou optimisation des processus internes.", price: '890 €' },
    ],
    quoteModules: [
      { name: 'Import de données assisté', desc: "Assistance technique et accompagnement pour l'import sécurisé des salariés, équipes, structures et données RH existantes vers Concorde Workforce." },
      { name: 'Connecteurs ERP / Paie', desc: "Mise en place de connecteurs standards permettant l'échange de données entre Concorde Workforce et certains logiciels ERP ou solutions de paie compatibles." },
      { name: 'Connecteurs ERP sur mesure', desc: "Développement et intégration de connecteurs personnalisés selon les besoins spécifiques du client et les logiciels tiers utilisés au sein de l'organisation." },
      { name: 'Audit sécurité avancée', desc: "Audit de sécurité et analyse technique visant à renforcer la protection de la plateforme et identifier d'éventuelles vulnérabilités ou axes d'amélioration." },
      { name: 'Branding personnalisé', desc: "Personnalisation avancée de l'environnement Concorde Workforce pour intégrer l'identité graphique de l'entreprise : logo, couleurs, éléments de marque et expérience utilisateur personnalisée." },
    ],
  },
  en: {
    badge: 'Client area · Concorde Workforce',
    title: 'Our services & support',
    subtitle: 'Training, guidance and advanced modules to get the most out of the platform.',
    tabServices: 'Services & training',
    tabQuote: 'Modules on quote',
    svcSectionTitle: 'Our services',
    svcSectionSub: 'Training and guidance from our experts to get the most out of the platform.',
    svcCol: 'Service', descCol: 'Description', tarifCol: 'Price', addBtn: 'Add',
    quoteSectionTitle: 'Modules on quote',
    quoteSectionSub: 'Advanced solutions tailored to your needs — contact us for a custom quote.',
    modCol: 'Module', quoteBtn: 'Request a quote',
    quoteSubject: 'Quote request — {module}',
    serviceItems: [
      { name: 'Administrator training (video)', desc: 'Remote training session for administrators to get started with Concorde Workforce: employee management, time tracking, leave, approvals, dashboard and main configuration. Indicative duration: 2h30.', price: '€290' },
      { name: 'Expert guidance (video)', desc: 'Personalized remote guidance session for assistance, optimization, advice or operational support around Concorde Workforce. Indicative duration: 1h30.', price: '€190' },
      { name: 'Half-day guidance', desc: 'Personalized guidance dedicated to deployment, HR organization or optimizing platform usage.', price: '€490' },
      { name: 'Full-day guidance', desc: 'Full day of operational and strategic guidance: deployment, HR structuring, advanced training or internal process optimization.', price: '€890' },
    ],
    quoteModules: [
      { name: 'Assisted data import', desc: 'Technical assistance and support for the secure import of your existing employees, teams, structures and HR data into Concorde Workforce.' },
      { name: 'ERP / Payroll connectors', desc: 'Setup of standard connectors enabling data exchange between Concorde Workforce and certain compatible ERP or payroll software.' },
      { name: 'Custom ERP connectors', desc: "Development and integration of custom connectors based on the client's specific needs and the third-party software used within the organization." },
      { name: 'Advanced security audit', desc: 'Security audit and technical analysis to strengthen platform protection and identify potential vulnerabilities or areas for improvement.' },
      { name: 'Custom branding', desc: "Advanced customization of the Concorde Workforce environment to integrate the company's visual identity: logo, colors, brand elements and tailored user experience." },
    ],
  },
};

// Ouvre un Payment Link Stripe en injectant le slug du tenant (client_reference_id)
// quand il est disponible — rattache l'achat au bon tenant côté webhook.
function openStripeLink(url: string) {
  const slug = (typeof window !== 'undefined' && window.localStorage.getItem('tenantSlug')) || '';
  const full = slug ? `${url}?client_reference_id=${encodeURIComponent(slug)}` : url;
  window.open(full, '_blank', 'noopener,noreferrer');
}

// « Demander un devis » → email pré-rempli vers le support (pas de formulaire de
// contact dans l'espace authentifié, contrairement à la landing publique).
function requestQuote(moduleName: string, subjectTpl: string) {
  const subject = subjectTpl.replace('{module}', moduleName);
  window.location.href = `mailto:${QUOTE_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

const secHeading: React.CSSProperties = { fontFamily: 'inherit', fontSize: 16, fontWeight: 800, color: '#0040a1', letterSpacing: '.06em', textTransform: 'uppercase', margin: '0 0 6px' };
const secSub: React.CSSProperties = { color: '#64748b', margin: '0 0 20px', fontSize: 14, lineHeight: 1.55 };
const tblWrap: React.CSSProperties = { overflowX: 'auto', border: '2px solid #0040A1', borderRadius: 14, background: '#fff', boxShadow: '0 6px 22px rgba(15,23,42,.06)' };
const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 560 };
const thS: React.CSSProperties = { padding: '14px 16px', textAlign: 'left', fontWeight: 700, color: '#0f172a', background: '#f7f9fb', borderBottom: '2px solid #e5e7eb' };
const tdS: React.CSSProperties = { padding: '14px 16px', color: '#334155', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top', lineHeight: 1.5 };
const addBtnS: React.CSSProperties = { background: 'linear-gradient(135deg,#0040a1,#0056d2)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,64,161,.22)' };
const quoteBtnS: React.CSSProperties = { background: 'transparent', color: '#0040a1', border: '1.5px solid #0040a1', borderRadius: 9, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' };

export default function ServicesAccompagnementModal() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language === 'en' ? 'en' : 'fr';
  const d = LANG[lang];
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    const onOpen = () => { setTab(0); setOpen(true); };
    window.addEventListener(SERVICES_MODAL_EVENT, onOpen);
    return () => window.removeEventListener(SERVICES_MODAL_EVENT, onOpen);
  }, []);

  const close = () => setOpen(false);

  return (
    <Dialog
      open={open}
      onClose={close}
      fullScreen={fullScreen}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: fullScreen ? 0 : '18px', overflow: 'hidden' } }}
    >
      {/* En-tête dégradé bleu — badge + titre + sous-titre + fermeture */}
      <Box sx={{ position: 'relative', background: 'linear-gradient(135deg,#0a1f44 0%,#0040a1 100%)', color: '#fff', px: { xs: 3, sm: 4 }, py: { xs: 3, sm: 3.5 } }}>
        <IconButton
          onClick={close}
          aria-label="close"
          sx={{ position: 'absolute', top: 14, right: 14, color: '#fff', bgcolor: 'rgba(255,255,255,.12)', '&:hover': { bgcolor: 'rgba(255,255,255,.22)' } }}
        >
          <CloseIcon size={20} />
        </IconButton>
        <Box sx={{ display: 'inline-block', px: 1.5, py: 0.75, mb: 1.5, borderRadius: '8px', background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.25)' }}>
          <Typography component="span" sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            {d.badge}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: { xs: 22, sm: 28 }, fontWeight: 800, lineHeight: 1.15, pr: 5 }}>
          {d.title}
        </Typography>
        <Typography sx={{ mt: 1, fontSize: { xs: 13, sm: 14 }, color: 'rgba(255,255,255,.82)', maxWidth: 620, lineHeight: 1.5 }}>
          {d.subtitle}
        </Typography>
      </Box>

      {/* Onglets */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          borderBottom: '1px solid #e5e7eb',
          px: { xs: 2, sm: 3 },
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, fontSize: 15, color: '#64748b' },
          '& .Mui-selected': { color: '#0040a1 !important' },
          '& .MuiTabs-indicator': { backgroundColor: '#0040a1', height: 3 },
        }}
      >
        <Tab label={d.tabServices} />
        <Tab label={d.tabQuote} />
      </Tabs>

      {/* Contenu */}
      <Box sx={{ background: '#f7f9fb', px: { xs: 2.5, sm: 4 }, py: { xs: 3, sm: 3.5 }, maxHeight: fullScreen ? 'none' : '62vh', overflowY: 'auto' }}>
        {tab === 0 ? (
          <>
            <h3 style={secHeading}>{d.svcSectionTitle}</h3>
            <p style={secSub}>{d.svcSectionSub}</p>
            <div style={tblWrap}>
              <table style={tbl}>
                <thead>
                  <tr>
                    <th style={thS}>{d.svcCol}</th>
                    <th style={thS}>{d.descCol}</th>
                    <th style={{ ...thS, whiteSpace: 'nowrap' }}>{d.tarifCol}</th>
                    <th style={{ ...thS, textAlign: 'center' }} aria-label={d.addBtn} />
                  </tr>
                </thead>
                <tbody>
                  {d.serviceItems.map((s, i) => (
                    <tr key={s.name}>
                      <td style={{ ...tdS, fontWeight: 700, color: '#0f172a' }}>{s.name}</td>
                      <td style={tdS}>{s.desc}</td>
                      <td style={{ ...tdS, fontWeight: 700, color: '#0040a1', whiteSpace: 'nowrap' }}>{s.price}</td>
                      <td style={{ ...tdS, textAlign: 'center' }}>
                        <button type="button" style={addBtnS} onClick={() => openStripeLink(SERVICE_LINKS[i])}>{d.addBtn}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <h3 style={secHeading}>{d.quoteSectionTitle}</h3>
            <p style={secSub}>{d.quoteSectionSub}</p>
            <div style={tblWrap}>
              <table style={tbl}>
                <thead>
                  <tr>
                    <th style={thS}>{d.modCol}</th>
                    <th style={thS}>{d.descCol}</th>
                    <th style={{ ...thS, textAlign: 'center' }} aria-label={d.quoteBtn} />
                  </tr>
                </thead>
                <tbody>
                  {d.quoteModules.map((q) => (
                    <tr key={q.name}>
                      <td style={{ ...tdS, fontWeight: 700, color: '#0f172a' }}>{q.name}</td>
                      <td style={tdS}>{q.desc}</td>
                      <td style={{ ...tdS, textAlign: 'center' }}>
                        <button type="button" style={quoteBtnS} onClick={() => requestQuote(q.name, d.quoteSubject)}>{d.quoteBtn}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Box>
    </Dialog>
  );
}
