import { useEffect, useState } from 'react';
import {
  Box, Button, IconButton, Snackbar, Stack, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GavelIcon from '@mui/icons-material/Gavel';
import { useAuth } from '../AuthProvider';
import { ProcessingNoticeApi, CurrentNoticeResponse } from '../../Admin/ProcessingNotice/processingNoticeApi';

/**
 * Bannière non-bloquante d'information RGPD (Art. 13). S'affiche en bas de l'écran
 * dès qu'un utilisateur authentifié n'a pas encore acquitté la version courante de
 * la notice. Le clic « J'ai compris » enregistre un UserConsent côté serveur (preuve
 * horodatée + IP) puis fait disparaître la bannière. Le bouton « Lire la notice »
 * ouvre une modal en lecture seule.
 *
 * Décision produit 2026-05 : non bloquant — l'utilisateur peut continuer à pointer
 * même sans avoir cliqué. La bannière revient à chaque session tant qu'il n'a pas
 * acquitté. Conforme RGPD art. 13 (obligation d'information PROACTIVE) sans
 * dénaturer la base légale (intérêt légitime/obligation légale, pas consentement).
 */
export default function ConsentBanner() {
  const { authReady, uticod, isAdmin, isManager } = useAuth();
  const [data, setData] = useState<CurrentNoticeResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [readOpen, setReadOpen] = useState(false);

  // RGPD art. 13 : la notice s'adresse aux salariés concernés par le traitement
  // (« Votre employeur a actualisé… »). On la masque pour les admins et managers,
  // qui sont du côté Responsable de traitement et qui ÉDITENT la notice depuis
  // la page admin — leur afficher la bannière n'a pas de sens et est confus.
  const isStaffSide = isAdmin || isManager;

  useEffect(() => {
    if (!authReady || !uticod || isStaffSide) { setData(null); return; }
    let alive = true;
    ProcessingNoticeApi.getCurrent()
      .then((res) => { if (alive) setData(res); })
      .catch(() => { /* silencieux : un tenant sans notice ne doit pas pollir l'UI */ });
    return () => { alive = false; };
  }, [authReady, uticod, isStaffSide]);

  // Reset le "dismissed" local à chaque ouverture de session.
  useEffect(() => { setDismissed(false); }, [uticod]);

  const visible = !isStaffSide && !!data?.requiresAcknowledgment && !dismissed;

  const handleAcknowledge = async () => {
    setBusy(true);
    try {
      await ProcessingNoticeApi.acknowledge();
      setData((prev) => prev ? { ...prev, requiresAcknowledgment: false } : prev);
    } catch {
      // En cas d'erreur réseau, on laisse la bannière visible — l'utilisateur
      // retentera à la prochaine session.
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Snackbar
        open={visible}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ maxWidth: 720, '& .MuiSnackbarContent-root': { p: 0, bgcolor: 'transparent', boxShadow: 'none' } }}
      >
        <Box
          sx={{
            bgcolor: '#0f172a', color: '#fff', borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 12px 36px rgba(15,23,42,0.42)',
            p: 2.5, display: 'flex', alignItems: 'flex-start', gap: 2,
            minWidth: { xs: '92vw', sm: 520 },
          }}
        >
          <Box sx={{
            width: 36, height: 36, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <GavelIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 0.5 }}>
              {data?.notice.title ?? 'Information sur le traitement de vos données'}
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 }}>
              Votre employeur a actualisé la notice d'information RGPD relative au
              pointage et à la géolocalisation. Merci de la lire et d'en accuser
              réception.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
              <Button
                size="small"
                variant="contained"
                onClick={handleAcknowledge}
                disabled={busy}
                sx={{ bgcolor: '#0040a1', '&:hover': { bgcolor: '#003080' } }}
              >
                J'ai compris
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={() => setReadOpen(true)}
                sx={{ color: '#93c5fd' }}
              >
                Lire la notice
              </Button>
            </Stack>
          </Box>
          <IconButton
            size="small"
            onClick={() => setDismissed(true)}
            aria-label="Masquer pour cette session"
            sx={{ color: 'rgba(255,255,255,0.6)' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Snackbar>

      <Dialog open={readOpen} onClose={() => setReadOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {data?.notice.title}
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
            Version {data?.notice.version} — mise à jour le {data?.notice.updatedAt ? new Date(data.notice.updatedAt).toLocaleDateString('fr-FR') : '—'}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Typography
            component="pre"
            sx={{
              fontFamily: 'inherit', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontSize: 14, lineHeight: 1.6, color: 'text.primary', m: 0,
            }}
          >
            {data?.notice.body}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReadOpen(false)}>Fermer</Button>
          <Button
            variant="contained"
            onClick={async () => { await handleAcknowledge(); setReadOpen(false); }}
            disabled={busy || !data?.requiresAcknowledgment}
          >
            {data?.requiresAcknowledgment ? "J'ai compris" : 'Déjà acquittée'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
