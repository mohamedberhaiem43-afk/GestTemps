import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Button, Chip, CircularProgress, Alert,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, ToggleButton, ToggleButtonGroup, Tooltip,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonIcon from '@mui/icons-material/Person';
import EventIcon from '@mui/icons-material/Event';
import apiInstance from '../../API/apiInstance';
import { useAuth } from '../../helper/AuthProvider';

// Écran de validation des demandes d'heures supplémentaires soumises depuis le mobile.
//
// Les demandes sont stockées dans la table `autoriser` avec un préfixe `[HEURES SUP]`
// dans `conmotif` (cf. abrpoint.mobile/src/screens/AddRequestScreen.tsx) et un état
// `conetat` ajouté par BaseDataSchemaMigrator. Cet écran liste uniquement ces
// demandes — pas les autorisations de sortie classiques qui ont leur propre flux
// (DemandeAutorisationModern.tsx).
//
// Restriction d'accès : admins et managers uniquement. Le filtre se fait côté backend
// (CallerCanApproveAsync) ; on bloque néanmoins l'affichage UI pour éviter qu'un
// employé arrivant ici par URL voie un état "Forbidden" sans contexte.

type OvertimeStatus = 'Pending' | 'Approved' | 'Rejected';

interface OvertimeRequest {
  concod: string;
  soccod: string;
  empcod: string | null;
  emplib: string | null;
  empemail: string | null;
  condat: string | null;       // jour de la demande
  condep: string | null;       // début heure sup
  conret: string | null;       // fin heure sup
  conmotif: string | null;
  conetat: OvertimeStatus;
  contraitepar: string | null;
  contraitedat: string | null;
  concommentaire: string | null;
}

const STATUS_STYLE: Record<OvertimeStatus, { bg: string; text: string; label: string }> = {
  Pending:  { bg: '#fef9c3', text: '#854d0e', label: 'En attente' },
  Approved: { bg: '#dcfce7', text: '#166534', label: 'Validée' },
  Rejected: { bg: '#fee2e2', text: '#991b1b', label: 'Refusée' },
};

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};

const fmtTime = (d: string | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
};

// Calcule la durée totale entre Condep et Conret. Renvoie une chaîne lisible (ex: "2h30")
// ou "—" si l'une des bornes manque. Pour la précision UI ; le backend ne valide pas
// la durée (libre saisie côté employé).
const fmtDuration = (depart: string | null, retour: string | null) => {
  if (!depart || !retour) return '—';
  try {
    const ms = new Date(retour).getTime() - new Date(depart).getTime();
    if (ms <= 0) return '—';
    const totalMin = Math.round(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h${m.toString().padStart(2, '0')}`;
  } catch { return '—'; }
};

// Retire le préfixe `[HEURES SUP]` du motif pour un affichage RH-friendly. On garde
// la partie libre saisie par l'employé (durée ou notes).
const stripMarker = (motif: string | null) => {
  if (!motif) return '';
  return motif.replace(/\[HEURES SUP\]\s*/i, '').trim();
};

export default function HeuresSupValidation() {
  const { soccod, isAdmin, isManager, authReady } = useAuth();
  const canApprove = isAdmin || isManager;

  const [rows, setRows] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OvertimeStatus | 'all'>('Pending');

  // Dialog refus — un commentaire est obligatoire côté backend (motif communiqué à l'employé).
  const [refuseTarget, setRefuseTarget] = useState<OvertimeRequest | null>(null);
  const [refuseComment, setRefuseComment] = useState('');

  // Dialog approbation — commentaire optionnel.
  const [approveTarget, setApproveTarget] = useState<OvertimeRequest | null>(null);
  const [approveComment, setApproveComment] = useState('');

  const [actionBusy, setActionBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const loadRequests = async () => {
    if (!soccod) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (filter !== 'all') params.etat = filter;
      const res = await apiInstance.get(`/Autorisers/heures-sup/${soccod}`, { params });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      const msg = err?.response?.data?.message
        || err?.message
        || 'Impossible de charger les demandes d\'heures supplémentaires.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authReady || !canApprove) return;
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soccod, filter, authReady, canApprove]);

  const handleApproveConfirm = async () => {
    if (!approveTarget) return;
    setActionBusy(true);
    try {
      await apiInstance.post(
        `/Autorisers/heures-sup/${approveTarget.soccod}/${approveTarget.concod}/approve`,
        { commentaire: approveComment || null }
      );
      setToast({ message: 'Demande validée. L\'employé est notifié par email et notification.', severity: 'success' });
      setApproveTarget(null);
      setApproveComment('');
      loadRequests();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Échec de la validation.';
      setToast({ message: msg, severity: 'error' });
    } finally {
      setActionBusy(false);
    }
  };

  const handleRefuseConfirm = async () => {
    if (!refuseTarget) return;
    if (!refuseComment.trim()) {
      setToast({ message: 'Veuillez préciser le motif du refus.', severity: 'error' });
      return;
    }
    setActionBusy(true);
    try {
      await apiInstance.post(
        `/Autorisers/heures-sup/${refuseTarget.soccod}/${refuseTarget.concod}/refuse`,
        { commentaire: refuseComment }
      );
      setToast({ message: 'Demande refusée. L\'employé est notifié par email et notification.', severity: 'success' });
      setRefuseTarget(null);
      setRefuseComment('');
      loadRequests();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Échec du refus.';
      setToast({ message: msg, severity: 'error' });
    } finally {
      setActionBusy(false);
    }
  };

  const counts = useMemo(() => {
    const c = { Pending: 0, Approved: 0, Rejected: 0 };
    for (const r of rows) c[r.conetat] = (c[r.conetat] ?? 0) + 1;
    return c;
  }, [rows]);

  if (!authReady) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress sx={{ color: '#0040a1' }} />
      </Box>
    );
  }

  if (!canApprove) {
    return (
      <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        <Alert severity="warning">
          La validation des heures supplémentaires est réservée aux administrateurs et managers.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1300, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: '12px',
          background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,64,161,0.25)',
        }}>
          <AccessTimeIcon sx={{ color: 'white', fontSize: 24 }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#0d1f3c' }}>
            Validation des heures supplémentaires
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#64748b' }}>
            Validez ou refusez les demandes soumises par les collaborateurs depuis l'application mobile.
          </Typography>
        </Box>
        <Tooltip title="Rafraîchir">
          <IconButton onClick={loadRequests} disabled={loading} sx={{ color: '#64748b' }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Filtres par état */}
      <Box sx={{ mb: 2.5 }}>
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_, v) => v && setFilter(v)}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none', fontSize: 13, fontWeight: 600, px: 2, py: 0.75,
              borderColor: '#e2e8f0', color: '#475569',
              '&.Mui-selected': {
                backgroundColor: '#0040a1', color: 'white',
                '&:hover': { backgroundColor: '#003280' },
              },
            },
          }}
        >
          <ToggleButton value="Pending">
            En attente {counts.Pending > 0 && <Chip label={counts.Pending} size="small" sx={{ ml: 1, height: 18, fontSize: 11 }} />}
          </ToggleButton>
          <ToggleButton value="Approved">Validées</ToggleButton>
          <ToggleButton value="Rejected">Refusées</ToggleButton>
          <ToggleButton value="all">Toutes</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: '#0040a1' }} />
        </Box>
      ) : rows.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', border: '1px dashed #e2e8f0', boxShadow: 'none', background: '#f8fafc' }}>
          <AccessTimeIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
          <Typography sx={{ color: '#64748b', fontWeight: 600 }}>
            {filter === 'Pending' ? 'Aucune demande en attente' : 'Aucune demande à afficher'}
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {rows.map(r => {
            const style = STATUS_STYLE[r.conetat];
            const isPending = r.conetat === 'Pending';
            return (
              <Paper key={`${r.soccod}-${r.concod}`} sx={{
                p: 2.5,
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1.5fr 1fr 1fr 1.2fr auto' },
                gap: 2,
                alignItems: 'center',
              }}>
                {/* Collaborateur */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <PersonIcon sx={{ color: '#0040a1', fontSize: 18 }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0d1f3c' }} noWrap>
                      {r.emplib || r.empcod || '—'}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: '#94a3b8' }} noWrap>
                      #{r.empcod} · {r.concod}
                    </Typography>
                  </Box>
                </Box>

                {/* Date */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#475569' }}>
                    <EventIcon sx={{ fontSize: 14 }} />
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{fmtDate(r.condat)}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 11, color: '#94a3b8', mt: 0.25 }}>
                    {fmtTime(r.condep)} – {fmtTime(r.conret)}
                  </Typography>
                </Box>

                {/* Durée */}
                <Box>
                  <Typography sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Durée
                  </Typography>
                  <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#0d1f3c' }}>
                    {fmtDuration(r.condep, r.conret)}
                  </Typography>
                </Box>

                {/* Motif + état */}
                <Box sx={{ minWidth: 0 }}>
                  <Chip label={style.label} size="small" sx={{
                    backgroundColor: style.bg, color: style.text, fontWeight: 700, fontSize: 11, mb: 0.5,
                  }} />
                  <Typography sx={{ fontSize: 12, color: '#475569' }} noWrap title={stripMarker(r.conmotif)}>
                    {stripMarker(r.conmotif) || '—'}
                  </Typography>
                  {r.concommentaire && (
                    <Typography sx={{ fontSize: 11, color: '#94a3b8', mt: 0.25, fontStyle: 'italic' }} noWrap title={r.concommentaire}>
                      Note : {r.concommentaire}
                    </Typography>
                  )}
                </Box>

                {/* Actions */}
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  {isPending ? (
                    <>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<CloseIcon />}
                        onClick={() => { setRefuseTarget(r); setRefuseComment(''); }}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        Refuser
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<CheckIcon />}
                        onClick={() => { setApproveTarget(r); setApproveComment(''); }}
                        sx={{
                          textTransform: 'none', fontWeight: 700,
                          background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                          '&:hover': { background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)' },
                        }}
                      >
                        Valider
                      </Button>
                    </>
                  ) : (
                    <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>
                      Traitée le {fmtDate(r.contraitedat)}
                    </Typography>
                  )}
                </Box>
              </Paper>
            );
          })}
        </Box>
      )}

      {/* Dialog approbation */}
      <Dialog open={!!approveTarget} onClose={() => !actionBusy && setApproveTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckIcon sx={{ color: '#16a34a' }} />
          Valider la demande d'heures supplémentaires
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, fontSize: 14 }}>
            Vous êtes sur le point de valider la demande de <strong>{approveTarget?.emplib || approveTarget?.empcod}</strong>
            {' '}du {fmtDate(approveTarget?.condat || null)} ({fmtDuration(approveTarget?.condep || null, approveTarget?.conret || null)}).
          </Typography>
          <TextField
            label="Commentaire (optionnel)"
            multiline
            rows={3}
            fullWidth
            value={approveComment}
            onChange={e => setApproveComment(e.target.value)}
            placeholder="Ex: validé avec majoration 25%"
            inputProps={{ maxLength: 500 }}
          />
          <Typography sx={{ mt: 1.5, fontSize: 12, color: '#64748b' }}>
            L'employé sera notifié par email et dans l'application.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setApproveTarget(null)} disabled={actionBusy}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleApproveConfirm}
            disabled={actionBusy}
            startIcon={actionBusy ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <CheckIcon />}
            sx={{
              textTransform: 'none', fontWeight: 700,
              background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
              '&:hover': { background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)' },
            }}
          >
            Confirmer la validation
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog refus */}
      <Dialog open={!!refuseTarget} onClose={() => !actionBusy && setRefuseTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloseIcon sx={{ color: '#dc2626' }} />
          Refuser la demande d'heures supplémentaires
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, fontSize: 14 }}>
            Refus de la demande de <strong>{refuseTarget?.emplib || refuseTarget?.empcod}</strong>
            {' '}du {fmtDate(refuseTarget?.condat || null)} ({fmtDuration(refuseTarget?.condep || null, refuseTarget?.conret || null)}).
          </Typography>
          <TextField
            label="Motif du refus *"
            required
            multiline
            rows={3}
            fullWidth
            value={refuseComment}
            onChange={e => setRefuseComment(e.target.value)}
            placeholder="Ex: charge de travail insuffisante pour justifier l'heure sup."
            inputProps={{ maxLength: 500 }}
            error={!refuseComment.trim()}
            helperText={!refuseComment.trim() ? 'Obligatoire — sera envoyé à l\'employé' : ''}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRefuseTarget(null)} disabled={actionBusy}>Annuler</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRefuseConfirm}
            disabled={actionBusy || !refuseComment.trim()}
            startIcon={actionBusy ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <CloseIcon />}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Confirmer le refus
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
      {toast && (
        <Alert
          severity={toast.severity}
          onClose={() => setToast(null)}
          sx={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            minWidth: 320, zIndex: 1500, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          }}
        >
          {toast.message}
        </Alert>
      )}
    </Box>
  );
}
