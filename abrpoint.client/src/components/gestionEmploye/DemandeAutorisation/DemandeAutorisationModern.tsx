import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Button, TextField,
  Snackbar, Alert, CircularProgress, Avatar,
  IconButton, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { useTranslation, Trans } from 'react-i18next';
import useGetDemandeAutorisations from '../../../hooks/demandeAutorisationHooks/useGetDemandeAutorisations';
import useGetAutorisationLibs from '../../../hooks/absenceHooks/useGetAutorisationLibs';
import { useAuth } from '../../helper/AuthProvider';
import { DemandeAutorisation } from '../../../models/DemandeAutorisation';
import apiInstance from '../../API/apiInstance';
import generateNumeroOrdre from '../../helper/GenerateNumOrdre';
import { ListSkeleton } from '../../helper/animations/Skeletons';
import { staggerSx } from '../../helper/animations/Stagger';
import { ActionButton } from '../../helper/animations/ActionButton';
import './DemandeAutorisationModern.css';

// ── Absence type ──
type AbsenceOption = {
  abscod: string;
  soccod: string;
  abslib: string;
  abscng: string;
};

// ── helpers ──
const today = () => new Date().toISOString().split('T')[0];
const now = () => new Date().toISOString().slice(0, 16);

const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};

const fmtTime = (d: Date | string | null | undefined) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
};

const fmtDuration = (hours: number | null | undefined) => {
  if (!hours) return '0h00';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h${m.toString().padStart(2, '0')}`;
};

type DemandeStatusKey = 'approved' | 'refused' | 'pending';

const getStatus = (d: DemandeAutorisation): DemandeStatusKey => {
  const s = d.statut?.trim() ?? '';
  if (s.includes('Approuv') || s.includes('Accept')) return 'approved';
  if (s.includes('Refus')) return 'refused';
  return 'pending';
};

const STATUS_STYLE: Record<DemandeStatusKey, { bg: string; text: string }> = {
  approved: { bg: '#dcfce7', text: '#166534' },
  refused: { bg: '#fee2e2', text: '#991b1b' },
  pending: { bg: '#fef9c3', text: '#854d0e' },
};

// ── Form Dialog ──
function DemandeFormDialog({ open, onClose, editDemande, onSuccess }: { open: boolean; onClose: () => void; editDemande: DemandeAutorisation | null; onSuccess?: () => void }) {
  const { t } = useTranslation();
  const { soccod, isEmp, uticod } = useAuth();
  const { refetch } = useGetDemandeAutorisations();

  const [concod, setConcod] = useState(generateNumeroOrdre());
  const [condat, setCondat] = useState(today());
  const [condep, setCondep] = useState(now());
  const [conret, setConret] = useState(now());
  const [conmotif, setConmotif] = useState('');
  const [abscod, setAbscod] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: absencesData = [], isLoading: loadingAbsences } = useGetAutorisationLibs();
  // Filtre défensif : on ne garde que les entrées correctement formées. Une
  // ligne sans abscod / abslib provoquerait un menu transparent et bloqué
  // (clé React invalide + .toLowerCase() sur undefined dans le useEffect).
  const absences: AbsenceOption[] = Array.isArray(absencesData)
    ? (absencesData as AbsenceOption[]).filter((a) => a && typeof a.abscod === 'string' && a.abscod && typeof a.abslib === 'string')
    : [];

  useEffect(() => {
    if (open && !editDemande && absences.length > 0 && !abscod) {
      const defaultAbs = absences.find((a) => (a.abslib ?? '').toLowerCase().includes('autorisation') || a.abscng === 'B');
      if (defaultAbs) {
        setAbscod(defaultAbs.abscod);
      } else {
        setAbscod(absences[0].abscod);
      }
    }
  }, [open, editDemande, absences, abscod]);

  useEffect(() => {
    if (editDemande) {
      setConcod(editDemande.concod || '');
      setCondat(editDemande.condat ? new Date(editDemande.condat).toISOString().split('T')[0] : today());
      setCondep(editDemande.condep ? new Date(editDemande.condep).toISOString().slice(0, 16) : now());
      setConret(editDemande.conret ? new Date(editDemande.conret).toISOString().slice(0, 16) : now());
      setConmotif(editDemande.conmotif || '');
      setAbscod(editDemande.abscod || '');
    } else {
      setConcod(generateNumeroOrdre());
      setCondat(today());
      setCondep(now());
      setConret(now());
      setConmotif('');
      // Reset abscod to default (abscng='B') - will be set by fetchAbsences
    }
  }, [editDemande, open]);

  const calcDuration = () => {
    if (!condep || !conret) return 0;
    const diff = (new Date(conret).getTime() - new Date(condep).getTime()) / 3600000;
    return Math.max(0, Math.round(diff * 100) / 100);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        soccod,
        empcod: isEmp && uticod ? uticod : '',
        concod,
        condat: condat ? new Date(condat) : null,
        condep: condep ? new Date(condep) : null,
        conret: conret ? new Date(conret) : null,
        conmotif,
        abscod: abscod || null,
      };

      if (editDemande) {
        await apiInstance.put('/DemandeAutorisations', { ...payload, id: editDemande.id });
      } else {
        await apiInstance.post('/DemandeAutorisations', payload);
      }
      refetch();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving demande:', err);
    } finally {
      setLoading(false);
    }
  };

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      backgroundColor: '#f8fafc',
      '& fieldset': { borderColor: '#e2e8f0' },
    },
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: '16px' } }}
      sx={{
        '& .MuiDialog-paper': {
          margin: { xs: 0, sm: '32px' },
          width: { xs: '90%', sm: 'auto' },
          maxWidth: { xs: '95%', sm: '600px' },
        },
      }}>
      <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', pb: 1 }}>
        {editDemande ? t('demAutorisation.form.titleEdit') : t('demAutorisation.form.titleNew')}
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('demAutorisation.form.requestNo')}</Typography>
            <TextField size="small" fullWidth value={concod} onChange={(e) => setConcod(e.target.value)} InputProps={{ readOnly: true }} sx={fieldSx} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('demAutorisation.form.requestDate')}</Typography>
            <TextField size="small" fullWidth type="date" value={condat} InputProps={{ readOnly: true }} sx={fieldSx} />
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('demAutorisation.form.startTime')}</Typography>
            <TextField size="small" fullWidth type="datetime-local" value={condep} onChange={(e) => setCondep(e.target.value)} sx={fieldSx} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('demAutorisation.form.endTime')}</Typography>
            <TextField size="small" fullWidth type="datetime-local" value={conret} onChange={(e) => setConret(e.target.value)} sx={fieldSx} />
          </Box>
        </Box>

        {/* Duration display */}
        <Box sx={{ background: 'linear-gradient(135deg, #f0f5ff 0%, #e8f0fe 100%)', borderRadius: '12px', p: 2, border: '1px solid #bfdbfe', textAlign: 'center' }}>
          <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>{t('demAutorisation.form.duration')}</Typography>
          <Typography sx={{ fontSize: '24px', fontWeight: 800, color: '#0040a1' }}>{fmtDuration(calcDuration())}</Typography>
        </Box>

        {/* Type d'autorisation (Absence) */}
        <Box>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('demAutorisation.form.type')}</Typography>
          <FormControl size="small" fullWidth sx={fieldSx} disabled={loadingAbsences}>
            <Select
              value={abscod}
              onChange={(e) => setAbscod(e.target.value)}
              displayEmpty
              // MenuProps : on force le menu à passer au-dessus du Dialog (modal=1300)
              // pour éviter le cas où il s'affichait derrière le backdrop, donnant
              // une page transparente bloquée. minHeight garantit qu'un menu vide
              // reste visible et fermable au clic extérieur.
              MenuProps={{
                PaperProps: { sx: { zIndex: 1500, minHeight: 48, maxHeight: 320 } },
              }}
              renderValue={(selected) => {
                if (loadingAbsences) return <em style={{ color: '#94a3b8' }}>{t('demAutorisation.form.loadingTypes')}</em>;
                if (!selected) return <em style={{ color: '#94a3b8' }}>{t('demAutorisation.form.typePlaceholder')}</em>;
                const found = absences.find((a) => a.abscod === selected);
                return found ? `${found.abscod} - ${found.abslib}` : selected;
              }}
            >
              {/* Empty / loading state — un menu sans aucun MenuItem rendait
                  un popover invisible que l'utilisateur ne pouvait plus fermer. */}
              {loadingAbsences && (
                <MenuItem value="" disabled>
                  <CircularProgress size={14} sx={{ mr: 1 }} /> {t('demAutorisation.form.loadingTypes')}
                </MenuItem>
              )}
              {!loadingAbsences && absences.length === 0 && (
                <MenuItem value="" disabled>
                  <em style={{ color: '#94a3b8' }}>{t('demAutorisation.form.typeEmpty')}</em>
                </MenuItem>
              )}
              {absences.map((abs) => (
                <MenuItem key={`${abs.abscod}-${abs.soccod ?? ''}`} value={abs.abscod}>
                  {abs.abscod} - {abs.abslib}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('demAutorisation.form.motif')}</Typography>
          <TextField size="small" fullWidth multiline rows={3} value={conmotif} onChange={(e) => setConmotif(e.target.value)} placeholder={t('demAutorisation.form.motifPlaceholder')} sx={fieldSx} />
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: '8px', textTransform: 'none', color: '#64748b' }}>{t('demAutorisation.form.cancel')}</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)' }}>
          {editDemande ? t('demAutorisation.form.modify') : t('demAutorisation.form.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Approve/Refuse Dialog ──
function TraitementDialog({ open, onClose, demande, action }: { open: boolean; onClose: () => void; demande: DemandeAutorisation | null; action: 'approve' | 'refuse' }) {
  const { t } = useTranslation();
  const { uticod } = useAuth();
  const { refetch } = useGetDemandeAutorisations();
  const [commentaire, setCommentaire] = useState('');

  useEffect(() => {
    setCommentaire('');
  }, [open]);

  // Promesse exposée à ActionButton : le composant joue son anim de feedback
  // (check vert / croix rouge) selon resolve/reject avant de fermer le dialog.
  const handleSubmit = async () => {
    if (!demande) return;
    const endpoint = action === 'approve'
      ? `/DemandeAutorisations/approve/${demande.id}`
      : `/DemandeAutorisations/refuse/${demande.id}`;
    try {
      await apiInstance.post(endpoint, { traitePar: uticod, commentaire });
      refetch();
    } catch (err) {
      console.error('Error processing demande:', err);
      throw err;
    }
  };

  const isApprove = action === 'approve';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', pb: 1, color: isApprove ? '#166534' : '#991b1b' }}>
        {isApprove ? t('demAutorisation.traitement.approveTitle') : t('demAutorisation.traitement.refuseTitle')}
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2.5 }}>
        <Typography sx={{ color: '#475569', fontSize: '14px', mb: 2 }}>
          {isApprove
            ? t('demAutorisation.traitement.approvePrompt', { employee: demande?.emplib || demande?.empcod || '' })
            : t('demAutorisation.traitement.refusePrompt', { employee: demande?.emplib || demande?.empcod || '' })
          }
        </Typography>
        <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
          {isApprove ? t('demAutorisation.traitement.commentLabelOptional') : t('demAutorisation.traitement.commentLabelRecommended')}
        </Typography>
        <TextField size="small" fullWidth multiline rows={3} value={commentaire} onChange={(e) => setCommentaire(e.target.value)}
          placeholder={isApprove ? t('demAutorisation.traitement.commentPlaceholderOptional') : t('demAutorisation.traitement.commentPlaceholderRefuse')}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', backgroundColor: '#f8fafc', '& fieldset': { borderColor: '#e2e8f0' } } }} />
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: '8px', textTransform: 'none', color: '#64748b' }}>{t('demAutorisation.traitement.cancel')}</Button>
        <ActionButton
          onAction={handleSubmit}
          onSettled={onClose}
          variant="contained"
          startIcon={isApprove ? <CheckIcon /> : <CloseIcon />}
          successColor={isApprove ? '#16a34a' : '#dc2626'}
          successLabel={isApprove ? t('demAutorisation.traitement.approve') : t('demAutorisation.traitement.refuse')}
          sx={{
            borderRadius: '8px', textTransform: 'none', fontWeight: 700,
            background: isApprove
              ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
              : 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
          }}>
          {isApprove ? t('demAutorisation.traitement.approve') : t('demAutorisation.traitement.refuse')}
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Component ──
function DemandeAutorisationModern() {
  const { t } = useTranslation();
  const { isEmp, uticod } = useAuth();
  const { data = [], isLoading, refetch } = useGetDemandeAutorisations();

  const [formOpen, setFormOpen] = useState(false);
  const [editDemande, setEditDemande] = useState<DemandeAutorisation | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [traitementOpen, setTraitementOpen] = useState(false);
  const [traitementAction, setTraitementAction] = useState<'approve' | 'refuse'>('approve');
  const [selectedDemande, setSelectedDemande] = useState<DemandeAutorisation | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [demandeToDelete, setDemandeToDelete] = useState<DemandeAutorisation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const showSnack = (message: string, severity: 'success' | 'error') =>
    setSnackbar({ open: true, message, severity });

  const pending = data.filter((d: DemandeAutorisation) => getStatus(d) === 'pending');
  const approved = data.filter((d: DemandeAutorisation) => getStatus(d) === 'approved');
  const refused = data.filter((d: DemandeAutorisation) => getStatus(d) === 'refused');

  const handleNewRequest = () => {
    setEditDemande(null);
    setFormOpen(true);
  };

  const handleEdit = (d: DemandeAutorisation) => {
    setEditDemande(d);
    setFormOpen(true);
  };

  const handleApprove = (d: DemandeAutorisation) => {
    setSelectedDemande(d);
    setTraitementAction('approve');
    setTraitementOpen(true);
  };

  const handleRefuse = (d: DemandeAutorisation) => {
    setSelectedDemande(d);
    setTraitementAction('refuse');
    setTraitementOpen(true);
  };

  const handleDeleteClick = (d: DemandeAutorisation) => {
    setDemandeToDelete(d);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!demandeToDelete) return;
    setDeleteLoading(true);
    try {
      await apiInstance.delete(`/DemandeAutorisations/${demandeToDelete.id}`);
      showSnack(t('demAutorisation.msg.deletedSuccess'), 'success');
      refetch();
    } catch (err) {
      showSnack(t('demAutorisation.msg.deleteError'), 'error');
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
      setDemandeToDelete(null);
    }
  };

  return (
    <Box className="da-container">
      {/* Header */}
      <Box className="da-header">
        <Box>
          <Typography className="da-title">{t('demAutorisation.header.title')}</Typography>
          <Typography className="da-subtitle">
            <Trans
              i18nKey="demAutorisation.header.subtitle"
              count={pending.length}
              values={{ count: pending.length }}
              components={{ 0: <strong style={{ color: '#0040a1' }} /> }}
            />
          </Typography>
        </Box>
        <Button className="da-new-btn" startIcon={<AddIcon />} sx={{ color: '#fff' }} onClick={handleNewRequest}>
          {t('demAutorisation.header.newRequest')}
        </Button>
      </Box>

      <Box className="da-body">
        {/* Left: table */}
        <Box className="da-left">
          {/* Table header */}
          <Box className="da-table-head">
            <Box className="da-th da-col-emp">{t('demAutorisation.headers.employee')}</Box>
            <Box className="da-th da-col-period">{t('demAutorisation.headers.period')}</Box>
            <Box className="da-th da-col-duration">{t('demAutorisation.headers.duration')}</Box>
            <Box className="da-th da-col-motif">{t('demAutorisation.headers.motif')}</Box>
            <Box className="da-th da-col-status">{t('demAutorisation.headers.status')}</Box>
            <Box className="da-th da-col-actions" style={{ textAlign: 'right' }}>{t('demAutorisation.headers.actions')}</Box>
          </Box>

          {/* Rows */}
          {isLoading ? (
            <ListSkeleton rows={5} />
          ) : data.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: '#94a3b8' }}>
              <AccessTimeIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
              <Typography>{t('demAutorisation.empty')}</Typography>
            </Box>
          ) : (
            <Box className="da-rows">
              {data.map((d: DemandeAutorisation, idx: number) => {
                const status = getStatus(d);
                const statusStyle = STATUS_STYLE[status];
                return (
                  <Box key={d.id} className="da-row" sx={staggerSx(idx)}>
                    {/* Employee */}
                    <Box className="da-col-emp da-emp-cell">
                      <Avatar className="da-avatar">{(d.emplib || d.empcod)?.charAt(0)?.toUpperCase()}</Avatar>
                      <Box>
                        <Typography className="da-emp-name">{d.emplib || d.empcod}</Typography>
                        <Typography className="da-emp-sub">#{d.concod || d.id}</Typography>
                      </Box>
                    </Box>

                    {/* Period */}
                    <Box className="da-col-period">
                      <Typography className="da-period-dates">
                        {fmtDate(d.condep)} — {fmtDate(d.conret)}
                      </Typography>
                      <Typography className="da-period-time">
                        {fmtTime(d.condep)} → {fmtTime(d.conret)}
                      </Typography>
                    </Box>

                    {/* Duration */}
                    <Box className="da-col-duration">
                      <Box className="da-duration-badge">
                        {fmtDuration(d.connbjour)}
                      </Box>
                    </Box>

                    {/* Motif */}
                    <Box className="da-col-motif">
                      <Typography className="da-motif-text" title={d.conmotif || ''}>
                        {d.conmotif ? (d.conmotif.length > 30 ? d.conmotif.slice(0, 30) + '...' : d.conmotif) : '—'}
                      </Typography>
                    </Box>

                    {/* Status */}
                    <Box className="da-col-status">
                      <Box className="da-status-badge" style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}>
                        {t(`demAutorisation.status.${status}`)}
                      </Box>
                    </Box>

                    {/* Actions */}
                    <Box className="da-col-actions da-actions">
                      {/* Employee actions */}
                      {isEmp && d.empcod === uticod && status === 'pending' && (
                        <>
                          <IconButton size="small" className="da-action-edit" onClick={() => handleEdit(d)} title={t('demAutorisation.actions.edit')}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small"
                            sx={{ color: '#ba1a1a', backgroundColor: '#fee2e2', '&:hover': { backgroundColor: '#fecaca' } }}
                            onClick={() => handleDeleteClick(d)} title={t('demAutorisation.actions.delete')}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </>
                      )}
                      {/* Admin actions */}
                      {!isEmp && status === 'pending' && (
                        <>
                          <Button size="small" className="da-action-refuse" onClick={() => handleRefuse(d)} startIcon={<CloseIcon />}>
                            {t('demAutorisation.actions.refuse')}
                          </Button>
                          <Button size="small" className="da-action-accept" onClick={() => handleApprove(d)} startIcon={<CheckIcon />}>
                            {t('demAutorisation.actions.approve')}
                          </Button>
                        </>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        {/* Right sidebar */}
        <Box className="da-sidebar">
          {/* Quick stats */}
          <Box className="da-stats-grid">
            <Paper className="da-stat-card">
              <Typography className="da-stat-value da-stat-primary">{approved.length}</Typography>
              <Typography className="da-stat-label">{t('demAutorisation.stats.approved')}</Typography>
            </Paper>
            <Paper className="da-stat-card">
              <Typography className="da-stat-value da-stat-error">{refused.length}</Typography>
              <Typography className="da-stat-label">{t('demAutorisation.stats.refused')}</Typography>
            </Paper>
            <Paper className="da-stat-card">
              <Typography className="da-stat-value da-stat-warning">{pending.length}</Typography>
              <Typography className="da-stat-label">{t('demAutorisation.stats.pending')}</Typography>
            </Paper>
            <Paper className="da-stat-card">
              <Typography className="da-stat-value da-stat-primary">{data.length}</Typography>
              <Typography className="da-stat-label">{t('demAutorisation.stats.total')}</Typography>
            </Paper>
          </Box>

          {/* Info card */}
          <Paper className="da-info-card">
            <Typography className="da-info-title">{t('demAutorisation.info.title')}</Typography>
            <Typography className="da-info-text">
              {t('demAutorisation.info.text')}
            </Typography>
          </Paper>
        </Box>
      </Box>

      {/* Form Dialog */}
      <DemandeFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); refetch(); }}
        editDemande={editDemande}
        onSuccess={() => showSnack(editDemande ? t('demAutorisation.msg.updatedSuccess') : t('demAutorisation.msg.createdSuccess'), 'success')}
      />

      {/* Approve/Refuse Dialog */}
      <TraitementDialog
        open={traitementOpen}
        onClose={() => setTraitementOpen(false)}
        demande={selectedDemande}
        action={traitementAction}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}
        PaperProps={{ sx: { borderRadius: '12px', minWidth: '350px' } }}>
        <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', color: '#ba1a1a' }}>
          {t('demAutorisation.delete.title')}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#475569', fontSize: '14px', mt: 1 }}>
            {t('demAutorisation.delete.prompt', { ref: demandeToDelete ? ` (${demandeToDelete.concod || demandeToDelete.id})` : '' })}
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: '12px', mt: 2 }}>
            {t('demAutorisation.delete.irreversible')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} sx={{ color: '#64748b', textTransform: 'none' }}>
            {t('demAutorisation.delete.cancel')}
          </Button>
          <Button onClick={confirmDelete} variant="contained" color="error"
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon />}
            sx={{ textTransform: 'none', borderRadius: '8px' }}>
            {t('demAutorisation.delete.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} sx={{ borderRadius: '10px' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default DemandeAutorisationModern;