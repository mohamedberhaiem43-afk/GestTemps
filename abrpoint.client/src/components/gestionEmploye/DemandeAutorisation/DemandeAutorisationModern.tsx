import { useEffect, useState, useCallback } from 'react';
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
import useGetDemandeAutorisations from '../../../hooks/demandeAutorisationHooks/useGetDemandeAutorisations';
import { useAuth } from '../../helper/AuthProvider';
import { DemandeAutorisation } from '../../../models/DemandeAutorisation';
import apiInstance from '../../API/apiInstance';
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

const getStatus = (d: DemandeAutorisation): 'Approuvé' | 'Refusé' | 'En attente' => {
  const s = d.statut?.trim() ?? '';
  if (s.includes('Approuv') || s.includes('Accept')) return 'Approuvé';
  if (s.includes('Refus')) return 'Refusé';
  return 'En attente';
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  'Approuvé': { bg: '#dcfce7', text: '#166534' },
  'Refusé': { bg: '#fee2e2', text: '#991b1b' },
  'En attente': { bg: '#fef9c3', text: '#854d0e' },
};

// ── Form Dialog ──
function DemandeFormDialog({ open, onClose, editDemande }: { open: boolean; onClose: () => void; editDemande: DemandeAutorisation | null }) {
  const { soccod, isEmp, uticod } = useAuth();
  const { refetch } = useGetDemandeAutorisations();

  const [concod, setConcod] = useState(`DA${Date.now().toString().slice(-6)}`);
  const [condat, setCondat] = useState(today());
  const [condep, setCondep] = useState(now());
  const [conret, setConret] = useState(now());
  const [conmotif, setConmotif] = useState('');
  const [abscod, setAbscod] = useState('');
  const [absences, setAbsences] = useState<AbsenceOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch absences for the dropdown
const fetchAbsences = useCallback(async () => {
  if (!soccod) return;
  try {
    const res = await apiInstance.get(`/Absences/get-libs/${soccod}`);
    
    // Convert key-value object to AbsenceOption array
    const rawData = res.data;
    let absData: AbsenceOption[] = [];

    if (Array.isArray(rawData)) {
      absData = rawData;
    } else if (rawData && typeof rawData === 'object') {
      absData = Object.entries(rawData).map(([key, value]) => ({
        abscod: key,
        soccod: soccod,
        abslib: value as string,
        abscng: '',
      }));
    }

    setAbsences(absData);

    if (!editDemande) {
      const defaultAbs = absData.find((a) => a.abslib.toLowerCase().includes('autorisation') || a.abscng === 'B');
      if (defaultAbs) {
        setAbscod(defaultAbs.abscod);
      } else if (absData.length > 0) {
        setAbscod(absData[0].abscod);
      }
    }
  } catch (err) {
    console.error('Error fetching absences:', err);
  }
}, [soccod, editDemande]);

  useEffect(() => {
    if (open) {
      fetchAbsences();
    }
  }, [open, fetchAbsences]);

  useEffect(() => {
    if (editDemande) {
      setConcod(editDemande.concod || '');
      setCondat(editDemande.condat ? new Date(editDemande.condat).toISOString().split('T')[0] : today());
      setCondep(editDemande.condep ? new Date(editDemande.condep).toISOString().slice(0, 16) : now());
      setConret(editDemande.conret ? new Date(editDemande.conret).toISOString().slice(0, 16) : now());
      setConmotif(editDemande.conmotif || '');
      setAbscod(editDemande.abscod || '');
    } else {
      setConcod(`DA${Date.now().toString().slice(-6)}`);
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
        {editDemande ? 'Modifier la demande' : 'Nouvelle demande d\'autorisation'}
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>N° Demande</Typography>
            <TextField size="small" fullWidth value={concod} onChange={(e) => setConcod(e.target.value)} InputProps={{ readOnly: !!editDemande }} sx={fieldSx} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Date demande</Typography>
            <TextField size="small" fullWidth type="date" value={condat} onChange={(e) => setCondat(e.target.value)} sx={fieldSx} />
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Heure début</Typography>
            <TextField size="small" fullWidth type="datetime-local" value={condep} onChange={(e) => setCondep(e.target.value)} sx={fieldSx} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Heure fin</Typography>
            <TextField size="small" fullWidth type="datetime-local" value={conret} onChange={(e) => setConret(e.target.value)} sx={fieldSx} />
          </Box>
        </Box>

        {/* Duration display */}
        <Box sx={{ background: 'linear-gradient(135deg, #f0f5ff 0%, #e8f0fe 100%)', borderRadius: '12px', p: 2, border: '1px solid #bfdbfe', textAlign: 'center' }}>
          <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>Durée</Typography>
          <Typography sx={{ fontSize: '24px', fontWeight: 800, color: '#0040a1' }}>{fmtDuration(calcDuration())}</Typography>
        </Box>

        {/* Type d'autorisation (Absence) */}
        <Box>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Type d'autorisation</Typography>
          <FormControl size="small" fullWidth sx={fieldSx}>
            <Select
              value={abscod}
              onChange={(e) => setAbscod(e.target.value)}
              displayEmpty
              renderValue={(selected) => {
                if (!selected) return <em style={{ color: '#94a3b8' }}>Sélectionner un type...</em>;
                const found = absences.find((a) => a.abscod === selected);
                return found ? `${found.abscod} - ${found.abslib}` : selected;
              }}
            >
              {absences.map((abs) => (
                <MenuItem key={`${abs.abscod}-${abs.soccod}`} value={abs.abscod}>
                  {abs.abscod} - {abs.abslib}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Motif</Typography>
          <TextField size="small" fullWidth multiline rows={3} value={conmotif} onChange={(e) => setConmotif(e.target.value)} placeholder="Raison de la demande d'autorisation..." sx={fieldSx} />
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: '8px', textTransform: 'none', color: '#64748b' }}>Annuler</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)' }}>
          {editDemande ? 'Modifier' : 'Soumettre'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Approve/Refuse Dialog ──
function TraitementDialog({ open, onClose, demande, action }: { open: boolean; onClose: () => void; demande: DemandeAutorisation | null; action: 'approve' | 'refuse' }) {
  const { uticod } = useAuth();
  const { refetch } = useGetDemandeAutorisations();
  const [commentaire, setCommentaire] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCommentaire('');
  }, [open]);

  const handleSubmit = async () => {
    if (!demande) return;
    setLoading(true);
    try {
      const endpoint = action === 'approve'
        ? `/DemandeAutorisations/approve/${demande.id}`
        : `/DemandeAutorisations/refuse/${demande.id}`;

      await apiInstance.post(endpoint, { traitePar: uticod, commentaire });
      refetch();
      onClose();
    } catch (err) {
      console.error('Error processing demande:', err);
    } finally {
      setLoading(false);
    }
  };

  const isApprove = action === 'approve';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', pb: 1, color: isApprove ? '#166534' : '#991b1b' }}>
        {isApprove ? 'Approuver la demande' : 'Refuser la demande'}
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2.5 }}>
        <Typography sx={{ color: '#475569', fontSize: '14px', mb: 2 }}>
          {isApprove
            ? `Êtes-vous sûr de vouloir approuver la demande de ${demande?.emplib || demande?.empcod} ?`
            : `Êtes-vous sûr de vouloir refuser la demande de ${demande?.emplib || demande?.empcod} ?`
          }
        </Typography>
        <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
          Commentaire {isApprove ? '(optionnel)' : '(recommandé)'}
        </Typography>
        <TextField size="small" fullWidth multiline rows={3} value={commentaire} onChange={(e) => setCommentaire(e.target.value)}
          placeholder={isApprove ? 'Commentaire optionnel...' : 'Raison du refus...'}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', backgroundColor: '#f8fafc', '& fieldset': { borderColor: '#e2e8f0' } } }} />
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: '8px', textTransform: 'none', color: '#64748b' }}>Annuler</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : (isApprove ? <CheckIcon /> : <CloseIcon />)}
          sx={{
            borderRadius: '8px', textTransform: 'none', fontWeight: 700,
            background: isApprove
              ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
              : 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
          }}>
          {isApprove ? 'Approuver' : 'Refuser'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Component ──
function DemandeAutorisationModern() {
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

  const pending = data.filter((d: DemandeAutorisation) => getStatus(d) === 'En attente');
  const approved = data.filter((d: DemandeAutorisation) => getStatus(d) === 'Approuvé');
  const refused = data.filter((d: DemandeAutorisation) => getStatus(d) === 'Refusé');

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
      showSnack('Demande supprimée avec succès', 'success');
      refetch();
    } catch (err) {
      showSnack('Erreur lors de la suppression', 'error');
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
          <Typography className="da-title">Demandes d'Autorisation</Typography>
          <Typography className="da-subtitle">
            Vous avez <strong style={{ color: '#0040a1' }}>{pending.length} demande{pending.length !== 1 ? 's' : ''}</strong> en attente de validation.
          </Typography>
        </Box>
        <Button className="da-new-btn" startIcon={<AddIcon />} onClick={handleNewRequest}>
          Nouvelle demande
        </Button>
      </Box>

      <Box className="da-body">
        {/* Left: table */}
        <Box className="da-left">
          {/* Table header */}
          <Box className="da-table-head">
            <Box className="da-th da-col-emp">Employé</Box>
            <Box className="da-th da-col-period">Période</Box>
            <Box className="da-th da-col-duration">Durée</Box>
            <Box className="da-th da-col-motif">Motif</Box>
            <Box className="da-th da-col-status">Statut</Box>
            <Box className="da-th da-col-actions" style={{ textAlign: 'right' }}>Actions</Box>
          </Box>

          {/* Rows */}
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : data.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: '#94a3b8' }}>
              <AccessTimeIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
              <Typography>Aucune demande d'autorisation</Typography>
            </Box>
          ) : (
            <Box className="da-rows">
              {data.map((d: DemandeAutorisation) => {
                const status = getStatus(d);
                const statusStyle = STATUS_STYLE[status];
                return (
                  <Box key={d.id} className="da-row">
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
                        {status}
                      </Box>
                    </Box>

                    {/* Actions */}
                    <Box className="da-col-actions da-actions">
                      {/* Employee actions */}
                      {isEmp && d.empcod === uticod && status === 'En attente' && (
                        <>
                          <IconButton size="small" className="da-action-edit" onClick={() => handleEdit(d)} title="Modifier">
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small"
                            sx={{ color: '#ba1a1a', backgroundColor: '#fee2e2', '&:hover': { backgroundColor: '#fecaca' } }}
                            onClick={() => handleDeleteClick(d)} title="Supprimer">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </>
                      )}
                      {/* Admin actions */}
                      {!isEmp && status === 'En attente' && (
                        <>
                          <Button size="small" className="da-action-refuse" onClick={() => handleRefuse(d)} startIcon={<CloseIcon />}>
                            Refuser
                          </Button>
                          <Button size="small" className="da-action-accept" onClick={() => handleApprove(d)} startIcon={<CheckIcon />}>
                            Approuver
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
              <Typography className="da-stat-label">Approuvées</Typography>
            </Paper>
            <Paper className="da-stat-card">
              <Typography className="da-stat-value da-stat-error">{refused.length}</Typography>
              <Typography className="da-stat-label">Refusées</Typography>
            </Paper>
            <Paper className="da-stat-card">
              <Typography className="da-stat-value da-stat-warning">{pending.length}</Typography>
              <Typography className="da-stat-label">En attente</Typography>
            </Paper>
            <Paper className="da-stat-card">
              <Typography className="da-stat-value da-stat-primary">{data.length}</Typography>
              <Typography className="da-stat-label">Total</Typography>
            </Paper>
          </Box>

          {/* Info card */}
          <Paper className="da-info-card">
            <Typography className="da-info-title">ℹ️ Informations</Typography>
            <Typography className="da-info-text">
              Les demandes d'autorisation sont traitées par l'administrateur.
              Une fois approuvée, l'autorisation est automatiquement créée dans le système.
            </Typography>
          </Paper>
        </Box>
      </Box>

      {/* Form Dialog */}
      <DemandeFormDialog open={formOpen} onClose={() => { setFormOpen(false); refetch(); }} editDemande={editDemande} />

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
          Supprimer ma demande
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#475569', fontSize: '14px', mt: 1 }}>
            Êtes-vous sûr de vouloir supprimer votre demande d'autorisation
            {demandeToDelete ? ` (${demandeToDelete.concod || demandeToDelete.id})` : ''} ?
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: '12px', mt: 2 }}>
            Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} sx={{ color: '#64748b', textTransform: 'none' }}>
            Annuler
          </Button>
          <Button onClick={confirmDelete} variant="contained" color="error"
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon />}
            sx={{ textTransform: 'none', borderRadius: '8px' }}>
            Oui, Supprimer
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