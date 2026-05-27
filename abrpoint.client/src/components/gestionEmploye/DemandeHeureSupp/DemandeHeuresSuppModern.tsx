import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Button, TextField, MenuItem,
  CircularProgress, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Stack, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import apiInstance from '../../API/apiInstance';
import { useFeedbackSnackbar } from '../../helper/FeedbackSnackbar';
import { useAuth } from '../../helper/AuthProvider';

/**
 * Page « Mes demandes d'heures supplémentaires » côté collaborateur (web).
 *
 * Équivalent web de abrpoint.mobile/src/screens/AddRequestScreen.tsx (option
 * "heuressup"). Sans cette page, les salariés connectés uniquement sur le web
 * ne pouvaient pas soumettre de demande d'h.supp — leurs heures restaient
 * détectées dans l'État Périodique mais marquées « non validé » faute de
 * canal de soumission.
 *
 * Workflow :
 *   1. Le salarié saisit date + heure début + durée (30min → 5h) + notes.
 *   2. POST /api/Autorisers/my-auth avec Conmotif = `[HEURES SUP] {notes}`.
 *      Le marker [HEURES SUP] route la demande vers la file de validation
 *      dédiée (gestionEmploye/HeuresSupValidation/HeuresSupValidation.tsx).
 *   3. Le backend auto-génère le Concod si absent (cf.
 *      AutorisersController.PostMyAuthorization).
 *   4. Le manager approuve/refuse → l'état est répercuté ici via Conetat.
 *   5. Une fois Approved, les heures comptent dans le total payable
 *      (cf. HeuresSupplementaireHebdomadaireService.ApplyApprovalFilterAsync).
 */

const MARKER = '[HEURES SUP]';

// Durées proposées (en minutes) — mirroir des choix mobile pour cohérence
// produit. 30min → 5h couvre l'essentiel des cas réels ; au-delà, c'est
// probablement une demande forfaitaire à traiter via Sanctions.
const DURATION_OPTIONS = [
  { value: 30,  label: '30 min' },
  { value: 60,  label: '1 h' },
  { value: 90,  label: '1 h 30' },
  { value: 120, label: '2 h' },
  { value: 180, label: '3 h' },
  { value: 240, label: '4 h' },
  { value: 300, label: '5 h' },
];

type Status = 'Pending' | 'Approved' | 'Rejected';

interface AutoriserDto {
  concod: string;
  empcod: string;
  emplib?: string | null;
  condat: string;
  condep: string;
  conret: string;
  conmotif: string | null;
  conetat: string | null;
  contraitepar?: string | null;
  contraitedat?: string | null;
  concommentaire?: string | null;
}

const STATUS_STYLE: Record<Status, { bg: string; color: string; label: string }> = {
  Pending:  { bg: '#fef9c3', color: '#854d0e', label: 'En attente' },
  Approved: { bg: '#dcfce7', color: '#166534', label: 'Validée' },
  Rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Refusée' },
};

const normalizeStatus = (s: string | null): Status => {
  const v = (s ?? '').trim().toLowerCase();
  if (v === 'approved' || v.includes('valid') || v.includes('approuv')) return 'Approved';
  if (v === 'rejected' || v.includes('refus')) return 'Rejected';
  return 'Pending';
};

const stripMarker = (motif: string | null) =>
  (motif ?? '').replace(/\[HEURES\s*SUP\]\s*/i, '').trim();

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const fmtDateTime = (d?: string | null) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return d; }
};

const fmtDuration = (startIso: string, endIso: string) => {
  try {
    const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
    if (!isFinite(ms) || ms <= 0) return '—';
    const minutes = Math.round(ms / 60_000);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? (m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`) : `${m} min`;
  } catch { return '—'; }
};

export default function DemandeHeuresSuppModern() {
  const { soccod, uticod } = useAuth();
  const [items, setItems] = useState<AutoriserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const feedback = useFeedbackSnackbar();

  const reload = useCallback(async () => {
    if (!soccod || !uticod) return;
    setLoading(true);
    try {
      const { data } = await apiInstance.get<AutoriserDto[]>(
        `/Autorisers/my-auths/${soccod}/${uticod}`,
      );
      // Filtre côté client sur le marker [HEURES SUP] : la table autoriser
      // héberge aussi les autorisations de sortie classiques. Sans ce filtre,
      // l'employé verrait ses sorties mélangées avec ses heures sup.
      const filtered = (data ?? []).filter(
        a => (a.conmotif ?? '').toLowerCase().includes('heures sup'),
      );
      setItems(filtered);
    } catch (err) {
      feedback.showError(err, 'Impossible de charger vos demandes d\'heures supplémentaires.');
    } finally {
      setLoading(false);
    }
    // ⚠ feedback exclu volontairement — useFeedbackSnackbar() retourne un objet
    // neuf à chaque render. L'inclure boucle useEffect. Cf. note identique
    // dans DemandeAbsenceModern.tsx / DemandeAbsenceValidation.tsx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soccod, uticod]);

  useEffect(() => { reload(); }, [reload]);

  const pendingCount = useMemo(
    () => items.filter(i => normalizeStatus(i.conetat) === 'Pending').length,
    [items],
  );

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <AccessTimeIcon sx={{ color: '#0040a1', fontSize: 32 }} />
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a' }}>
              Mes demandes d'heures supp.
            </Typography>
          </Stack>
          <Typography sx={{ color: '#64748b', mt: 0.5 }}>
            Soumettez vos heures supplémentaires pour validation par votre manager. Seules les heures approuvées sont comptées dans la paie.
            {pendingCount > 0 && (
              <span style={{ color: '#854d0e', fontWeight: 700 }}>{` · ${pendingCount} en attente`}</span>
            )}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenCreate(true)}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3, py: 1.2, background: 'linear-gradient(135deg, #0040a1, #0056d2)' }}
        >
          Nouvelle demande
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: '16px', border: '1px dashed #cbd5e1', background: '#f8fafc' }}>
          <AccessTimeIcon sx={{ fontSize: 56, color: '#94a3b8', mb: 1 }} />
          <Typography sx={{ color: '#475569', fontWeight: 600 }}>Aucune demande d'heures supplémentaires.</Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: 14, mt: 0.5 }}>Cliquez sur « Nouvelle demande » pour en créer une.</Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {items.map((it) => {
            const status = normalizeStatus(it.conetat);
            const style = STATUS_STYLE[status];
            const note = stripMarker(it.conmotif);
            return (
              <Paper key={it.concod} elevation={0} sx={{ p: 2.5, borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                      <Chip label={style.label} size="small" sx={{ bgcolor: style.bg, color: style.color, fontWeight: 700 }} />
                      <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                        Durée : {fmtDuration(it.condep, it.conret)}
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>
                      {fmtDateTime(it.condep)} → {fmtDateTime(it.conret)}
                    </Typography>
                    {note && (
                      <Typography sx={{ fontSize: 13, color: '#475569', mt: 0.5, fontStyle: 'italic' }}>
                        « {note} »
                      </Typography>
                    )}
                    {status === 'Rejected' && it.concommentaire && (
                      <Alert severity="error" sx={{ mt: 1, py: 0.5, borderRadius: '8px' }}>
                        Motif du refus : {it.concommentaire}
                      </Alert>
                    )}
                    {status === 'Approved' && it.concommentaire && (
                      <Alert severity="success" sx={{ mt: 1, py: 0.5, borderRadius: '8px' }}>
                        {it.concommentaire}
                      </Alert>
                    )}
                    <Typography sx={{ fontSize: 11, color: '#94a3b8', mt: 1 }}>
                      Soumise le {fmtDate(it.condat)}
                      {it.contraitedat && ` · décidée le ${fmtDate(it.contraitedat)}`}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      <CreateDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={() => { setOpenCreate(false); reload(); }}
        soccod={soccod}
        uticod={uticod}
      />
      {feedback.element}
    </Box>
  );
}

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  soccod: string | null;
  uticod: string | null;
}

function CreateDialog({ open, onClose, onCreated, soccod, uticod }: CreateDialogProps) {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('17:00');
  const [durationMin, setDurationMin] = useState<number>(60);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feedback = useFeedbackSnackbar();

  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
      setStartTime('17:00');
      setDurationMin(60);
      setNotes('');
      setError(null);
    }
  }, [open]);

  // Calcul d'aperçu de l'heure de fin — utile pour que l'employé voie « si je
  // commence à 17:00 pour 2h, je termine à 19:00 » avant de soumettre.
  const endTimePreview = useMemo(() => {
    if (!date || !startTime) return '—';
    try {
      const [h, m] = startTime.split(':').map(Number);
      const start = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
      const end = new Date(start.getTime() + durationMin * 60_000);
      return end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
  }, [date, startTime, durationMin]);

  const handleSubmit = async () => {
    setError(null);
    if (!soccod || !uticod) { setError('Session invalide — reconnectez-vous.'); return; }
    if (!date || !startTime) { setError('Date et heure de début obligatoires.'); return; }

    const [h, m] = startTime.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) { setError('Heure de début invalide.'); return; }
    const condep = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
    if (isNaN(condep.getTime())) { setError('Date / heure invalide.'); return; }
    const conret = new Date(condep.getTime() + durationMin * 60_000);

    setSubmitting(true);
    try {
      // Le backend auto-génère le Concod si on ne le fournit pas (cf.
      // AutorisersController.PostMyAuthorization 2026-05).
      await apiInstance.post('/Autorisers/my-auth', {
        soccod,
        empcod: uticod,
        condat: new Date().toISOString(),
        condep: condep.toISOString(),
        conret: conret.toISOString(),
        conjour: '1',
        conmotif: `${MARKER} ${notes.trim() || `${durationMin / 60}h`}`.slice(0, 200),
      });
      feedback.showSuccess('Demande envoyée — votre manager sera notifié.');
      onCreated();
    } catch (err: any) {
      const apiMsg = err?.response?.data?.error
        ?? err?.response?.data?.message
        ?? err?.message;
      setError(apiMsg ?? 'Impossible d\'envoyer la demande.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Nouvelle demande d'heures supp.
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Alert severity="info" sx={{ borderRadius: '10px', fontSize: 13 }}>
            Vos heures supplémentaires ne sont comptées dans la paie qu'après validation
            de votre manager. Soumettez votre demande dès que possible — idéalement le
            jour même.
          </Alert>

          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            // Empêche les dates futures trop lointaines : on autorise jusqu'à demain
            // (cas du salarié qui anticipe une h.supp programmée).
            inputProps={{ max: new Date(Date.now() + 86_400_000).toISOString().split('T')[0] }}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Heure de début"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              select
              label="Durée"
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              fullWidth
            >
              {DURATION_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </TextField>
          </Stack>

          <Box sx={{ p: 1.5, bgcolor: '#f1f5f9', borderRadius: '8px', textAlign: 'center' }}>
            <Typography sx={{ fontSize: 12, color: '#64748b' }}>Heure de fin estimée</Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#0040a1' }}>{endTimePreview}</Typography>
          </Box>

          <TextField
            label="Notes (motif, contexte)"
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 200))}
            fullWidth
            multiline
            rows={3}
            placeholder="Ex : finalisation du dossier client X, à la demande de mon responsable."
            helperText={`${notes.length}/200`}
          />

          {error && <Alert severity="error" sx={{ borderRadius: '10px' }}>{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Annuler</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', background: 'linear-gradient(135deg, #0040a1, #0056d2)' }}
        >
          {submitting ? 'Envoi…' : 'Soumettre'}
        </Button>
        {feedback.element}
      </DialogActions>
    </Dialog>
  );
}
