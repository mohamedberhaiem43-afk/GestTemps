import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Paper, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  GraduationCap, Headset, CalendarClock, CalendarDays,
  Database, Plug, Wrench, ShieldCheck, Palette,
} from 'lucide-react';

/**
 * ServicesPage — catalogue « Services & accompagnement » de l'espace abonnement.
 *
 * ALIGNÉ sur la section services de la page d'accueil (HomePage.tsx) : mêmes
 * 3 blocs, mêmes intitulés, mêmes descriptions et mêmes tarifs —
 *   1. Modules optionnels  → Payment Links Stripe (OPTIONAL_MODULE_LINKS), bouton « Ajouter »
 *   2. Nos services        → Payment Links Stripe (SERVICE_LINKS), bouton « Réserver »
 *   3. Sur devis           → bouton « Demander un devis » → /contact-sales
 *
 * Bilingue FR / EN via react-i18next (même pattern que HomePage : dict local
 * sélectionné par i18n.language). Les Payment Links reçoivent ?client_reference_id={slug}
 * (slug lu dans localStorage) pour que le webhook rattache l'achat au tenant.
 */

// ── Payment Links Stripe (identiques à HomePage) ────────────────────────────
// NB : la table « Modules optionnels » (Assistant RH IA / Signature / Stockage) a été
// retirée de cette page et de la home (décision 2026-06) → plus de OPTIONAL_MODULE_LINKS.
const SERVICE_LINKS = [
  'https://buy.stripe.com/3cI14g7Cl4RjaNF9NL0000d', // Formation administrateurs (visio) — 290 €
  'https://buy.stripe.com/aFa3coe0J97zcVN3pn0000e', // Accompagnement Expert (visio) — 190 €
  'https://buy.stripe.com/3cI00c6yhbfH8Fxgc90000f', // Accompagnement demi-journée — 490 €
  'https://buy.stripe.com/dRmcMY5udabDaNF1hf0000g', // Journée complète d'accompagnement — 890 €
];

type Lang = 'fr' | 'en';

interface Item { name: string; desc: string; price?: string; }
interface SvcDict {
  catalog: string;
  heroTitle: string;
  heroSub: string;
  optTitle: string; optNote: string;
  svcTitle: string; svcNote: string;
  quoteTitle: string; quoteNote: string;
  addBtn: string; reserveBtn: string; quoteBtn: string; onQuote: string;
  optModules: Item[];
  serviceItems: Item[];
  quoteModules: Item[];
  footer: string;
}

const FR: SvcDict = {
  catalog: 'Catalogue',
  heroTitle: 'Services & accompagnement',
  heroSub: 'Activez des modules en quelques clics ou demandez un devis pour un accompagnement adapté à votre organisation.',
  optTitle: 'Modules optionnels',
  optNote: 'facturation Stripe sécurisée, essai inclus, sans engagement',
  svcTitle: 'Nos services',
  svcNote: 'formation et accompagnement par nos experts',
  quoteTitle: 'Modules et services sur devis',
  quoteNote: 'proposition personnalisée sous 48 h',
  addBtn: 'Ajouter',
  reserveBtn: 'Réserver',
  quoteBtn: 'Demander un devis',
  onQuote: 'Sur devis',
  optModules: [
    { name: 'Assistant RH IA', desc: "Module d'assistance intelligente destiné à accompagner les équipes RH dans certaines tâches administratives.", price: '79 € / mois' },
    { name: 'Signature électronique', desc: 'Signature électronique sécurisée de documents RH, validations internes et workflows administratifs.', price: '19 € / mois' },
    { name: 'Stockage supplémentaire 100 Go', desc: 'Extension de capacité de stockage sécurisée pour documents, exports, pièces jointes et données complémentaires.', price: '29 € / mois' },
  ],
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
  footer: "Tarifs hors taxes. Les prestations sur devis font l'objet d'une proposition personnalisée sous 48 h.",
};

const EN: SvcDict = {
  catalog: 'Catalog',
  heroTitle: 'Services & guidance',
  heroSub: 'Enable modules in a few clicks or request a quote for guidance tailored to your organization.',
  optTitle: 'Optional modules',
  optNote: 'secure Stripe billing, trial included, no commitment',
  svcTitle: 'Our services',
  svcNote: 'training and guidance from our experts',
  quoteTitle: 'Modules and services on quote',
  quoteNote: 'tailored proposal within 48h',
  addBtn: 'Add',
  reserveBtn: 'Book',
  quoteBtn: 'Request a quote',
  onQuote: 'On quote',
  optModules: [
    { name: 'HR AI Assistant', desc: 'Intelligent assistance module designed to support HR teams with certain administrative tasks.', price: '€79 / mo' },
    { name: 'Electronic signature', desc: 'Secure electronic signature of HR documents, internal approvals and administrative workflows.', price: '€19 / mo' },
    { name: 'Extra storage 100 GB', desc: 'Secure storage capacity extension for documents, exports, attachments and additional platform data.', price: '€29 / mo' },
  ],
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
  footer: 'Prices exclude tax. Services on quote are subject to a personalized proposal within 48h.',
};

const LANG: Record<Lang, SvcDict> = { fr: FR, en: EN };

// Icônes par item (ordre = dict). lucide-react, cohérentes avec le reste de l'app.
const SVC_ICONS = [<GraduationCap size={22} />, <Headset size={22} />, <CalendarClock size={22} />, <CalendarDays size={22} />];
const QUOTE_ICONS = [<Database size={22} />, <Plug size={22} />, <Wrench size={22} />, <ShieldCheck size={22} />, <Palette size={22} />];

const cardSx = {
  p: 3,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 3,
  border: '1px solid',
  borderColor: 'divider',
  transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
  '&:hover': {
    transform: 'translateY(-3px)',
    boxShadow: '0 8px 24px rgba(15,23,42,0.10)',
    borderColor: 'primary.main',
  },
} as const;

function SectionHead({ title, note }: { title: string; note: string }) {
  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap',
        mb: 2.5, pb: 1.75, borderBottom: '1px solid', borderColor: 'divider',
      }}
    >
      <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>{title}</Typography>
      <Typography sx={{ fontSize: 14, color: 'text.disabled' }}>{note}</Typography>
    </Box>
  );
}

// Carte service générique : icône, nom, description, prix (ou « Sur devis »), CTA.
function ServiceCard({
  icon, name, desc, price, onQuoteLabel, ctaLabel, ctaVariant, onClick,
}: {
  icon: React.ReactNode;
  name: string;
  desc: string;
  price?: string;
  onQuoteLabel: string;
  ctaLabel: string;
  ctaVariant: 'contained' | 'outlined';
  onClick: () => void;
}) {
  return (
    <Paper elevation={0} sx={cardSx}>
      <Box
        sx={{
          width: 42, height: 42, borderRadius: 2.5, mb: 2,
          display: 'grid', placeItems: 'center',
          bgcolor: 'primary.main', color: 'primary.contrastText',
        }}
      >
        {icon}
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', mb: 0.75 }}>
        {name}
      </Typography>
      <Typography sx={{ fontSize: 13.5, color: 'text.secondary', mb: 2.25, flex: 1, lineHeight: 1.55 }}>
        {desc}
      </Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', color: price ? 'primary.main' : 'text.primary', mb: 2 }}>
        {price ?? onQuoteLabel}
      </Typography>
      <Button
        fullWidth
        variant={ctaVariant}
        onClick={onClick}
        sx={{ fontWeight: 700, py: 1.2, borderRadius: 2 }}
      >
        {ctaLabel}
      </Button>
    </Paper>
  );
}

export default function ServicesPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language === 'en' ? 'en' : 'fr';
  const d = LANG[lang];

  // Ouvre un Payment Link Stripe en injectant ?client_reference_id={slug} (slug du tenant
  // courant en localStorage) pour que le webhook rattache l'achat au bon tenant.
  const openStripeLink = (url: string) => {
    const slug = (typeof window !== 'undefined' && window.localStorage.getItem('tenantSlug')) || '';
    const full = slug ? `${url}?client_reference_id=${encodeURIComponent(slug)}` : url;
    window.open(full, '_blank', 'noopener,noreferrer');
  };

  const grid = (min: number) => ({
    display: 'grid',
    gap: 2.25,
    gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
  });

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      {/* ── Hero ───────────────────────────────────────────── */}
      <Box sx={{ maxWidth: 640, mb: 5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'primary.main', mb: 1.25 }}>
          {d.catalog}
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, mb: 1.5 }}>
          {d.heroTitle}
        </Typography>
        <Typography sx={{ fontSize: 18, color: 'text.secondary' }}>
          {d.heroSub}
        </Typography>
      </Box>

      {/* ── Nos services (Payment Links Stripe) ────────────── */}
      <Box component="section" sx={{ mb: 6 }}>
        <SectionHead title={d.svcTitle} note={d.svcNote} />
        <Box sx={grid(280)}>
          {d.serviceItems.map((s, i) => (
            <ServiceCard
              key={s.name}
              icon={SVC_ICONS[i]}
              name={s.name}
              desc={s.desc}
              price={s.price}
              onQuoteLabel={d.onQuote}
              ctaLabel={d.reserveBtn}
              ctaVariant="contained"
              onClick={() => openStripeLink(SERVICE_LINKS[i])}
            />
          ))}
        </Box>
      </Box>

      {/* ── Modules et services sur devis ──────────────────── */}
      <Box component="section">
        <SectionHead title={d.quoteTitle} note={d.quoteNote} />
        <Box sx={grid(280)}>
          {d.quoteModules.map((q, i) => (
            <ServiceCard
              key={q.name}
              icon={QUOTE_ICONS[i]}
              name={q.name}
              desc={q.desc}
              onQuoteLabel={d.onQuote}
              ctaLabel={d.quoteBtn}
              ctaVariant="outlined"
              onClick={() => navigate('/contact-sales')}
            />
          ))}
        </Box>
      </Box>

      <Box sx={{ mt: 6, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 13, color: 'text.disabled', textAlign: 'center' }}>
          {d.footer}
        </Typography>
      </Box>
    </Container>
  );
}
