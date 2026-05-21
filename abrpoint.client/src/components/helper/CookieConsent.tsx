import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogContent,
  Switch,
  Divider,
  Collapse,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';

// Clé v2 : structure JSON avec catégories.
// On garde la lecture de l'ancienne clé v1 pour ne pas réafficher la bannière
// aux utilisateurs qui avaient déjà choisi avant la mise à jour RGPD.
const CONSENT_KEY = 'abrpoint.cookie-consent.v2';
const LEGACY_CONSENT_KEY = 'abrpoint.cookie-consent';
const LEGACY_CONSENT_DATE_KEY = 'abrpoint.cookie-consent-date';
const CONSENT_VERSION = 2;

export type ConsentCategories = {
  // Traceurs strictement nécessaires : exemptés de consentement (CNIL),
  // donc toujours actifs et non désactivables côté UI.
  necessary: true;
  // Mesure d'audience : exemptée si conforme aux lignes directrices CNIL
  // (anonymisation, pas de croisement, finalité strictement statistique).
  // En l'absence de configuration certifiée, on demande le consentement.
  audience: boolean;
  // Personnalisation / marketing : consentement libre, spécifique, éclairé.
  marketing: boolean;
};

type StoredConsent = {
  categories: ConsentCategories;
  date: string;
  version: number;
};

const DEFAULT_REJECTED: ConsentCategories = {
  necessary: true,
  audience: false,
  marketing: false,
};

const DEFAULT_ACCEPTED: ConsentCategories = {
  necessary: true,
  audience: true,
  marketing: true,
};

export function getCookieConsent(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredConsent;
      if (parsed && parsed.version === CONSENT_VERSION && parsed.categories) {
        return parsed;
      }
    }
    // Migration depuis l'ancien format ('accepted' | 'rejected').
    const legacy = localStorage.getItem(LEGACY_CONSENT_KEY);
    if (legacy === 'accepted' || legacy === 'rejected') {
      const legacyDate =
        localStorage.getItem(LEGACY_CONSENT_DATE_KEY) || new Date().toISOString();
      const migrated: StoredConsent = {
        categories: legacy === 'accepted' ? DEFAULT_ACCEPTED : DEFAULT_REJECTED,
        date: legacyDate,
        version: CONSENT_VERSION,
      };
      try {
        localStorage.setItem(CONSENT_KEY, JSON.stringify(migrated));
      } catch { /* storage indisponible */ }
      return migrated;
    }
  } catch { /* JSON corrompu : on retraite comme premier passage */ }
  return null;
}

export function hasConsent(category: keyof ConsentCategories): boolean {
  const c = getCookieConsent();
  if (!c) return category === 'necessary';
  return Boolean(c.categories[category]);
}

export function clearCookieConsent() {
  localStorage.removeItem(CONSENT_KEY);
  localStorage.removeItem(LEGACY_CONSENT_KEY);
  localStorage.removeItem(LEGACY_CONSENT_DATE_KEY);
  window.dispatchEvent(new CustomEvent('cookie-consent:cleared'));
}

export function openCookieConsent() {
  window.dispatchEvent(new CustomEvent('cookie-consent:open'));
}

type CategoryRowProps = {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
  badge?: string;
};

function CategoryRow({ title, description, checked, disabled, onChange, badge }: CategoryRowProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 2,
        py: 1.5,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
            {title}
          </Typography>
          {badge && (
            <Typography
              component="span"
              sx={{
                fontSize: 11,
                fontWeight: 700,
                px: 1,
                py: 0.25,
                borderRadius: '999px',
                backgroundColor: '#e0f2fe',
                color: '#0369a1',
                textTransform: 'uppercase',
                letterSpacing: 0.3,
              }}
            >
              {badge}
            </Typography>
          )}
        </Box>
        <Typography sx={{ fontSize: 13, color: '#475569', lineHeight: 1.55 }}>
          {description}
        </Typography>
      </Box>
      <Switch
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        inputProps={{ 'aria-label': title }}
      />
    </Box>
  );
}

export default function CookieConsent() {
  const { t } = useTranslation();
  // Lecture synchrone au montage pour éviter le flash de bannière.
  const [open, setOpen] = useState(() => getCookieConsent() === null);
  const [showDetails, setShowDetails] = useState(false);

  const initial = getCookieConsent();
  const [audience, setAudience] = useState<boolean>(initial?.categories.audience ?? false);
  const [marketing, setMarketing] = useState<boolean>(initial?.categories.marketing ?? false);

  useEffect(() => {
    const handler = () => {
      const current = getCookieConsent();
      setAudience(current?.categories.audience ?? false);
      setMarketing(current?.categories.marketing ?? false);
      setShowDetails(false);
      setOpen(true);
    };
    window.addEventListener('cookie-consent:open', handler);
    return () => window.removeEventListener('cookie-consent:open', handler);
  }, []);

  const persist = (categories: ConsentCategories) => {
    const payload: StoredConsent = {
      categories,
      date: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(payload));
      // Nettoie l'ancien format si présent.
      localStorage.removeItem(LEGACY_CONSENT_KEY);
      localStorage.removeItem(LEGACY_CONSENT_DATE_KEY);
    } catch { /* storage indisponible */ }
    window.dispatchEvent(new CustomEvent('cookie-consent:changed', { detail: payload }));
    setOpen(false);
  };

  const acceptAll = () => persist(DEFAULT_ACCEPTED);
  const rejectAll = () => persist(DEFAULT_REJECTED);
  const saveSelection = () =>
    persist({ necessary: true, audience, marketing });

  return (
    <Dialog
      open={open}
      // Pas de fermeture au backdrop / Escape : RGPD exige un choix actif.
      disableEscapeKeyDown
      onClose={(_, reason) => {
        if (reason === 'backdropClick') return;
        // Toute autre fermeture programmatique passe par les boutons.
      }}
      maxWidth="sm"
      fullWidth
      aria-labelledby="cookie-consent-title"
      PaperProps={{
        sx: {
          borderRadius: '16px',
          padding: 0,
          maxWidth: 600,
        },
      }}
      sx={{ '& .MuiDialog-paper': { m: 2 } }}
    >
      <DialogContent sx={{ p: { xs: 3, sm: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Typography
            id="cookie-consent-title"
            sx={{ fontWeight: 800, fontSize: { xs: 18, sm: 20 }, color: '#0f172a' }}
          >
            {t('cookieConsent.title')}
          </Typography>
          <LockOutlinedIcon sx={{ color: '#10b981', fontSize: 22 }} />
        </Box>

        <Typography sx={{ fontSize: 14, color: '#475569', lineHeight: 1.6, mb: 1.5 }}>
          {t('cookieConsent.intro')}
        </Typography>
        <Typography sx={{ fontSize: 13, color: '#475569', lineHeight: 1.6, mb: 1.5, fontStyle: 'italic' }}>
          {t('cookieConsent.aiProcessor')}
        </Typography>
        <Typography sx={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, mb: 2 }}>
          {t('cookieConsent.changeLater')}
        </Typography>

        <Box sx={{ mb: showDetails ? 1 : 2 }}>
          <Button
            onClick={() => setShowDetails((v) => !v)}
            startIcon={
              <ExpandMoreIcon
                sx={{
                  transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}
              />
            }
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: 13,
              color: '#0040a1',
              p: 0,
              minWidth: 0,
              '&:hover': { background: 'transparent', textDecoration: 'underline' },
            }}
            aria-expanded={showDetails}
            aria-controls="cookie-consent-details"
          >
            {showDetails ? t('cookieConsent.hideDetails') : t('cookieConsent.customize')}
          </Button>
        </Box>

        <Collapse in={showDetails} timeout="auto" unmountOnExit>
          <Box id="cookie-consent-details" sx={{ mb: 2 }}>
            <Divider sx={{ my: 1 }} />
            <CategoryRow
              title={t('cookieConsent.cat.necessary.title')}
              description={t('cookieConsent.cat.necessary.desc')}
              checked
              disabled
              badge={t('cookieConsent.alwaysActive')}
            />
            <Divider />
            <CategoryRow
              title={t('cookieConsent.cat.audience.title')}
              description={t('cookieConsent.cat.audience.desc')}
              checked={audience}
              onChange={setAudience}
            />
            <Divider />
            <CategoryRow
              title={t('cookieConsent.cat.marketing.title')}
              description={t('cookieConsent.cat.marketing.desc')}
              checked={marketing}
              onChange={setMarketing}
            />
            <Divider sx={{ mt: 1 }} />
          </Box>
        </Collapse>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1.5,
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            mt: 1,
          }}
        >
          {/* Refus et acceptation présentés avec la même mise en avant visuelle
              (taille, typo, padding) pour respecter l'exigence CNIL de
              « simplicité équivalente ». */}
          <Button
            onClick={rejectAll}
            variant="outlined"
            fullWidth
            sx={{
              borderRadius: '999px',
              px: 4,
              py: 1.25,
              fontWeight: 700,
              fontSize: 14,
              textTransform: 'none',
              borderColor: '#0f172a',
              color: '#0f172a',
              flex: { sm: 1 },
              '&:hover': { borderColor: '#0f172a', backgroundColor: '#f8fafc' },
            }}
          >
            {t('cookieConsent.rejectAll')}
          </Button>
          {showDetails && (
            <Button
              onClick={saveSelection}
              variant="outlined"
              fullWidth
              sx={{
                borderRadius: '999px',
                px: 4,
                py: 1.25,
                fontWeight: 700,
                fontSize: 14,
                textTransform: 'none',
                borderColor: '#0040a1',
                color: '#0040a1',
                flex: { sm: 1 },
                '&:hover': { borderColor: '#003080', backgroundColor: '#e0e7ff' },
              }}
            >
              {t('cookieConsent.saveChoices')}
            </Button>
          )}
          <Button
            onClick={acceptAll}
            variant="contained"
            fullWidth
            sx={{
              borderRadius: '999px',
              px: 4,
              py: 1.25,
              fontWeight: 700,
              fontSize: 14,
              textTransform: 'none',
              backgroundColor: '#0040a1',
              boxShadow: 'none',
              flex: { sm: 1 },
              '&:hover': { backgroundColor: '#003080', boxShadow: '0 4px 12px rgba(0,64,161,0.3)' },
            }}
          >
            {t('cookieConsent.acceptAll')}
          </Button>
        </Box>
      </DialogContent>

      {/* Lien d'accès rapide vers le bouton « Gérer mes cookies » exposé dans
          le footer / les paramètres : voir openCookieConsent(). */}
    </Dialog>
  );
}
