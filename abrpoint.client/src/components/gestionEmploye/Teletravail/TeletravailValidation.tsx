import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, TextField,
  CircularProgress, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, Stack, Alert,
  ToggleButton, ToggleButtonGroup, Avatar,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import GavelIcon from '@mui/icons-material/Gavel';
import apiInstance from '../../API/apiInstance';
import { useFeedbackSnackbar } from '../../helper/FeedbackSnackbar';

/**
 * Page « Validation télétravail » — admin / manager.
 * Liste les demandes (filtrables par statut) avec actions Accepter / Refuser.
 * Le refus exige un motif (validation côté backend ; ici on bloque l'envoi
 * tant que le champ est vide pour éviter un aller-retour HTTP inutile).
 */
type Status = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'All';

interface TeletravailDto {
  id: number;
  empcod: string | null;
  employeeName: string | null;
  requestedAt: string;
  startDate: string;
  endDate: string;
  daysCount: number | null;
  reason: string | null;
  status: Exclude<Status, 'All'>;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
}

const STATUS_STYLE: Record<Exclude<Status, 'All'>, { bg: string; color: string; label: string }> = {
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

const initials = (name?: string | null) =>
  (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '?';

export default function TeletravailValidation() {
  const [items, setItems] = useState<TeletravailDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status>('Pending');
  const [decisionTarget, setDecisionTarget] = useState<{ id: number; accept: boolean } | null>(null);
  const feedback = useFeedbackSnackbar();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // L'endpoint `/pending` est optimisé pour le filtre par défaut (gros
      // tenant : évite de remonter 1 an d'archives). Pour les autres filtres
      // on tape l'endpoint général avec ?status=…
      const url = filter === 'Pending'
        ? '/Teletravail/pending'
        : filter === 'All'
          ? '/Teletravail'
          : `/Teletravail?status=${encodeURIComponent(filter)}`;
      const { data } = await apiInstance.get<TeletravailDto[]>(url);
      setItems(data ?? []);
    } catch (err) {
      feedback.showError(err, 'Impossible de charger les demandes.');
    } finally {
      setLoading(false);
    }
    // `feedback` exclu volontairement — cf. note dans DemandeAbsenceModern.tsx
    // (boucle infinie de GET sinon, le hook recrée son objet à chaque render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => { reload(); }, [reload]);

  const pendingCount = useMemo(
    () => items.filter(i => i.status === 'Pending').length,
    [items]
  );

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <GavelIcon sx={{ color: '#0040a1', fontSize: 32 }} />
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a' }}>
              Validation télétravail
            </Typography>
          </Stack>
          <Typography sx={{ color: '#64748b', mt: 0.5 }}>
            Approuvez ou refusez les demandes de télétravail des collaborateurs.
            {filter === 'Pending' && pendingCount > 0 && (
              <span style={{ color: '#854d0e', fontWeight: 700 }}> · {pendingCount} en attente</span>
            )}
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_, v) => v && setFilter(v)}
          size="small"
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600 } }}
        >
          <ToggleButton value="Pending">En attente</ToggleButton>
          <ToggleButton value="Approved">Acceptées</ToggleButton>
          <ToggleButton value="Rejected">Refusées</ToggleButton>
          <ToggleButton value="All">Toutes</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: '16px', border: '1px dashed #cbd5e1', background: '#f8fafc' }}>
          <HomeWorkIcon sx={{ fontSize: 56, color: '#94a3b8', mb: 1 }} />
          <Typography sx={{ color: '#475569', fontWeight: 600 }}>
            {filter === 'Pending' ? 'Aucune demande à traiter.' : 'Aucune demande dans ce statut.'}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {items.map((it) => {
            const style = STATUS_STYLE[it.status];
            return (
              <Paper key={it.id} elevation={0} sx={{ p: 2.5, borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { md: 'center' } }}>
                <Avatar sx={{ bgcolor: '#0040a1', color: '#fff', fontWeight: 700 }}>{initials(it.employeeName)}</Avatar>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>{it.employeeName ?? it.empcod ?? '—'}</Typography>
                    <Chip label={style.label} size="small" sx={{ bgcolor: style.bg, color: style.color, fontWeight: 700 }} />
                    {it.daysCount != null && (
                      <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                        {it.daysCount} jour{it.daysCount > 1 ? 's' : ''}
                      </Typography>
                    )}
                  </Stack>
                  <Typography sx={{ fontSize: 14, color: '#334155' }}>
                    Du <strong>{fmtDate(it.startDate)}</strong> au <strong>{fmtDate(it.endDate)}</strong>
                  </Typography>
                  {it.reason && (
                    <Typography sx={{ fontSize: 13, color: '#64748b', mt: 0.5, fontStyle: 'italic' }}>
                      Motif : « {it.reason} »
                    </Typography>
                  )}
                  {it.decisionComment && it.status !== 'Pending' && (
                    <Typography sx={{ fontSize: 12, color: '#475569', mt: 0.5 }}>
                      Commentaire décideur : {it.decisionComment}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: 11, color: '#94a3b8', mt: 0.5 }}>
                    Soumise le {fmtDate(it.requestedAt)}
                    {it.decidedAt && it.decidedByName && ` · ${it.status === 'Approved' ? 'acceptée' : 'refusée'} le ${fmtDate(it.decidedAt)} par ${it.decidedByName}`}
                  </Typography>
                </Box>
                {it.status === 'Pending' && (
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<CloseIcon />}
                      onClick={() => setDecisionTarget({ id: it.id, accept: false })}
                      sx={{ textTransform: 'none', borderRadius: '10px', fontWeight: 600 }}
                    >
                      Refuser
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<CheckIcon />}
                      onClick={() => setDecisionTarget({ id: it.id, accept: true })}
                      sx={{ textTransform: 'none', borderRadius: '10px', fontWeight: 700 }}
                    >
                      Accepter
                    </Button>
                  </Stack>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}

      <DecisionDialog
        target={decisionTarget}
        onClose={() => setDecisionTarget(null)}
        onDone={() => { setDecisionTarget(null); reload(); }}
      />
      {feedback.element}
    </Box>
  );
}

interface DecisionDialogProps {
  target: { id: number; accept: boolean } | null;
  onClose: () => void;
  onDone: () => void;
}

function DecisionDialog({ target, onClose, onDone }: DecisionDialogProps) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feedback = useFeedbackSnackbar();

  useEffect(() => {
    if (target) { setComment(''); setError(null); }
  }, [target]);

  if (!target) return null;
  const accept = target.accept;

  const handleSubmit = async () => {
    setError(null);
    if (!accept && !comment.trim()) {
      setError('Le motif du refus est obligatoire.');
      return;
    }
    setSubmitting(true);
    try {
      const url = accept ? `/Teletravail/${target.id}/approve` : `/Teletravail/${target.id}/reject`;
      await apiInstance.post(url, { comment: comment.trim() || null });
      feedback.showSuccess(accept ? 'Demande acceptée.' : 'Demande refusée.');
      onDone();
    } catch (err: any) {
      const apiMsg = err?.response?.data?.error;
      setError(apiMsg ?? 'Erreur lors du traitement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!target} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle sx={{ fontWeight: 800, color: accept ? '#166534' : '#991b1b' }}>
        {accept ? 'Accepter la demande de télétravail' : 'Refuser la demande de télétravail'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={accept ? 'Commentaire (facultatif)' : 'Motif du refus *'}
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            fullWidth
            multiline
            rows={3}
            required={!accept}
            helperText={`${comment.length}/500 — ${accept ? 'Visible par le collaborateur.' : 'Obligatoire et visible par le collaborateur.'}`}
            autoFocus
          />
          {error && <Alert severity="error" sx={{ borderRadius: '10px' }}>{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Annuler</Button>
        <Button
          variant="contained"
          color={accept ? 'success' : 'error'}
          onClick={handleSubmit}
          disabled={submitting || (!accept && !comment.trim())}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : (accept ? <CheckIcon /> : <CloseIcon />)}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px' }}
        >
          {submitting ? 'Traitement…' : accept ? 'Confirmer' : 'Refuser'}
        </Button>
        {feedback.element}
      </DialogActions>
    </Dialog>
  );
}
