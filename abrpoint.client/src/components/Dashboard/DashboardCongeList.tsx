import { useState, useMemo } from 'react';
import {
  Box, Typography, Button, CircularProgress, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { useFeedbackSnackbar } from '../helper/FeedbackSnackbar';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import useAcceptDemConge from '../../hooks/congeHooks/useAcceptDemConge';
import useRefuseDemConge from '../../hooks/congeHooks/useRefuseDemConge';
import useGetCongeAbsenceLibs from '../../hooks/absenceHooks/useGetCongeAbsenceLibs';
import { Conge } from '../../models/Conge';
import '../gestionEmploye/gestionConge/DemConge/DemCongeModern.css';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); }
  catch { return '—'; }
};

const getStatus = (c: Conge): 'Accepté' | 'Refusé' | 'En attente' => {
  const n = c.etat?.trim().toLowerCase() ?? '';
  if (n.includes('refus') || c.conrefus === '1') return 'Refusé';
  if (n.includes('accept')) return 'Accepté';
  return 'En attente';
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  default: { bg: 'rgba(0,64,161,0.1)', text: '#0040a1' },
  maladie: { bg: 'rgba(186,26,26,0.12)', text: '#ba1a1a' },
  rtt: { bg: 'rgba(0,81,54,0.12)', text: '#005136' },
};

const getTypeColor = (abscod: string) => {
  const k = abscod?.toLowerCase() ?? '';
  if (k.includes('mal')) return TYPE_COLORS.maladie;
  if (k.includes('rtt')) return TYPE_COLORS.rtt;
  return TYPE_COLORS.default;
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  'Accepté': { bg: '#dcfce7', text: '#166534' },
  'Refusé': { bg: '#fee2e2', text: '#991b1b' },
  'En attente': { bg: '#fef9c3', text: '#854d0e' },
};

interface DashboardCongeListProps {
  data: Conge[];
  isLoading: boolean;
}

export default function DashboardCongeList({ data = [], isLoading }: DashboardCongeListProps) {
  const { mutate: acceptConge, isPending: accepting } = useAcceptDemConge();
  const { mutate: refuseConge, isPending: refusing } = useRefuseDemConge();
  const { data: absenceLibsArr } = useGetCongeAbsenceLibs();
  // Conversion array→dict pour préserver l'usage [abscod] dans le rendu.
  // Le hook renvoie désormais [{abscod, abslib, abscng}] (pour permettre le
  // filtrage RTT côté formulaire de demande). Ici on n'a besoin que du lookup
  // abscod→abslib, donc on reconstruit le dict.
  const absenceLibs = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const a of absenceLibsArr ?? []) {
      if (a?.abscod) out[a.abscod] = a.abslib ?? a.abscod;
    }
    return out;
  }, [absenceLibsArr]);

  const [congeToAccept, setCongeToAccept] = useState<Conge | null>(null);
  const [congeToRefuse, setCongeToRefuse] = useState<Conge | null>(null);
  // Snackbar centralisé (top-center, z-index > sidebar/Dialog) : l'ancien Snackbar ad-hoc
  // s'ancrait en bas-gauche et passait DERRIÈRE la sidebar. Le hook partagé règle ça.
  const { showSuccess, showError, element: snackbarElement } = useFeedbackSnackbar();

  const handleAcceptClick = (conge: Conge) => {
    setCongeToAccept(conge);
  };

  const handleRefuseClick = (conge: Conge) => {
    setCongeToRefuse(conge);
  };

  const confirmAccept = () => {
    if (!congeToAccept) return;
    acceptConge(
      { concod: congeToAccept.concod, empcod: congeToAccept.empcod },
      {
        onSuccess: () => {
          showSuccess(`Demande de ${congeToAccept.emplib || congeToAccept.empcod} acceptée avec succès`);
          setCongeToAccept(null);
        },
        onError: () => {
          showError("Erreur lors de l'acceptation de la demande");
          setCongeToAccept(null);
        },
      }
    );
  };

  const confirmRefuse = () => {
    if (!congeToRefuse) return;
    refuseConge(
      { concod: congeToRefuse.concod, empcod: congeToRefuse.empcod },
      {
        onSuccess: () => {
          showSuccess(`Demande de ${congeToRefuse.emplib || congeToRefuse.empcod} refusée`);
          setCongeToRefuse(null);
        },
        onError: () => {
          showError('Erreur lors du refus de la demande');
          setCongeToRefuse(null);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <CircularProgress size={36} sx={{ color: '#0040a1' }} />
      </Box>
    );
  }

  // Stats
  const pending = data.filter(c => getStatus(c) === 'En attente');
  const accepted = data.filter(c => getStatus(c) === 'Accepté');
  const refused = data.filter(c => getStatus(c) === 'Refusé');

  return (
    <Box sx={{ maxHeight: '70vh', overflow: 'auto' }}>
      {/* Quick stats bar */}
      <Box sx={{
        display: 'flex', gap: 2, px: 3, py: 2,
        background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTimeIcon sx={{ fontSize: 16, color: '#854d0e' }} />
          <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#854d0e' }}>
            {pending.length} En attente
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckIcon sx={{ fontSize: 16, color: '#166534' }} />
          <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>
            {accepted.length} Accepté{accepted.length > 1 ? 's' : ''}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloseIcon sx={{ fontSize: 16, color: '#991b1b' }} />
          <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#991b1b' }}>
            {refused.length} Refusé{refused.length > 1 ? 's' : ''}
          </Typography>
        </Box>
      </Box>

      {/* Table header */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: '2.5fr 1.2fr 1.8fr 1fr 2fr',
        gap: '8px',
        background: '#e6e8ea',
        padding: '14px 24px',
      }}>
        {['Employé', 'Type', 'Période', 'Statut', 'Actions'].map(h => (
          <Typography key={h} sx={{
            fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: '#424654',
          }}>
            {h}
          </Typography>
        ))}
      </Box>

      {/* Rows */}
      {!data.length ? (
        <Box sx={{ textAlign: 'center', py: 6, px: 3 }}>
          <EventAvailableIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1 }} />
          <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>
            Aucune demande de congé enregistrée
          </Typography>
          <Typography sx={{ fontSize: '12px', color: '#94a3b8', mt: 0.5 }}>
            Les nouvelles demandes apparaîtront ici
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {data.map((c) => {
            const status = getStatus(c);
            const statusStyle = STATUS_STYLE[status] || STATUS_STYLE['En attente'];
            const typeColor = getTypeColor(c.abscod);
            const isPending = status === 'En attente';

            return (
              <Box key={c.concod} sx={{
                display: 'grid',
                gridTemplateColumns: '2.5fr 1.2fr 1.8fr 1fr 2fr',
                gap: '8px',
                alignItems: 'center',
                background: '#ffffff',
                padding: '16px 24px',
                borderBottom: '1px solid #f2f4f6',
                transition: 'background 0.15s',
                '&:hover': { background: '#f8fafc' },
                '&:hover .dcm-dash-actions': { opacity: 1 },
              }}>
                {/* Employee */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Avatar sx={{
                    width: 40, height: 40,
                    background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)',
                    fontSize: 15, fontWeight: 700, borderRadius: '10px',
                  }}>
                    {(c.emplib || c.empcod)?.charAt(0)?.toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#191c1e' }}>
                      {c.emplib || c.empcod}
                    </Typography>
                    <Typography sx={{ fontSize: '11px', color: '#737785' }}>
                      #{c.concod} • {c.empcod}
                    </Typography>
                  </Box>
                </Box>

                {/* Type */}
                <Box>
                  <Box sx={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.04em',
                    backgroundColor: typeColor.bg,
                    color: typeColor.text,
                  }}>
                    {absenceLibs?.[c.abscod] || c.abscod || '—'}
                  </Box>
                </Box>

                {/* Period */}
                <Box>
                  <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#191c1e' }}>
                    {fmtDate(c.condep)} — {fmtDate(c.conret)}
                  </Typography>
                  <Typography sx={{ fontSize: '11px', color: '#737785', mt: '2px' }}>
                    {c.connbjour} jour{c.connbjour !== 1 ? 's' : ''} ouvrés
                  </Typography>
                </Box>

                {/* Status */}
                <Box>
                  <Box sx={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: statusStyle.bg,
                    color: statusStyle.text,
                  }}>
                    {status}
                  </Box>
                </Box>

                {/* Actions */}
                <Box className="dcm-dash-actions" sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'opacity 0.15s',
                  opacity: { xs: 1, sm: isPending ? 0.4 : 1 },
                }}>
                  {isPending ? (
                    <>
                      <Button
                        size="small"
                        onClick={() => handleRefuseClick(c)}
                        startIcon={<CloseIcon />}
                        sx={{
                          fontSize: '11px !important',
                          fontWeight: '700 !important',
                          textTransform: 'uppercase !important',
                          letterSpacing: '0.05em !important',
                          borderRadius: '8px !important',
                          padding: '6px 12px !important',
                          color: '#991b1b !important',
                          background: '#fee2e2 !important',
                          '&:hover': { background: '#fecaca !important' },
                        }}
                      >
                        Refuser
                      </Button>
                      <Button
                        size="small"
                        onClick={() => handleAcceptClick(c)}
                        startIcon={<CheckIcon />}
                        sx={{
                          fontSize: '11px !important',
                          fontWeight: '700 !important',
                          textTransform: 'uppercase !important',
                          letterSpacing: '0.05em !important',
                          borderRadius: '8px !important',
                          padding: '6px 12px !important',
                          color: 'white !important',
                          background: '#0040a1 !important',
                          '&:hover': { background: '#003380 !important', transform: 'translateY(-1px)' },
                        }}
                      >
                        Accepter
                      </Button>
                    </>
                  ) : (
                    <Typography sx={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                      Traité
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Accept Confirmation Dialog */}
      <Dialog
        open={!!congeToAccept}
        onClose={() => setCongeToAccept(null)}
        PaperProps={{ sx: { borderRadius: '12px', minWidth: '380px' } }}
      >
        <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', color: '#005136' }}>
          Confirmer l'acceptation
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#475569', fontSize: '14px', mt: 1 }}>
            Êtes-vous sûr de vouloir accepter la demande de congé
            {congeToAccept ? ` de ${congeToAccept.emplib || congeToAccept.empcod}` : ''} ?
          </Typography>
          {congeToAccept && (
            <Box sx={{
              mt: 2, p: 1.5,
              background: '#f0fdf4', borderRadius: '8px',
              border: '1px solid #bbf7d0',
            }}>
              <Typography sx={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>
                Du {fmtDate(congeToAccept.condep)} au {fmtDate(congeToAccept.conret)} — {congeToAccept.connbjour} jour{congeToAccept.connbjour !== 1 ? 's' : ''}
              </Typography>
              <Typography sx={{ fontSize: '11px', color: '#166534', mt: 0.5 }}>
                Type : {absenceLibs?.[congeToAccept.abscod] || congeToAccept.abscod || '—'}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCongeToAccept(null)} sx={{ color: '#64748b', textTransform: 'none' }}>
            Annuler
          </Button>
          <Button
            onClick={confirmAccept}
            variant="contained"
            color="success"
            disabled={accepting}
            startIcon={accepting ? <CircularProgress size={14} color="inherit" /> : <CheckIcon />}
            sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 700 }}
          >
            Oui, Accepter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Refuse Confirmation Dialog */}
      <Dialog
        open={!!congeToRefuse}
        onClose={() => setCongeToRefuse(null)}
        PaperProps={{ sx: { borderRadius: '12px', minWidth: '380px' } }}
      >
        <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', color: '#ba1a1a' }}>
          Confirmer le refus
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#475569', fontSize: '14px', mt: 1 }}>
            Êtes-vous sûr de vouloir refuser la demande de congé
            {congeToRefuse ? ` de ${congeToRefuse.emplib || congeToRefuse.empcod}` : ''} ?
          </Typography>
          {congeToRefuse && (
            <Box sx={{
              mt: 2, p: 1.5,
              background: '#fef2f2', borderRadius: '8px',
              border: '1px solid #fecaca',
            }}>
              <Typography sx={{ fontSize: '12px', color: '#991b1b', fontWeight: 600 }}>
                Du {fmtDate(congeToRefuse.condep)} au {fmtDate(congeToRefuse.conret)} — {congeToRefuse.connbjour} jour{congeToRefuse.connbjour !== 1 ? 's' : ''}
              </Typography>
            </Box>
          )}
          <Typography sx={{ color: '#64748b', fontSize: '12px', mt: 2 }}>
            Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCongeToRefuse(null)} sx={{ color: '#64748b', textTransform: 'none' }}>
            Annuler
          </Button>
          <Button
            onClick={confirmRefuse}
            variant="contained"
            color="error"
            disabled={refusing}
            startIcon={refusing ? <CircularProgress size={14} color="inherit" /> : <CloseIcon />}
            sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 700 }}
          >
            Oui, Refuser
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar centralisé (haut-centre, au-dessus de la sidebar et des Dialog) */}
      {snackbarElement}
    </Box>
  );
}