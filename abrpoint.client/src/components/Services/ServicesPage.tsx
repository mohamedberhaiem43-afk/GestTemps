import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Paper, Button, Stack } from '@mui/material';
import { Server } from 'lucide-react';

/**
 * ServicesPage — catalogue « Services & accompagnement » (add-ons d'abonnement +
 * prestations à l'acte). Repris de la maquette « Concorde Platform » mais adapté
 * au thème de l'application : composants MUI (donc compatibles dark mode) et
 * boutons en bleu primaire (#0040a1) — PAS le vert/teal de la maquette d'origine,
 * pour rester cohérent avec le reste des interfaces.
 *
 * CTA câblés sur les parcours existants :
 *   - « Activer »            → /dashboard/mon-abonnement (gestion d'abonnement)
 *   - « Demander un devis »  → /contact-sales (formulaire commercial)
 *   - « Réserver »           → /contact-sales (prise de contact / planification)
 */

type Cta = 'activer' | 'devis' | 'reserver';

interface PriceParts {
  from?: string;   // ex. « à partir de »
  amount: string;  // ex. « +199 € » / « 390 € » / « Sur devis »
  unit?: string;   // ex. « / mois » / « / jour »
}

interface AddonDef {
  icon: React.ReactNode;
  title: string;
  desc: string;
  price: PriceParts;
  cta: Cta;
}

const ADDONS: AddonDef[] = [
  // {
  //   icon: <Code2 size={22} />,
  //   title: 'API publique',
  //   desc: 'Accès programmatique à vos données et automatisation de vos flux.',
  //   price: { amount: '+199 €', unit: '/ mois' },
  //   cta: 'activer',
  // },
  // {
  //   icon: <Headphones size={22} />,
  //   title: 'Support prioritaire 24/7',
  //   desc: 'Ligne dédiée et réponse garantie sous une heure, jour et nuit.',
  //   price: { amount: '+149 €', unit: '/ mois' },
  //   cta: 'activer',
  // },
  {
    icon: <Server size={22} />,
    title: 'Hébergement dédié',
    desc: 'Infrastructure isolée et données cloisonnées pour votre organisation.',
    price: { from: 'à partir de', amount: '390 €', unit: '/ mois' },
    cta: 'devis',
  },
];

type TagCat = 'formation' | 'demarrage' | 'integration' | 'securite' | 'accompagnement';

// Pastels « îlots » : chaque puce porte son propre fond clair + texte foncé, donc
// reste lisible en mode clair comme sombre. Aucune teinte verte (cf. demande).
const TAG_STYLES: Record<TagCat, { bg: string; color: string; label: string }> = {
  formation: { bg: '#e6f1fb', color: '#0c447c', label: 'Formation' },
  demarrage: { bg: '#eef0f4', color: '#475569', label: 'Démarrage' },
  integration: { bg: '#e8f0fe', color: '#0040a1', label: 'Intégration' },
  securite: { bg: '#faeeda', color: '#854f0b', label: 'Sécurité' },
  accompagnement: { bg: '#e6f1fb', color: '#0c447c', label: 'Accompagnement' },
};

interface PrestaDef {
  cat: TagCat;
  title: string;
  price: PriceParts;
  cta: Cta;
}

const PRESTATIONS: PrestaDef[] = [
  { cat: 'formation', title: 'Formation admins (visio)', price: { amount: '290 €' }, cta: 'reserver' },
  { cat: 'formation', title: 'Formation sur site', price: { from: 'à partir de', amount: '790 €', unit: '/ jour' }, cta: 'devis' },
  { cat: 'demarrage', title: 'Onboarding Premium', price: { from: 'à partir de', amount: '390 €' }, cta: 'devis' },
  { cat: 'demarrage', title: 'Import de données assisté', price: { from: 'à partir de', amount: '250 €' }, cta: 'devis' },
  { cat: 'integration', title: 'Connecteurs ERP / Paie', price: { from: 'à partir de', amount: '490 €' }, cta: 'devis' },
  { cat: 'integration', title: 'Connecteurs ERP sur mesure', price: { amount: 'Sur devis' }, cta: 'devis' },
  { cat: 'securite', title: 'Pen-test annuel', price: { from: 'à partir de', amount: '1 500 €' }, cta: 'devis' },
  { cat: 'accompagnement', title: 'Session visio', price: { from: 'à partir de', amount: '190 €' }, cta: 'reserver' },
  { cat: 'accompagnement', title: 'Demi-journée', price: { from: 'à partir de', amount: '390 €' }, cta: 'reserver' },
  { cat: 'accompagnement', title: 'Journée complète', price: { from: 'à partir de', amount: '690 €' }, cta: 'reserver' },
];

function Price({ price, size = 26 }: { price: PriceParts; size?: number }) {
  return (
    <Box sx={{ mb: 2.2 }}>
      {price.from && (
        <Typography component="span" sx={{ display: 'block', fontSize: 13, color: 'text.disabled', mb: '2px' }}>
          {price.from}
        </Typography>
      )}
      <Typography component="span" sx={{ fontSize: size, fontWeight: 800, letterSpacing: '-0.01em', color: 'text.primary' }}>
        {price.amount}
      </Typography>
      {price.unit && (
        <Typography component="span" sx={{ fontSize: 14, fontWeight: 500, color: 'text.disabled', ml: 0.5 }}>
          {price.unit}
        </Typography>
      )}
    </Box>
  );
}

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

export default function ServicesPage() {
  const navigate = useNavigate();

  const handleCta = (cta: Cta) => {
    if (cta === 'activer') navigate('/dashboard/mon-abonnement');
    else navigate('/contact-sales');
  };

  const ctaLabel = (cta: Cta) => (cta === 'activer' ? 'Activer' : cta === 'reserver' ? 'Réserver' : 'Demander un devis');
  const ctaVariant = (cta: Cta): 'contained' | 'outlined' => (cta === 'devis' ? 'outlined' : 'contained');

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
          Catalogue
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, mb: 1.5 }}>
          Services &amp; accompagnement
        </Typography>
        <Typography sx={{ fontSize: 18, color: 'text.secondary' }}>
          Activez des options en quelques clics ou demandez un devis pour un accompagnement adapté à votre organisation.
        </Typography>
      </Box>

      {/* ── Options d'abonnement ───────────────────────────── */}
      <Box component="section" sx={{ mb: 6 }}>
        <SectionHead title="Options d'abonnement" note="facturées chaque mois, résiliables à tout moment" />
        <Box sx={grid(280)}>
          {ADDONS.map((a) => (
            <Paper key={a.title} elevation={0} sx={cardSx}>
              <Box
                sx={{
                  width: 42, height: 42, borderRadius: 2.5, mb: 2,
                  display: 'grid', placeItems: 'center',
                  bgcolor: 'primary.main', color: 'primary.contrastText',
                }}
              >
                {a.icon}
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', mb: 0.5 }}>
                {a.title}
              </Typography>
              <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 2.25, flex: 1 }}>
                {a.desc}
              </Typography>
              <Price price={a.price} />
              <Button
                fullWidth
                variant={ctaVariant(a.cta)}
                onClick={() => handleCta(a.cta)}
                sx={{ fontWeight: 700, py: 1.25, borderRadius: 2 }}
              >
                {ctaLabel(a.cta)}
              </Button>
            </Paper>
          ))}
        </Box>
      </Box>

      {/* ── Prestations & accompagnement ───────────────────── */}
      <Box component="section">
        <SectionHead title="Prestations & accompagnement" note="facturées à l'acte" />
        <Box sx={grid(244)}>
          {PRESTATIONS.map((p) => {
            const tag = TAG_STYLES[p.cat];
            return (
              <Paper key={p.title} elevation={0} sx={{ ...cardSx, p: 2.5 }}>
                <Box
                  sx={{
                    alignSelf: 'flex-start', mb: 1.75, px: 1.25, py: 0.5, borderRadius: 99,
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                    bgcolor: tag.bg, color: tag.color,
                  }}
                >
                  {tag.label}
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.01em', mb: 1 }}>
                  {p.title}
                </Typography>
                <Price price={p.price} size={20} />
                <Box sx={{ flex: 1 }} />
                <Button
                  fullWidth
                  variant={ctaVariant(p.cta)}
                  onClick={() => handleCta(p.cta)}
                  sx={{ fontWeight: 700, py: 1.1, borderRadius: 2 }}
                >
                  {ctaLabel(p.cta)}
                </Button>
              </Paper>
            );
          })}
        </Box>
      </Box>

      <Stack alignItems="center" sx={{ mt: 6, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 13, color: 'text.disabled', textAlign: 'center' }}>
          Tarifs hors taxes. Les prestations sur devis font l'objet d'une proposition personnalisée sous 48&nbsp;h.
        </Typography>
      </Stack>
    </Container>
  );
}
