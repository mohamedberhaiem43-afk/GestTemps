import { useMemo, useState } from 'react';
import {
  Box, Typography, ToggleButton, ToggleButtonGroup, Chip, Stack, Paper, Divider,
  Switch, Collapse, IconButton,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import StarsIcon from '@mui/icons-material/Stars';

/**
 * Pack picker compact inséré dans le formulaire d'inscription. Volontairement plus
 * simple que PlanConfigurationPage (qui sert au upgrade/changement post-signup) :
 * 3 cards + toggle cycle + section repliable « Modules supplémentaires ».
 *
 * Source de vérité tarifaire : ABRPOINT.Server.Tenancy.PlanCatalog (backend).
 * Ce miroir front sert juste à l'affichage simulation — toute évolution de prix
 * doit être propagée des deux côtés simultanément, sinon le récap au signup
 * et la facture Stripe divergent.
 *
 * Pendant l'essai gratuit 30j, AUCUN paiement n'est déclenché — le pack choisi
 * détermine simplement les features ouvertes (planFeatures via /me). Les addons
 * cochés ici sont conservés en sessionStorage pour pré-remplir le futur Stripe
 * Checkout déclenché depuis /mon-abonnement.
 */

export type PlanKey = 'Starter' | 'Standard' | 'Premium';
export type Cycle = 'monthly' | 'annual';
export type AddonKey =
  | 'aiAssistantRh'
  | 'iaDocumentaireAvancee'
  | 'signatureElectronique'
  | 'apiAvancee'
  | 'supportPrioritaire';

interface PlanDef {
  key: PlanKey;
  displayName: string;
  priceMonthly: number;
  priceAnnualMonthly: number; // mensualisé pour engagement annuel
  includedEmployees: number;
  highlights: string[]; // 3-5 lignes courtes
  badge?: string;       // chip optionnelle « Recommandé »
}

const PLANS: PlanDef[] = [
  {
    key: 'Starter',
    displayName: 'Starter',
    priceMonthly: 99,
    priceAnnualMonthly: 69,
    includedEmployees: 10,
    highlights: [
      'Pointage web & mobile',
      'Gestion des congés & autorisations',
      'Jusqu\'à 10 collaborateurs inclus',
      'Support email standard',
    ],
  },
  {
    key: 'Standard',
    displayName: 'Standard',
    priceMonthly: 219,
    priceAnnualMonthly: 119,
    includedEmployees: 25,
    badge: 'Recommandé',
    highlights: [
      'Tout Starter + multi-sites (5 max)',
      'Géolocalisation, coffre numérique',
      'Contrats, notes de frais, allaitement',
      'Signature électronique simple',
      'Import Excel en masse, scan OCR',
    ],
  },
  {
    key: 'Premium',
    displayName: 'Business',
    priceMonthly: 449,
    priceAnnualMonthly: 249,
    includedEmployees: 50,
    highlights: [
      'Tout Standard + multi-sociétés illimité',
      'Assistant IA RH (RAG documentaire)',
      'Audit logs avancés, branding custom',
      'Sécurité renforcée (device trust, screenshot block)',
      'Support prioritaire',
    ],
  },
];

interface AddonDef {
  key: AddonKey;
  displayName: string;
  description: string;
  priceMonthly: number;
}

const ADDONS: AddonDef[] = [
  { key: 'aiAssistantRh',         displayName: 'Assistant RH IA',                  description: 'Aide à la rédaction RH, recherche multi-sources, automatisations.', priceMonthly: 49 },
  { key: 'iaDocumentaireAvancee', displayName: 'IA documentaire avancée',          description: 'Recherche RAG sur vos archives RH, embeddings vectoriels.',       priceMonthly: 149 },
  { key: 'signatureElectronique', displayName: 'Signature électronique avancée',   description: 'Signature qualifiée eIDAS, parapheur multi-signataires.',         priceMonthly: 19 },
  { key: 'apiAvancee',            displayName: 'API avancée',                      description: 'Accès programmatique pour intégrer à votre SIRH / paie / ERP.',   priceMonthly: 79 },
  { key: 'supportPrioritaire',    displayName: 'Support prioritaire étendu',       description: 'Réponse sous 2h ouvrées, hotline dédiée, account manager.',      priceMonthly: 49 },
];

interface PlanPickerProps {
  selectedPlan: PlanKey;
  onPlanChange: (plan: PlanKey) => void;
  selectedCycle: Cycle;
  onCycleChange: (cycle: Cycle) => void;
  selectedAddons: AddonKey[];
  onAddonsChange: (addons: AddonKey[]) => void;
}

export default function PlanPicker({
  selectedPlan, onPlanChange,
  selectedCycle, onCycleChange,
  selectedAddons, onAddonsChange,
}: PlanPickerProps) {
  const [addonsOpen, setAddonsOpen] = useState(false);

  const toggleAddon = (key: AddonKey) => {
    onAddonsChange(
      selectedAddons.includes(key)
        ? selectedAddons.filter(k => k !== key)
        : [...selectedAddons, key]
    );
  };

  // Total mensuel simulé — purement indicatif, pas facturé pendant l'essai.
  // On affiche en bas de la section pour donner une visibilité immédiate du coût
  // post-essai à l'utilisateur. Recalculé à chaque toggle.
  const totalMonthly = useMemo(() => {
    const plan = PLANS.find(p => p.key === selectedPlan);
    if (!plan) return 0;
    const planPart = selectedCycle === 'annual' ? plan.priceAnnualMonthly : plan.priceMonthly;
    const addonsPart = selectedAddons.reduce((acc, k) => {
      const a = ADDONS.find(x => x.key === k);
      return acc + (a?.priceMonthly ?? 0);
    }, 0);
    return planPart + addonsPart;
  }, [selectedPlan, selectedCycle, selectedAddons]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
          Choisissez votre formule
        </Typography>
        <ToggleButtonGroup
          value={selectedCycle}
          exclusive
          size="small"
          onChange={(_, v) => v && onCycleChange(v)}
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none', fontWeight: 700, px: 2, py: 0.5,
              '&.Mui-selected': { bgcolor: '#0040a1', color: '#fff', '&:hover': { bgcolor: '#003080' } },
            },
          }}
        >
          <ToggleButton value="annual">Annuel <Chip size="small" label="-45%" sx={{ ml: 0.7, height: 18, fontSize: 10, bgcolor: '#10b981', color: '#fff' }} /></ToggleButton>
          <ToggleButton value="monthly">Mensuel</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Typography sx={{ fontSize: 12, color: '#64748b', mb: 2 }}>
        30 jours d'essai gratuit sans carte bancaire — la facturation ne démarre qu'à la fin de l'essai.
      </Typography>

      {/* 3 cards plan en grille responsive : 1 col mobile, 3 cols desktop */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
        gap: 1.5,
        mb: 2,
      }}>
        {PLANS.map(plan => {
          const selected = plan.key === selectedPlan;
          const price = selectedCycle === 'annual' ? plan.priceAnnualMonthly : plan.priceMonthly;
          return (
            <Paper
              key={plan.key}
              elevation={0}
              onClick={() => onPlanChange(plan.key)}
              sx={{
                p: 2, borderRadius: 2.5, cursor: 'pointer',
                border: '2px solid',
                borderColor: selected ? '#0040a1' : '#e2e8f0',
                bgcolor: selected ? '#f0f6ff' : '#fff',
                position: 'relative',
                transition: 'all 0.15s',
                '&:hover': { borderColor: selected ? '#0040a1' : '#94a3b8' },
              }}
            >
              {plan.badge && (
                <Chip
                  label={plan.badge}
                  size="small"
                  icon={<StarsIcon sx={{ fontSize: 14 }} />}
                  sx={{
                    position: 'absolute', top: -10, right: 10,
                    bgcolor: '#0040a1', color: '#fff', fontWeight: 700, fontSize: 11,
                    '& .MuiChip-icon': { color: '#fff' },
                  }}
                />
              )}
              <Stack direction="row" alignItems="baseline" justifyContent="space-between" mb={0.5}>
                <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>
                  {plan.displayName}
                </Typography>
                {selected && <CheckIcon sx={{ color: '#0040a1', fontSize: 18 }} />}
              </Stack>
              <Box sx={{ mb: 1.5 }}>
                <Typography component="span" sx={{ fontWeight: 800, fontSize: 22, color: '#0040a1' }}>
                  {price}€
                </Typography>
                <Typography component="span" sx={{ fontSize: 12, color: '#64748b', ml: 0.5 }}>
                  / mois HT
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>
                  {plan.includedEmployees} collaborateurs inclus
                </Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Stack spacing={0.5}>
                {plan.highlights.map((h, i) => (
                  <Stack key={i} direction="row" spacing={0.7} alignItems="flex-start">
                    <CheckIcon sx={{ color: '#10b981', fontSize: 14, mt: '2px', flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 12, color: '#334155', lineHeight: 1.35 }}>{h}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          );
        })}
      </Box>

      {/* Section addons repliée par défaut — la majorité des nouveaux clients démarre
          sans add-on et les ajoute plus tard depuis /mon-abonnement. */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ p: 1.5, cursor: 'pointer' }}
          onClick={() => setAddonsOpen(o => !o)}
        >
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
              Modules supplémentaires {selectedAddons.length > 0 && (
                <Chip
                  size="small"
                  label={selectedAddons.length}
                  sx={{ ml: 1, height: 18, fontSize: 11, bgcolor: '#0040a1', color: '#fff' }}
                />
              )}
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#64748b' }}>
              Optionnels — facturés en plus de la formule choisie.
            </Typography>
          </Box>
          <IconButton size="small">
            {addonsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>
        <Collapse in={addonsOpen}>
          <Divider />
          <Stack divider={<Divider />}>
            {ADDONS.map(addon => {
              const checked = selectedAddons.includes(addon.key);
              return (
                <Stack
                  key={addon.key}
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{ p: 1.5 }}
                >
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                      {addon.displayName}
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: '#64748b', lineHeight: 1.4 }}>
                      {addon.description}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#0040a1' }}>
                      +{addon.priceMonthly}€<Typography component="span" sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}> /mois</Typography>
                    </Typography>
                  </Box>
                  <Switch
                    checked={checked}
                    onChange={() => toggleAddon(addon.key)}
                    size="small"
                  />
                </Stack>
              );
            })}
          </Stack>
        </Collapse>
      </Paper>

      {/* Récap total — affiche le coût mensuel post-essai pour pleine transparence */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          mt: 2, p: 1.5, borderRadius: 2,
          bgcolor: '#f8fafc', border: '1px solid #e2e8f0',
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
            Total à la fin de l'essai
          </Typography>
          <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>
            {selectedCycle === 'annual' ? 'Engagement annuel — facturation mensuelle' : 'Mensuel sans engagement'}
          </Typography>
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#0040a1' }}>
          {totalMonthly}€<Typography component="span" sx={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}> /mois HT</Typography>
        </Typography>
      </Stack>
    </Box>
  );
}
