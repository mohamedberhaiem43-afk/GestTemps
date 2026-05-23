import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, TextField,
  CircularProgress, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Stack, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import CancelIcon from '@mui/icons-material/Cancel';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import apiInstance from '../../API/apiInstance';
import { useFeedbackSnackbar } from '../../helper/FeedbackSnackbar';

/**
 * Page « Mes demandes de télétravail » (côté collaborateur).
 * Liste les demandes du caller (GET /api/Teletravail/me), permet d'en créer
 * (POST /api/Teletravail) ou d'annuler tant qu'elles sont en attente
 * (POST /api/Teletravail/{id}/cancel).
 *
 * On consomme directement apiInstance (pas de hook React Query dédié) :
 * la surface API est petite (4 routes), un hook ajouterait plus de
 * boilerplate que de valeur — le pattern reste cohérent avec les pages
 * minimalistes comme `ConsentBanner` ou `OnboardingNextStepHint`.
 */
type Status = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

interface TeletravailDto {
  id: number;
  empcod: string | null;
  employeeName: string | null;
  requestedAt: string;
  startDate: string;
  endDate: string;
  daysCount: number | null;
  reason: string | null;
  status: Status;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
}

const STATUS_STYLE: Record<Status, { bg: string; color: string; label: string }> = {
  Pending:   { bg: '#fef9c3', color: '#854d0e', label: 'En attente' },
  Approved:  { bg: '#dcfce7', color: '#166534', label: 'Acceptée' },
  Rejected:  { bg: '#fee2e2', color: '#991b1b', label: 'Refusée' },
  Cancelled: { bg: '#e2e8f0', color: '#475569', label: 'Annulée' },
};

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

export default function TeletravailModern() {
  const [items, setItems] = useState<TeletravailDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const feedback = useFeedbackSnackbar();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiInstance.get<TeletravailDto[]>('/Teletravail/me');
      setItems(data ?? []);
    } catch (err) {
      feedback.showError(err, 'Impossible de charger vos demandes de télétravail.');
    } finally {
      setLoading(false);
    }
    // `feedback` exclu volontairement — cf. note dans DemandeAbsenceModern.tsx
    // (boucle infinie de GET sinon, le hook recrée son objet à chaque render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleCancel = async (id: number) => {
    if (!window.confirm('Annuler cette demande de télétravail ?')) return;
    try {
      await apiInstance.post(`/Teletravail/${id}/cancel`);
      feedback.showSuccess('Demande annulée.');
      await reload();
    } catch (err) {
      feedback.showError(err, "Impossible d'annuler la demande.");
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <HomeWorkIcon sx={{ color: '#0040a1', fontSize: 32 }} />
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a' }}>
              Mes demandes de télétravail
            </Typography>
          </Stack>
          <Typography sx={{ color: '#64748b', mt: 0.5 }}>
            Soumettez une demande, suivez son statut et annulez tant qu'elle n'est pas traitée.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenCreate(true)}
          sx={{
            textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3, py: 1.2,
            background: 'linear-gradient(135deg, #0040a1, #0056d2)',
          }}
        >
          Nouvelle demande
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: '16px', border: '1px dashed #cbd5e1', background: '#f8fafc' }}>
          <HomeWorkIcon sx={{ fontSize: 56, color: '#94a3b8', mb: 1 }} />
          <Typography sx={{ color: '#475569', fontWeight: 600 }}>Aucune demande de télétravail pour le moment.</Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: 14, mt: 0.5 }}>Cliquez sur « Nouvelle demande » pour en créer une.</Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {items.map((it) => {
            const style = STATUS_STYLE[it.status];
            return (
              <Paper key={it.id} elevation={0} sx={{ p: 2.5, borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { sm: 'center' } }}>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                    <Chip label={style.label} size="small" sx={{ bgcolor: style.bg, color: style.color, fontWeight: 700 }} />
                    {it.daysCount != null && (
                      <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                        {it.daysCount} jour{it.daysCount > 1 ? 's' : ''} ouvré{it.daysCount > 1 ? 's' : ''}
                      </Typography>
                    )}
                  </Stack>
                  <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>
                    Du {fmtDate(it.startDate)} au {fmtDate(it.endDate)}
                  </Typography>
                  {it.reason && (
                    <Typography sx={{ fontSize: 13, color: '#475569', mt: 0.5, fontStyle: 'italic' }}>
                      « {it.reason} »
                    </Typography>
                  )}
                  {it.status === 'Rejected' && it.decisionComment && (
                    <Alert severity="error" sx={{ mt: 1, py: 0.5, borderRadius: '8px' }}>
                      Motif du refus : {it.decisionComment}
                    </Alert>
                  )}
                  {it.status === 'Approved' && it.decisionComment && (
                    <Alert severity="success" sx={{ mt: 1, py: 0.5, borderRadius: '8px' }}>
                      {it.decisionComment}
                    </Alert>
                  )}
                  <Typography sx={{ fontSize: 11, color: '#94a3b8', mt: 1 }}>
                    Soumise le {fmtDate(it.requestedAt)}
                    {it.decidedAt && it.decidedByName && ` · décidée le ${fmtDate(it.decidedAt)} par ${it.decidedByName}`}
                  </Typography>
                </Box>
                {it.status === 'Pending' && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<CancelIcon />}
                    onClick={() => handleCancel(it.id)}
                    sx={{ textTransform: 'none', borderRadius: '10px', fontWeight: 600 }}
                  >
                    Annuler
                  </Button>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}

      <CreateDialog open={openCreate} onClose={() => setOpenCreate(false)} onCreated={() => { setOpenCreate(false); reload(); }} />
      {feedback.element}
    </Box>
  );
}

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function CreateDialog({ open, onClose, onCreated }: CreateDialogProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feedback = useFeedbackSnackbar();

  useEffect(() => {
    // Reset à chaque ouverture pour éviter de pré-remplir avec la précédente demande.
    if (open) {
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      setEndDate(today);
      setReason('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    setError(null);
    if (!startDate || !endDate) { setError('Sélectionnez les dates de début et fin.'); return; }
    if (endDate < startDate) { setError('La date de fin doit être ≥ à la date de début.'); return; }
    setSubmitting(true);
    try {
      await apiInstance.post('/Teletravail', {
        startDate, endDate,
        reason: reason.trim() || null,
      });
      feedback.showSuccess('Demande envoyée — votre manager sera notifié.');
      onCreated();
    } catch (err: any) {
      const apiMsg = err?.response?.data?.error;
      setError(apiMsg ?? "Impossible d'envoyer la demande.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Nouvelle demande de télétravail
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Date de début"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: new Date().toISOString().split('T')[0] }}
            />
            <TextField
              label="Date de fin"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: startDate || new Date().toISOString().split('T')[0] }}
            />
          </Stack>
          <TextField
            label="Motif (facultatif)"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            fullWidth
            multiline
            rows={3}
            placeholder="Ex : journée de focus, garde d'enfant, contrainte logistique…"
            helperText={`${reason.length}/500`}
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
