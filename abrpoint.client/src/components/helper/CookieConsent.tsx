import { useEffect, useState } from 'react';
import { Box, Typography, Button, Dialog, DialogContent } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useTranslation } from 'react-i18next';

const CONSENT_KEY = 'abrpoint.cookie-consent';
const CONSENT_DATE_KEY = 'abrpoint.cookie-consent-date';

type ConsentValue = 'accepted' | 'rejected';

export function getCookieConsent(): ConsentValue | null {
  const v = localStorage.getItem(CONSENT_KEY);
  return v === 'accepted' || v === 'rejected' ? v : null;
}

export function clearCookieConsent() {
  localStorage.removeItem(CONSENT_KEY);
  localStorage.removeItem(CONSENT_DATE_KEY);
}

export default function CookieConsent() {
  const { t } = useTranslation();
  // On lit la valeur de manière synchrone au montage pour ne pas afficher la
  // bannière à un utilisateur qui a déjà choisi (évite un flash visuel).
  const [open, setOpen] = useState(() => getCookieConsent() === null);

  useEffect(() => {
    // Permet aux composants externes (ex. lien « Gérer mes cookies » dans le
    // footer) de redéclencher la bannière en émettant cet événement.
    const handler = () => setOpen(true);
    window.addEventListener('cookie-consent:open', handler);
    return () => window.removeEventListener('cookie-consent:open', handler);
  }, []);

  const persist = (value: ConsentValue) => {
    try {
      localStorage.setItem(CONSENT_KEY, value);
      localStorage.setItem(CONSENT_DATE_KEY, new Date().toISOString());
    } catch { /* storage indisponible : on laisse passer plutôt que crasher */ }
    window.dispatchEvent(new CustomEvent('cookie-consent:changed', { detail: value }));
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      // Pas de fermeture au clic backdrop / Escape : RGPD demande un choix actif.
      disableEscapeKeyDown
      onClose={(_, reason) => {
        if (reason === 'backdropClick') return;
        setOpen(false);
      }}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          padding: 0,
          maxWidth: 560,
        },
      }}
      sx={{
        '& .MuiDialog-paper': { m: 2 },
      }}
    >
      <DialogContent sx={{ p: { xs: 3, sm: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 18, sm: 20 }, color: '#0f172a' }}>
            {t('cookieConsent.title')}
          </Typography>
          <LockOutlinedIcon sx={{ color: '#10b981', fontSize: 22 }} />
        </Box>

        <Typography sx={{ fontSize: 14, color: '#475569', lineHeight: 1.6, mb: 1.5 }}>
          {t('cookieConsent.body1')}
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#475569', lineHeight: 1.6, mb: 1.5 }}>
          {t('cookieConsent.body2')}
        </Typography>
        <Typography sx={{ fontSize: 13, color: '#475569', lineHeight: 1.6, mb: 1.5, fontStyle: 'italic' }}>
          {t('cookieConsent.aiProcessor')}
        </Typography>
        <Typography sx={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, mb: 3 }}>
          {t('cookieConsent.changeLater')}
        </Typography>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            gap: 1.5,
            justifyContent: 'flex-end',
          }}
        >
          <Button
            onClick={() => persist('rejected')}
            variant="outlined"
            sx={{
              borderRadius: '999px',
              px: 4,
              py: 1.25,
              fontWeight: 700,
              fontSize: 14,
              textTransform: 'none',
              borderColor: '#0f172a',
              color: '#0f172a',
              '&:hover': { borderColor: '#0f172a', backgroundColor: '#f8fafc' },
            }}
          >
            {t('cookieConsent.reject')}
          </Button>
          <Button
            onClick={() => persist('accepted')}
            variant="contained"
            sx={{
              borderRadius: '999px',
              px: 4,
              py: 1.25,
              fontWeight: 700,
              fontSize: 14,
              textTransform: 'none',
              backgroundColor: '#0040a1',
              boxShadow: 'none',
              '&:hover': { backgroundColor: '#003080', boxShadow: '0 4px 12px rgba(0,64,161,0.3)' },
            }}
          >
            {t('cookieConsent.accept')}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
