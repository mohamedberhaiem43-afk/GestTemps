import { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, TextField, MenuItem,
  FormControl, Select, Snackbar, Alert, CircularProgress,
  Avatar, IconButton, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PrintIcon from '@mui/icons-material/Print';
import DeleteIcon from '@mui/icons-material/Delete';
import { CongeProvider, useCongeContext } from '../../../helper/CongeContext';
import useGetDemConges from '../../../../hooks/congeHooks/useGetDemConges';
import useAcceptDemConge from '../../../../hooks/congeHooks/useAcceptDemConge';
import useAddDemConge from '../../../../hooks/congeHooks/useAddDemConge';
import useUpdateDemConge from '../../../../hooks/congeHooks/useUpdateConge';
import useDeleteDemConge from '../../../../hooks/congeHooks/useDeleteDemConge';
import useGetCongeAbsenceLibs from '../../../../hooks/absenceHooks/useGetCongeAbsenceLibs';
import useGetEmployee from '../../../../hooks/employeHooks/useGetEmployee';
import useGetDroitConge from '../../../../hooks/congeHooks/useGetDroitConge';
import { useAuth } from '../../../helper/AuthProvider';
import { Conge } from '../../../../models/Conge';
import { getDatePartFromDate } from '../../../helper/TimeConverter/ExtractDateOnly';
import apiInstance from '../../../API/apiInstance';
import './DemCongeModern.css';

// ── helpers ──────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];

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
  rtt:     { bg: 'rgba(0,81,54,0.12)',  text: '#005136' },
};

const getTypeColor = (abscod: string) => {
  const k = abscod?.toLowerCase() ?? '';
  if (k.includes('mal')) return TYPE_COLORS.maladie;
  if (k.includes('rtt')) return TYPE_COLORS.rtt;
  return TYPE_COLORS.default;
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  'Accepté':   { bg: '#dcfce7', text: '#166534' },
  'Refusé':    { bg: '#fee2e2', text: '#991b1b' },
  'En attente':{ bg: '#fef9c3', text: '#854d0e' },
};

// ── Mini Calendar ─────────────────────────────────────────────────────────────
function MiniCalendar({ leaves }: { leaves: Conge[] }) {
  const [current, setCurrent] = useState(new Date());
  const year = current.getFullYear();
  const month = current.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const leaveDays = useMemo(() => {
    const set = new Set<string>();
    leaves.forEach((l) => {
      if (!l.condep || !l.conret) return;
      const start = new Date(l.condep);
      const end = new Date(l.conret);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === month && d.getFullYear() === year)
          set.add(d.getDate().toString());
      }
    });
    return set;
  }, [leaves, month, year]);

  const monthName = current.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const cells = Array.from({ length: offset + daysInMonth }, (_, i) =>
    i < offset ? null : i - offset + 1
  );

  return (
    <Paper className="dcm-calendar-card">
      <Box className="dcm-calendar-header">
        <Typography className="dcm-calendar-title">{monthName.charAt(0).toUpperCase() + monthName.slice(1)}</Typography>
        <Box className="dcm-calendar-nav">
          <IconButton size="small" onClick={() => setCurrent(new Date(year, month - 1, 1))}><ChevronLeftIcon fontSize="small" /></IconButton>
          <IconButton size="small" onClick={() => setCurrent(new Date(year, month + 1, 1))}><ChevronRightIcon fontSize="small" /></IconButton>
        </Box>
      </Box>
      <Box className="dcm-calendar-grid">
        {['LU','MA','ME','JE','VE','SA','DI'].map((d) => (
          <Box key={d} className="dcm-cal-dow">{d}</Box>
        ))}
        {cells.map((day, i) => (
          <Box key={i} className={`dcm-cal-day ${day && leaveDays.has(day.toString()) ? 'dcm-cal-day--leave' : ''} ${!day ? 'dcm-cal-day--empty' : ''}`}>
            {day ?? ''}
            {day && leaveDays.has(day.toString()) && <span className="dcm-cal-dot" />}
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

// ── Form Dialog ───────────────────────────────────────────────────────────────
function CongeFormDialog({ open, onClose, editConge, onSuccess }: { open: boolean; onClose: () => void; editConge: Conge | null; onSuccess?: () => void }) {
  const { soccod, isEmp, uticod } = useAuth();
  const { refetch } = useGetDemConges();
  const { data: absences = [] } = useGetCongeAbsenceLibs();
  const { data: employeOptions = [] } = useGetEmployee();
  const { mutate: addConge, isLoading: adding } = useAddDemConge();
  const { mutate: updateConge, isLoading: updating } = useUpdateDemConge();

  const [empcod, setEmpcod] = useState(() => isEmp && uticod ? uticod : '');
  const [concod, setConcod] = useState('');
  const [condat, setCondat] = useState(today());
  const [condep, setCondep] = useState(today());
  const [conret, setConret] = useState(today());
  const [conamdep, setConamdep] = useState(false);
  const [conamret, setConamret] = useState(false);
  const [abscod, setAbscod] = useState('');
  const [conadr, setConadr] = useState('');
  const [contel, setContel] = useState('');
  const [conref, setConref] = useState('');
  const [connbjour, setConnbjour] = useState(0);

  // Droit conge - leave balance
  const currentEmpcod = isEmp && uticod ? uticod : empcod;
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const yearEnd = `${new Date().getFullYear()}-12-31`;
  const { data: droitCongeData } = useGetDroitConge(currentEmpcod, yearStart, yearEnd);
  const droitConge = Array.isArray(droitCongeData) ? droitCongeData[0] : droitCongeData;
  const soldeAnterieur = (droitConge as any)?.soldeinit ?? (droitConge as any)?.Soldeinit ?? 0;
  const droitCongeTotal = (droitConge as any)?.droitconge ?? (droitConge as any)?.Droitconge ?? 0;
  const droitMensuel = Number((droitCongeTotal / 12).toFixed(2));
  const droitRestant = (droitConge as any)?.droitrestant ?? (droitConge as any)?.Droitrestant ?? 0;
  const nouveauSolde = Math.max(0, droitRestant - connbjour);

  // Auto-fill phone when employee is selected or when uticod is set (employee self-request)
  useEffect(() => {
    const targetEmpcod = isEmp && uticod ? uticod : empcod;
    if (targetEmpcod && !editConge) {
      apiInstance.get(`/Employes/${targetEmpcod}`).then((res) => {
        const tel = res.data?.emptel || res.data?.empmob || '';
        if (tel) setContel(tel);
      }).catch(() => {});
    }
  }, [empcod, isEmp, uticod, editConge]);

  // Set default type de congé when absences load
  useEffect(() => {
    if (!editConge && open && absences && !abscod) {
      const absEntries = Object.entries(absences);
      if (absEntries.length > 0) {
        setAbscod(absEntries[0][0]);
      }
    }
  }, [open, editConge, absences, abscod]);

  // Fetch next concod from database when form opens in add mode
  useEffect(() => {
    if (!editConge && open && soccod) {
      apiInstance.get(`/DemConges/get-next-concod/${soccod}`)
        .then(res => {
          const nextConcod = res.data?.concod || res.data || '';
          setConcod(nextConcod);
        })
        .catch(() => { /* silent */ });
    }
  }, [open, editConge, soccod]);

  useEffect(() => {
    if (editConge) {
      setEmpcod(editConge.empcod);
      setConcod(editConge.concod);
      setCondat(getDatePartFromDate(editConge.condat));
      setCondep(getDatePartFromDate(editConge.condep));
      setConret(getDatePartFromDate(editConge.conret));
      setConamdep(editConge.conamdep === '1');
      setConamret(editConge.conamret === '1');
      setAbscod(editConge.abscod);
      setConadr(editConge.conadr);
      setContel(editConge.contel);
      setConref(editConge.conref);
      setConnbjour(editConge.connbjour);
    } else {
      setEmpcod(isEmp && uticod ? uticod : '');
      setCondat(today());
      setCondep(today());
      setConret(today());
      setConamdep(false);
      setConamret(false);
      setAbscod('');
      setConadr('');
      setContel('');
      setConref('');
      setConnbjour(0);
      // concod will be set by the useEffect above
    }
  }, [editConge, open]);

  useEffect(() => {
    if (!condep || !conret) { setConnbjour(0); return; }
    const diff = (new Date(conret).getTime() - new Date(condep).getTime()) / 86400000;
    setConnbjour(Math.max(0, diff + (conamret ? 0.5 : 0) - (conamdep ? 0.5 : 0)));
  }, [condep, conret, conamdep, conamret]);

  const handleSubmit = () => {
    const payload: Conge = {
      soccod: soccod || '', empcod, concod,
      condat: condat ? new Date(condat) : null,
      condep: condep ? new Date(condep) : null,
      conret: conret ? new Date(conret) : null,
      conamdep: conamdep ? '1' : '0',
      conamret: conamret ? '1' : '0',
      abscod, conadr, contel, conref, connbjour,
      conjour: 'J', emplib: null, condg: '', conrefus: '', consolde: 0,
    };
    const cb = {
      onSuccess: () => {
        refetch();
        if (onSuccess) onSuccess();
        onClose();
      },
      onError: () => {}
    };
    editConge ? updateConge(payload, cb) : addConge(payload, cb);
  };

  const isBusy = adding || updating;
  const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '8px', backgroundColor: '#f8fafc', '& fieldset': { borderColor: '#e2e8f0' } } };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}
         sx={{
        '& .MuiDialog-container': {
          alignItems: 'center',
        },
        '& .MuiDialog-paper': {
          margin: { xs: '16px', sm: '32px' },
          width: { xs: 'calc(100% - 32px)', sm: '100%' },
          maxWidth: { xs: '100%', sm: '800px' },
        },
      }}>
      <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', pb: 1 }}>
        {editConge ? 'Modifier la demande' : 'Nouvelle demande de congé'}
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>N° Ordre</Typography>
            <TextField size="small" fullWidth value={concod} onChange={(e) => setConcod(e.target.value)} InputProps={{ readOnly: true }} sx={fieldSx} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Date demande</Typography>
            <TextField size="small" fullWidth type="date" value={condat} InputProps={{ readOnly: true }} sx={fieldSx} />
          </Box>
        </Box>

        {!isEmp && (
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Employé</Typography>
            <FormControl fullWidth size="small">
              <Select value={empcod} onChange={(e) => setEmpcod(e.target.value)} sx={{ borderRadius: '8px', backgroundColor: '#f8fafc', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' } }}>
                {Object.entries(employeOptions).map(([k, v]) => <MenuItem key={k} value={k}>{String(v)}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        )}

        <Box>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Type de congé</Typography>
          <FormControl fullWidth size="small">
            <Select value={abscod} onChange={(e) => setAbscod(e.target.value)} sx={{ borderRadius: '8px', backgroundColor: '#f8fafc', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' } }}>
              {Object.entries(absences).map(([k, v]) => <MenuItem key={k} value={k}>{String(v)}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr auto 1fr auto auto' }, gap: 1.5, alignItems: 'end' }}>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Date départ</Typography>
            <TextField size="small" fullWidth type="date" value={condep} onChange={(e) => setCondep(e.target.value)} sx={fieldSx} />
          </Box>
          <Box sx={{ pb: 0.5 }}>
            <Typography sx={{ fontSize: '10px', color: '#94a3b8', mb: 0.5 }}>AM</Typography>
            <input type="checkbox" checked={conamdep} onChange={(e) => setConamdep(e.target.checked)} style={{ width: 16, height: 16 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Date retour</Typography>
            <TextField size="small" fullWidth type="date" value={conret} onChange={(e) => setConret(e.target.value)} sx={fieldSx} />
          </Box>
          <Box sx={{ pb: 0.5 }}>
            <Typography sx={{ fontSize: '10px', color: '#94a3b8', mb: 0.5 }}>AM</Typography>
            <input type="checkbox" checked={conamret} onChange={(e) => setConamret(e.target.checked)} style={{ width: 16, height: 16 }} />
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 2', sm: 'auto' } }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#0040a1', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Jours</Typography>
            <TextField size="small" fullWidth value={connbjour} InputProps={{ readOnly: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', backgroundColor: '#eff6ff', '& fieldset': { borderColor: '#bfdbfe' }, '& input': { color: '#0040a1', fontWeight: 700, textAlign: 'center' } } }} />
          </Box>
        </Box>

        {/* Leave Balance Info */}
        {currentEmpcod && droitConge && (
          <Box sx={{ background: 'linear-gradient(135deg, #f0f5ff 0%, #e8f0fe 100%)', borderRadius: '12px', p: 2, border: '1px solid #bfdbfe' }}>
            <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#0040a1', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📊 Solde de Congé
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <Box sx={{ background: '#fff', borderRadius: '8px', p: 1.5, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>Solde Antérieur</Typography>
                <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#0040a1' }}>{soldeAnterieur}</Typography>
                <Typography sx={{ fontSize: '9px', color: '#94a3b8' }}>jours</Typography>
              </Box>
              <Box sx={{ background: '#fff', borderRadius: '8px', p: 1.5, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>Droit Mensuel</Typography>
                <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#005136' }}>{droitMensuel}</Typography>
                <Typography sx={{ fontSize: '9px', color: '#94a3b8' }}>jours/mois</Typography>
              </Box>
              <Box sx={{ background: '#fff', borderRadius: '8px', p: 1.5, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>Solde Actuel</Typography>
                <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#7c3aed' }}>{droitRestant}</Typography>
                <Typography sx={{ fontSize: '9px', color: '#94a3b8' }}>jours restants</Typography>
              </Box>
              <Box sx={{ background: '#fff', borderRadius: '8px', p: 1.5, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: connbjour > 0 ? '2px solid #f59e0b' : 'none' }}>
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>Nouveau Solde</Typography>
                <Typography sx={{ fontSize: '20px', fontWeight: 800, color: nouveauSolde < 0 ? '#ba1a1a' : '#059669' }}>{nouveauSolde}</Typography>
                <Typography sx={{ fontSize: '9px', color: '#94a3b8' }}>après congé</Typography>
              </Box>
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Adresse pendant congé</Typography>
            <TextField size="small" fullWidth value={conadr} onChange={(e) => setConadr(e.target.value)} sx={fieldSx} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Téléphone</Typography>
            <TextField size="small" fullWidth value={contel} onChange={(e) => setContel(e.target.value)} sx={fieldSx} />
          </Box>
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: '8px', textTransform: 'none', color: '#64748b' }}>Annuler</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isBusy}
          startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)' }}>
          {editConge ? 'Modifier' : 'Soumettre'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function DemCongeModernInner() {
  const { soccod, isEmp, isManager, sercod, uticod, hasPermission } = useAuth();
  const { setSelectedConge } = useCongeContext();
  const { data = [], isLoading, refetch } = useGetDemConges();
  const { mutate: acceptConge } = useAcceptDemConge();
  const { data: absenceLibs = [] } = useGetCongeAbsenceLibs();
  const [managerEmployeeCodes, setManagerEmployeeCodes] = useState<Set<string> | null>(null);
  const [isManagerScopeLoading, setIsManagerScopeLoading] = useState(false);

  const canAdd = hasPermission('Gestion des Congés', 'add');
  const canModify = hasPermission('Gestion des Congés', 'modify');
  const canDelete = hasPermission('Gestion des Congés', 'delete');
  const canConsult = hasPermission('Gestion des Congés', 'consult');

  useEffect(() => {
    if (!isManager || !soccod || !uticod || !sercod) {
      setManagerEmployeeCodes(null);
      setIsManagerScopeLoading(false);
      return;
    }

    let active = true;
    setIsManagerScopeLoading(true);

    apiInstance.get(`/Employes/${soccod}/${uticod}`)
      .then((res) => {
        if (!active) return;
        const scopedCodes = new Set<string>(
          (res.data ?? [])
            .filter((e: any) => e.sercod === sercod)
            .map((e: any) => e.empcod)
        );
        if (uticod) scopedCodes.add(uticod);
        setManagerEmployeeCodes(scopedCodes);
      })
      .catch(() => {
        if (!active) return;
        setManagerEmployeeCodes(new Set<string>(uticod ? [uticod] : []));
      })
      .finally(() => {
        if (!active) return;
        setIsManagerScopeLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isManager, soccod, uticod, sercod]);

  const displayData: Conge[] = useMemo(() => {
    if (isEmp && uticod) {
      return data.filter((c: Conge) => c.empcod === uticod);
    }

    if (isManager && sercod) {
      if (!managerEmployeeCodes) return [];
      return data.filter((c: Conge) => managerEmployeeCodes.has(c.empcod));
    }

    return data;
  }, [data, isEmp, uticod, isManager, sercod, managerEmployeeCodes]);

  const isDataLoading = isLoading || (isManager && !!sercod && isManagerScopeLoading);

  const pending = displayData.filter((c: Conge) => getStatus(c) === 'En attente');
  const accepted = displayData.filter((c: Conge) => getStatus(c) === 'Accepté');
  const refused = displayData.filter((c: Conge) => getStatus(c) === 'Refusé');
  const [formOpen, setFormOpen] = useState(false);
  const [editConge, setEditConge] = useState<Conge | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [refuseConfirmOpen, setRefuseConfirmOpen] = useState(false);
  const [congeToRefuse, setCongeToRefuse] = useState<Conge | null>(null);
  const [acceptConfirmOpen, setAcceptConfirmOpen] = useState(false);
  const [congeToAccept, setCongeToAccept] = useState<Conge | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [congeToDelete, setCongeToDelete] = useState<Conge | null>(null);
  const deleteMutation = useDeleteDemConge();

  const showSnack = (message: string, severity: 'success' | 'error') =>
    setSnackbar({ open: true, message, severity });

  const handleAcceptClick = (c: Conge) => {
    setCongeToAccept(c);
    setAcceptConfirmOpen(true);
  };

  const confirmAccept = () => {
    if (!congeToAccept) return;
    acceptConge({ concod: congeToAccept.concod, empcod: congeToAccept.empcod }, {
      onSuccess: (res: any) => { showSnack(res.message || 'Demande acceptée avec succès', 'success'); refetch(); },
      onError: (err: any) => showSnack(err?.response?.data?.message || 'Erreur', 'error'),
    });
    setAcceptConfirmOpen(false);
    setCongeToAccept(null);
  };

  const handleRefuseClick = (c: Conge) => {
    setCongeToRefuse(c);
    setRefuseConfirmOpen(true);
  };

  const confirmRefuse = () => {
    if (!congeToRefuse) return;
    const { soccod, concod, empcod } = congeToRefuse;
    
    apiInstance.post(`/DemConges/refuse-demconge/${soccod}/${concod}/${empcod}`)
      .then((res) => { 
        showSnack(res.data?.message || 'Demande refusée avec succès', 'success'); 
        refetch(); 
      })
      .catch((err) => showSnack(
        err?.response?.data?.message || 'Erreur lors du refus', 'error'
      ))
      .finally(() => {
        setRefuseConfirmOpen(false);
        setCongeToRefuse(null);
      });
  };

  const handleEdit = (c: Conge) => {
      setSelectedConge(c);
    setEditConge(c);
    setFormOpen(true);
  };

  const handleNewRequest = () => {
    setEditConge(null);
    setSelectedConge(null as any);
    setFormOpen(true);
  };

  const handlePrint = async (c: Conge) => {
    try {
      showSnack('Génération du rapport...', 'success');
      const response = await apiInstance.get(`/Conges/get-report/${c.concod}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Conge_${c.concod}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showSnack('Erreur lors de l\'impression', 'error');
    }
  };

  return (
    <Box className="dcm-container">
      {/* Header */}
      <Box className="dcm-header">
        <Box>
          <Typography className="dcm-title">Gestion des Congés</Typography>
          <Typography className="dcm-subtitle">
            Vous avez <strong style={{ color: '#0040a1' }}>{pending.length} demande{pending.length !== 1 ? 's' : ''}</strong> en attente de validation.
          </Typography>
        </Box>
        {canAdd && (
          <Button className="dcm-new-btn" startIcon={<AddIcon />} onClick={handleNewRequest}>
            Nouvelle demande
          </Button>
        )}
      </Box>

      <Box className="dcm-body">
        {/* Left: table */}
        <Box className="dcm-left">
          {/* Table header */}
          <Box className="dcm-table-head">
            <Box className="dcm-th dcm-col-emp">Employé</Box>
            <Box className="dcm-th dcm-col-type">Type</Box>
            <Box className="dcm-th dcm-col-period">Période</Box>
            <Box className="dcm-th dcm-col-status">Statut</Box>
            <Box className="dcm-th dcm-col-actions" style={{ textAlign: 'right' }}>Actions</Box>
          </Box>

          {/* Rows */}
          {isDataLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : !canConsult ? (
            <Box sx={{ textAlign: 'center', py: 6, color: '#ba1a1a' }}>
              <CloseIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
              <Typography>Accès refusé. Vous n'avez pas les droits de consultation.</Typography>
            </Box>
          ) : displayData.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: '#94a3b8' }}>
              <CalendarTodayIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
              <Typography>Aucune demande de congé</Typography>
            </Box>
          ) : (
            <Box className="dcm-rows">
              {displayData.map((c: Conge) => {
                const status = getStatus(c);
                const typeColor = getTypeColor(c.abscod);
                const statusStyle = STATUS_STYLE[status];
                return (
                  <Box key={c.concod} className="dcm-row">
                    {/* Employee */}
                    <Box className="dcm-col-emp dcm-emp-cell">
                      <Avatar className="dcm-avatar">{(c.emplib || c.empcod)?.charAt(0)?.toUpperCase()}</Avatar>
                      <Box>
                        <Typography className="dcm-emp-name">{c.emplib || c.empcod}</Typography>
                        <Typography className="dcm-emp-sub">#{c.concod}</Typography>
                      </Box>
                    </Box>

                    {/* Type */}
                    <Box className="dcm-col-type">
                      <Box className="dcm-type-badge" style={{ backgroundColor: typeColor.bg, color: typeColor.text }}>
                        {(absenceLibs as Record<string, string>)?.[c.abscod] || c.abscod || '—'}
                      </Box>
                    </Box>

                    {/* Period */}
                    <Box className="dcm-col-period">
                      <Typography className="dcm-period-dates">
                        {fmtDate(c.condep)} — {fmtDate(c.conret)}
                      </Typography>
                      <Typography className="dcm-period-days">{c.connbjour} jour{c.connbjour !== 1 ? 's' : ''} ouvrés</Typography>
                    </Box>

                    {/* Status */}
                    <Box className="dcm-col-status">
                      <Box className="dcm-status-badge" style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}>
                        {status}
                      </Box>
                    </Box>

                    {/* Actions */}
                    <Box className="dcm-col-actions dcm-actions">
                      <IconButton size="small" 
                        sx={{ color: '#0040a1', backgroundColor: '#e0e7ff', '&:hover': { backgroundColor: '#c7d2fe' } }} 
                        onClick={() => handlePrint(c)} 
                        title="Imprimer"
                      >
                        <PrintIcon fontSize="small" />
                      </IconButton>
                      {(canModify || (isEmp && c.empcod === uticod && status === 'En attente')) && (
                        <IconButton size="small" className="dcm-action-edit" onClick={() => handleEdit(c)} title="Modifier">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                      {isEmp && c.empcod === uticod && status === 'En attente' && (
                        <IconButton size="small" 
                          sx={{ color: '#ba1a1a', backgroundColor: '#fee2e2', '&:hover': { backgroundColor: '#fecaca' } }} 
                          onClick={() => { setCongeToDelete(c); setDeleteConfirmOpen(true); }} 
                          title="Supprimer ma demande"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                      {status === 'En attente' && c.empcod !== uticod && (
                        <>
                          {canDelete && (
                            <Button size="small" className="dcm-action-refuse" onClick={() => handleRefuseClick(c)} startIcon={<CloseIcon />}>
                              Refuser
                            </Button>
                          )}
                          {canModify && (
                            <Button size="small" className="dcm-action-accept" onClick={() => handleAcceptClick(c)} startIcon={<CheckIcon />}>
                              Valider
                            </Button>
                          )}
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
        <Box className="dcm-sidebar">
          {/* Mini Calendar */}
          <MiniCalendar leaves={displayData} />

          {/* Availability */}
          <Paper className="dcm-avail-card">
            <Typography className="dcm-avail-title">Disponibilité aujourd'hui</Typography>
            <Box className="dcm-avail-row">
              <Typography className="dcm-avail-label">Présents</Typography>
              <Typography className="dcm-avail-count">
                {displayData.length - pending.length} / {displayData.length}
              </Typography>
            </Box>
            <Box className="dcm-avail-bar">
              <Box className="dcm-avail-fill" style={{ width: displayData.length ? `${((displayData.length - pending.length) / displayData.length) * 100}%` : '0%' }} />
            </Box>
          </Paper>

          {/* Quick stats */}
          <Box className="dcm-stats-grid">
            <Paper className="dcm-stat-card">
              <Typography className="dcm-stat-value dcm-stat-primary">{accepted.length}</Typography>
              <Typography className="dcm-stat-label">Validés ce mois</Typography>
            </Paper>
            <Paper className="dcm-stat-card">
              <Typography className="dcm-stat-value dcm-stat-error">{refused.length}</Typography>
              <Typography className="dcm-stat-label">Refusés ce mois</Typography>
            </Paper>
            <Paper className="dcm-stat-card">
              <Typography className="dcm-stat-value dcm-stat-warning">{pending.length}</Typography>
              <Typography className="dcm-stat-label">En attente</Typography>
            </Paper>
            <Paper className="dcm-stat-card">
              <Typography className="dcm-stat-value dcm-stat-primary">{displayData.length}</Typography>
              <Typography className="dcm-stat-label">Total demandes</Typography>
            </Paper>
          </Box>
        </Box>
      </Box>

      {/* Form Dialog */}
      <CongeFormDialog 
        open={formOpen} 
        onClose={() => { setFormOpen(false); refetch(); }} 
        editConge={editConge} 
        onSuccess={() => showSnack(editConge ? 'Demande modifiée avec succès' : 'Demande de congé créée avec succès', 'success')}
      />

      {/* Accept Confirmation Dialog */}
      <Dialog
        open={acceptConfirmOpen}
        onClose={() => setAcceptConfirmOpen(false)}
        PaperProps={{ sx: { borderRadius: '12px', minWidth: '350px' } }}
      >
        <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', color: '#005136' }}>
          Confirmer la validation
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#475569', fontSize: '14px', mt: 1 }}>
            Êtes-vous sûr de vouloir valider la demande de congé
            {congeToAccept ? ` de ${congeToAccept.emplib || congeToAccept.empcod}` : ''} 
            {(congeToAccept && (absenceLibs as Record<string, string>)?.[congeToAccept.abscod]) 
              ? ` (${(absenceLibs as Record<string, string>)[congeToAccept.abscod]})` 
              : ''} ?
          </Typography>
          {congeToAccept && (
            <Box sx={{ mt: 2, p: 1.5, background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <Typography sx={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>
                Du {fmtDate(congeToAccept.condep)} au {fmtDate(congeToAccept.conret)} — {congeToAccept.connbjour} jour{congeToAccept.connbjour !== 1 ? 's' : ''}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAcceptConfirmOpen(false)} sx={{ color: '#64748b', textTransform: 'none' }}>
            Annuler
          </Button>
          <Button onClick={confirmAccept} variant="contained" color="success" sx={{ textTransform: 'none', borderRadius: '8px' }}>
            Oui, Valider
          </Button>
        </DialogActions>
      </Dialog>

      {/* Refuse Confirmation Dialog */}
      <Dialog
        open={refuseConfirmOpen}
        onClose={() => setRefuseConfirmOpen(false)}
        PaperProps={{ sx: { borderRadius: '12px', minWidth: '350px' } }}
      >
        <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', color: '#ba1a1a' }}>
          Confirmer le refus
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#475569', fontSize: '14px', mt: 1 }}>
            Êtes-vous sûr de vouloir refuser la demande de congé 
            {congeToRefuse ? ` de ${congeToRefuse.emplib || congeToRefuse.empcod}` : ''} ?
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: '12px', mt: 2 }}>
            Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRefuseConfirmOpen(false)} sx={{ color: '#64748b', textTransform: 'none' }}>
            Annuler
          </Button>
          <Button onClick={confirmRefuse} variant="contained" color="error" sx={{ textTransform: 'none', borderRadius: '8px' }}>
            Oui, Refuser
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        PaperProps={{ sx: { borderRadius: '12px', minWidth: '350px' } }}
      >
        <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', color: '#ba1a1a' }}>
          Supprimer ma demande
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#475569', fontSize: '14px', mt: 1 }}>
            Êtes-vous sûr de vouloir supprimer votre demande de congé
            {congeToDelete ? ` (${congeToDelete.concod})` : ''} ?
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: '12px', mt: 2 }}>
            Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} sx={{ color: '#64748b', textTransform: 'none' }}>
            Annuler
          </Button>
          <Button 
            onClick={() => {
              if (!congeToDelete) return;
              deleteMutation.mutate(
                { soccod: congeToDelete.soccod, concod: congeToDelete.concod },
                {
                  onSuccess: () => { showSnack('Demande supprimée avec succès', 'success'); refetch(); },
                  onError: () => showSnack('Erreur lors de la suppression', 'error'),
                }
              );
              setDeleteConfirmOpen(false);
              setCongeToDelete(null);
            }}
            variant="contained" color="error" 
            disabled={deleteMutation.isLoading}
            startIcon={deleteMutation.isLoading ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon />}
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
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

const DemCongeModern = () => (
  <CongeProvider>
    <DemCongeModernInner />
  </CongeProvider>
);

export default DemCongeModern;
