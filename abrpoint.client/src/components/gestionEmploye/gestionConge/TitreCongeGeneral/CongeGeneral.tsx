import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../../helper/AuthProvider';
import {
  Box, Typography, Paper, Button, CircularProgress,
  Avatar, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Snackbar, Alert, Divider,
  TextField, FormControl, Select, MenuItem,
  Checkbox, List, ListItem, ListItemButton, ListItemText,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SaveIcon from '@mui/icons-material/Save';
import PeopleIcon from '@mui/icons-material/People';
import GavelIcon from '@mui/icons-material/Gavel';
import { useTranslation, Trans } from 'react-i18next';
import { CongeProvider, useCongeContext } from '../../../helper/CongeContext';
import '../DemConge/DemCongeModern.css';
import { Conge } from '../../../../models/Conge';
import CongeReportService from '../../../../services/CongeService/CongeReportService';
import useDeleteTitreConge from '../../../../hooks/congeHooks/useDeleteTitreConge';
import useGetTitreConge from '../../../../hooks/congeHooks/useGetTitreConge';
import useGetAbsencesLibs from '../../../../hooks/absenceHooks/useGetAbsenceLibs';
import useGetEmployee from '../../../../hooks/employeHooks/useGetEmployee';
import useAddConge from '../../../../hooks/congeHooks/useAddConge';
import useAddBulkConges from '../../../../hooks/congeHooks/useAddBulkConges';
import useUpdateTitreConge from '../../../../hooks/congeHooks/useUpdateTitreConge';
import useGetDroitConge from '../../../../hooks/congeHooks/useGetDroitConge';
import { getDatePartFromDate } from '../../../helper/TimeConverter/ExtractDateOnly';
import generateNumeroOrdre from '../../../helper/GenerateNumOrdre';
import { toOptionMap } from '../../../helper/selectOptions';
import { SearchIcon } from 'lucide-react';

const ITEMS_PER_PAGE = 10;
const today = () => new Date().toISOString().split('T')[0];

const getTypeColor = (abscod: string) => {
  const k = abscod?.toLowerCase() ?? '';
  if (k.includes('mal')) return { bg: 'rgba(186,26,26,0.12)', text: '#ba1a1a' };
  if (k.includes('rtt')) return { bg: 'rgba(0,81,54,0.12)', text: '#005136' };
  return { bg: 'rgba(0,64,161,0.1)', text: '#0040a1' };
};

const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); }
  catch { return '—'; }
};

// ── Mini Calendar ─────────────────────────────────────────────────────────────
function MiniCalendar({ leaves }: { leaves: Conge[] }) {
  const { i18n } = useTranslation();
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

  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'fr-FR';
  const monthName = current.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const dowLabels = locale === 'en-US'
    ? ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
    : ['LU', 'MA', 'ME', 'JE', 'VE', 'SA', 'DI'];
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
        {dowLabels.map((d) => (
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

// ── Modern Form Dialog (Bulk support) ──────────────────────────────────
function CongeFormDialog({ open, onClose, editConge, isBulk }: { open: boolean; onClose: () => void; editConge: Conge | null; isBulk?: boolean }) {
  const { t } = useTranslation();
  const { soccod } = useAuth();
  const { data: absencesRaw = [] } = useGetAbsencesLibs();
  const { data: employeRaw = [] } = useGetEmployee();
  // Normalise en dictionnaire { code: libellé } quelle que soit la forme renvoyée par l'API
  // (dict, $values, tableau d'objets…). Sans ça les <Select> affichaient « [object Object] »
  // et la valeur pré-sélectionnée à l'édition ne matchait aucune option.
  const absences = useMemo(() => toOptionMap(absencesRaw), [absencesRaw]);
  const employeOptions = useMemo(() => toOptionMap(employeRaw), [employeRaw]);
  const { mutate: addConge, isPending: adding } = useAddConge();
  const { mutate: addBulkConges, isPending: bulkAdding } = useAddBulkConges();
  const { mutate: updateConge, isPending: updating } = useUpdateTitreConge();

  const [empcod, setEmpcod] = useState('');
  const [concod, setConcod] = useState(generateNumeroOrdre());
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
  
  // Bulk state
  const [checkedEmployees, setCheckedEmployees] = useState<Set<string>>(new Set());
  const [showExceptions, setShowExceptions] = useState(false);
  const [empSearch, setEmpSearch] = useState('');

  // Balance logic
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const yearEnd = `${new Date().getFullYear()}-12-31`;
  const { data: droitCongeData } = useGetDroitConge(empcod, yearStart, yearEnd);
  const droitConge = Array.isArray(droitCongeData) ? droitCongeData[0] : droitCongeData;
  const soldeAnterieur = (droitConge as any)?.soldeinit ?? (droitConge as any)?.Soldeinit ?? 0;
  const droitRestant = (droitConge as any)?.droitrestant ?? (droitConge as any)?.Droitrestant ?? 0;
  const nouveauSolde = Math.max(0, droitRestant - connbjour);

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
      setEmpcod('');
      setConcod(generateNumeroOrdre());
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
      setCheckedEmployees(new Set());
      setShowExceptions(false);
    }
  }, [editConge, open]);

  useEffect(() => {
    if (!condep || !conret) { setConnbjour(0); return; }
    const diff = (new Date(conret).getTime() - new Date(condep).getTime()) / 86400000;
    setConnbjour(Math.max(0, diff + (conamret ? 0.5 : 0) - (conamdep ? 0.5 : 0)));
  }, [condep, conret, conamdep, conamret]);

  const handleSubmit = () => {
    if (isBulk) {
       // Bulk mode: exclude exceptions
       const employeList = Object.entries(employeOptions).map(([code, lib]) => ({ empcod: code, emplib: String(lib) }));
       const targets = employeList.filter(e => !checkedEmployees.has(e.empcod));
       
       if (targets.length === 0) return;

       const payload: Conge[] = targets.map(e => ({
          soccod: soccod || '',
          empcod: e.empcod,
          concod: generateNumeroOrdre() + Math.random().toString(36).substring(2, 5).toUpperCase(),
          condat: condat ? new Date(condat) : null,
          condep: condep ? new Date(condep) : null,
          conret: conret ? new Date(conret) : null,
          conamdep: conamdep ? '1' : '0',
          conamret: conamret ? '1' : '0',
          abscod, conadr, contel, conref, connbjour,
          conjour: 'J', emplib: null, condg: '', conrefus: '', consolde: 0,
       }));

       addBulkConges(payload, { 
          onSuccess: () => { onClose(); },
          onError: () => { console.error("Bulk error"); }
       });
    } else {
       // Individual mode
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
       const cb = { onSuccess: () => { onClose(); }, onError: () => {} };
       editConge ? updateConge(payload, cb) : addConge(payload, cb);
    }
  };

  const isBusy = adding || updating || bulkAdding;
  const filteredEmployees = useMemo(() => {
     if (!empSearch) return Object.entries(employeOptions);
     const q = empSearch.toLowerCase();
     return Object.entries(employeOptions).filter(([k,v]) => k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q));
  }, [employeOptions, empSearch]);

  const toggleException = (code: string) => {
     const next = new Set(checkedEmployees);
     if (next.has(code)) next.delete(code); else next.add(code);
     setCheckedEmployees(next);
  };
  const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '8px', backgroundColor: '#f8fafc', '& fieldset': { borderColor: '#e2e8f0' } } };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', pb: 1 }}>
        {editConge ? t('conge.congeGeneral.form.titleEdit') : t('conge.congeGeneral.form.titleAdd')}
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>{t('conge.titreConge.form.orderNo')}</Typography>
            <TextField size="small" fullWidth value={concod} onChange={(e) => setConcod(e.target.value)} InputProps={{ readOnly: !!editConge }} sx={fieldSx} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>{t('conge.titreConge.form.dateTitre')}</Typography>
            <TextField size="small" fullWidth type="date" value={condat} onChange={(e) => setCondat(e.target.value)} sx={fieldSx} />
          </Box>
        </Box>

        {!isBulk && (
           <Box>
             <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>{t('conge.titreConge.form.employee')}</Typography>
             <FormControl fullWidth size="small">
               <Select value={empcod} onChange={(e) => setEmpcod(e.target.value)} sx={{ borderRadius: '8px', backgroundColor: '#f8fafc', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' } }}>
                 {Object.entries(employeOptions).map(([k, v]) => <MenuItem key={k} value={k}>{String(v)}</MenuItem>)}
               </Select>
             </FormControl>
           </Box>
        )}

        {isBulk && (
            <Box sx={{ border: '1px dashed #cbd5e1', borderRadius: '12px', bgcolor: '#f8fafc', p: 1.5 }}>
               <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: showExceptions ? 1.5 : 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                     <PeopleIcon sx={{ color: '#64748b', fontSize: 20 }} />
                     <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>{t('conge.congeGeneral.form.exceptionsTitle', { count: checkedEmployees.size })}</Typography>
                        <Typography sx={{ fontSize: '11px', color: '#64748b' }}>{t('conge.congeGeneral.form.exceptionsSubtitle')}</Typography>
                     </Box>
                  </Box>
                  <Button size="small" variant="outlined" onClick={() => setShowExceptions(!showExceptions)} sx={{ borderRadius: '6px', textTransform: 'none', fontSize: '12px' }}>
                     {showExceptions ? t('conge.congeGeneral.form.hide') : t('conge.congeGeneral.form.manage')}
                  </Button>
               </Box>

               {showExceptions && (
                  <Box sx={{ mt: 1 }}>
                     <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#fff', px: 1, borderRadius: '6px', border: '1px solid #e2e8f0', mb: 1 }}>
                        <SearchIcon size={16} color="#94a3b8" />
                        <input
                           type="text" placeholder={t('conge.congeGeneral.form.search')}
                           value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                           style={{ border: 'none', padding: '6px', fontSize: '13px', outline: 'none', width: '100%' }}
                        />
                     </Box>
                     <Box sx={{ maxHeight: '180px', overflowY: 'auto', bgcolor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <List dense>
                           {filteredEmployees.map(([k,v]) => (
                              <ListItem key={k} disablePadding divider>
                                 <ListItemButton onClick={() => toggleException(k)} sx={{ py: 0.5 }}>
                                    <Checkbox size="small" checked={checkedEmployees.has(k)} disableRipple />
                                    <ListItemText 
                                       primary={String(v)} secondary={k} 
                                       primaryTypographyProps={{ fontSize: '12px', fontWeight: 600 }}
                                       secondaryTypographyProps={{ fontSize: '10px' }}
                                    />
                                 </ListItemButton>
                              </ListItem>
                           ))}
                        </List>
                     </Box>
                  </Box>
               )}
            </Box>
        )}

        <Box>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>{t('conge.titreConge.form.imputation')}</Typography>
          <FormControl fullWidth size="small">
            <Select value={abscod} onChange={(e) => setAbscod(e.target.value)} sx={{ borderRadius: '8px', backgroundColor: '#f8fafc', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' } }}>
              {Object.entries(absences).map(([k, v]) => <MenuItem key={k} value={k}>{String(v)}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto auto', gap: 1.5, alignItems: 'end' }}>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>{t('conge.titreConge.form.departureDate')}</Typography>
            <TextField size="small" fullWidth type="date" value={condep} onChange={(e) => setCondep(e.target.value)} sx={fieldSx} />
          </Box>
          <Box sx={{ pb: 0.5 }}>
            <Typography sx={{ fontSize: '10px', color: '#94a3b8', mb: 0.5 }}>{t('conge.titreConge.form.am')}</Typography>
            <input type="checkbox" checked={conamdep} onChange={(e) => setConamdep(e.target.checked)} style={{ width: 16, height: 16 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>{t('conge.titreConge.form.returnDate')}</Typography>
            <TextField size="small" fullWidth type="date" value={conret} onChange={(e) => setConret(e.target.value)} sx={fieldSx} />
          </Box>
          <Box sx={{ pb: 0.5 }}>
            <Typography sx={{ fontSize: '10px', color: '#94a3b8', mb: 0.5 }}>{t('conge.titreConge.form.am')}</Typography>
            <input type="checkbox" checked={conamret} onChange={(e) => setConamret(e.target.checked)} style={{ width: 16, height: 16 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#0040a1', textTransform: 'uppercase', mb: 0.5 }}>{t('conge.titreConge.form.days')}</Typography>
            <TextField size="small" value={connbjour} InputProps={{ readOnly: true }} sx={{ width: 64, '& .MuiOutlinedInput-root': { borderRadius: '8px', backgroundColor: '#eff6ff', '& fieldset': { borderColor: '#bfdbfe' }, '& input': { color: '#0040a1', fontWeight: 700, textAlign: 'center' } } }} />
          </Box>
        </Box>

        {empcod && droitConge && (
            <Box sx={{ background: 'linear-gradient(135deg, #f0f5ff 0%, #e8f0fe 100%)', borderRadius: '12px', p: 2, border: '1px solid #bfdbfe' }}>
              <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#0040a1', mb: 1.5, textTransform: 'uppercase' }}>{t('conge.titreConge.form.balanceTitle')}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <Box sx={{ background: '#fff', borderRadius: '8px', p: 1, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '9px', fontWeight: 700, color: '#64748b' }}>{t('conge.titreConge.form.balancePrev')}</Typography>
                  <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#0040a1' }}>{soldeAnterieur}</Typography>
                </Box>
                <Box sx={{ background: '#fff', borderRadius: '8px', p: 1, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '9px', fontWeight: 700, color: '#64748b' }}>{t('conge.titreConge.form.balanceCurrent')}</Typography>
                  <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#7c3aed' }}>{droitRestant}</Typography>
                </Box>
                <Box sx={{ background: '#fff', borderRadius: '8px', p: 1, textAlign: 'center', gridColumn: 'span 2', border: connbjour > 0 ? '1px dashed #059669' : 'none' }}>
                  <Typography sx={{ fontSize: '9px', fontWeight: 700, color: '#64748b' }}>{t('conge.titreConge.form.balanceNew')}</Typography>
                  <Typography sx={{ fontSize: '18px', fontWeight: 800, color: nouveauSolde < 0 ? '#ba1a1a' : '#059669' }}>{t('conge.titreConge.form.balanceNewDays', { count: nouveauSolde })}</Typography>
                </Box>
              </Box>
            </Box>
        )}

        <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>{t('conge.titreConge.form.ref')}</Typography>
            <TextField size="small" fullWidth value={conref} onChange={(e) => setConref(e.target.value)} sx={fieldSx} />
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: '8px', textTransform: 'none', color: '#64748b' }}>{t('conge.titreConge.form.cancel')}</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isBusy}
          startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : isBulk ? <GavelIcon /> : <SaveIcon />}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)' }}>
          {editConge ? t('conge.titreConge.form.save') : isBulk ? t('conge.congeGeneral.form.submitBulk') : t('conge.congeGeneral.form.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CongeGeneralInner() {
  const { t } = useTranslation();
  const { data: globalData = [], isLoading, refetch } = useGetTitreConge();
  const { setSelectedConge } = useCongeContext();
  const { mutate: deleteConge } = useDeleteTitreConge();
  const { hasPermission } = useAuth();

  const canAdd = hasPermission('Gestion des Congés', 'add');
  const canModify = hasPermission('Gestion des Congés', 'modify');
  const canDelete = hasPermission('Gestion des Congés', 'delete');
  const canConsult = hasPermission('Gestion des Congés', 'consult');

  const data = useMemo(() => {
    return [...globalData].sort((a, b) => {
      if (!a.condat || !b.condat) return 0;
      return new Date(b.condat).getTime() - new Date(a.condat).getTime();
    });
  }, [globalData]);

  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE) || 1;
  const paginatedData = useMemo(() => {
    const begin = (currentPage - 1) * ITEMS_PER_PAGE;
    return data.slice(begin, begin + ITEMS_PER_PAGE);
  }, [currentPage, data]);

  const [formOpen, setFormOpen] = useState(false);
  const [editConge, setEditConge] = useState<Conge | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [congeToDelete, setCongeToDelete] = useState<Conge | null>(null);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const showSnack = (message: string, severity: 'success' | 'error') => setSnackbar({ open: true, message, severity });

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

  const requestDelete = (c: Conge) => {
    setCongeToDelete(c);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (congeToDelete) {
      deleteConge(congeToDelete, {
        onSuccess: () => {
          showSnack(t('conge.titreConge.msg.deletedSuccess'), 'success');
          refetch();
          setDeleteConfirmOpen(false);
        },
        onError: () => {
          showSnack(t('conge.titreConge.msg.deleteError'), 'error');
          setDeleteConfirmOpen(false);
        }
      });
    }
  };

  const handlePrint = async (c: Conge) => {
    try {
      showSnack(t('conge.titreConge.msg.generatingReport'), 'success');
      const response = await CongeReportService.getReport(`get-report/${c.concod}`, 'blob');
      const blob = new Blob([response as any], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Conge_${c.concod}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showSnack(t('conge.titreConge.msg.downloadError'), 'error');
    }
  };

  return (
    <Box className="dcm-container">
      {/* Header */}
      <Box className="dcm-header">
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
             <Avatar sx={{ bgcolor: 'rgba(0,64,161,0.08)', color: '#0040a1' }}>
                <PeopleIcon />
             </Avatar>
             <Typography className="dcm-title">{t('conge.congeGeneral.title')}</Typography>
          </Box>
          <Typography className="dcm-subtitle">
            <Trans
              i18nKey="conge.congeGeneral.subtitle"
              values={{ count: data.length }}
              components={{ 0: <strong style={{ color: '#0040a1' }} /> }}
            />
          </Typography>
        </Box>
        {canAdd && (
          <Button className="dcm-new-btn" startIcon={<GavelIcon />} onClick={handleNewRequest}>
             {t('conge.congeGeneral.bulkButton')}
          </Button>
        )}
      </Box>

      <Box className="dcm-body">
        <Box className="dcm-left" sx={{ display: 'flex', flexDirection: 'column' }}>
          <Box className="dcm-table-head">
            <Box className="dcm-th dcm-col-emp">{t('conge.titreConge.headers.employee')}</Box>
            <Box className="dcm-th dcm-col-type">{t('conge.titreConge.headers.type')}</Box>
            <Box className="dcm-th dcm-col-period">{t('conge.titreConge.headers.period')}</Box>
            <Box className="dcm-th dcm-col-status">{t('conge.titreConge.headers.orderNo')}</Box>
            <Box className="dcm-th dcm-col-actions" style={{ textAlign: 'right' }}>{t('conge.titreConge.headers.actions')}</Box>
          </Box>

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : !canConsult ? (
            <Box sx={{ textAlign: 'center', py: 6, color: '#ba1a1a' }}>
              <AddIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4, transform: 'rotate(45deg)' }} />
              <Typography>{t('conge.titreConge.noConsult')}</Typography>
            </Box>
          ) : data.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: '#94a3b8' }}>
              <CalendarTodayIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
              <Typography>{t('conge.titreConge.noData')}</Typography>
            </Box>
          ) : (
            <>
              <Box className="dcm-rows" sx={{ flexGrow: 1 }}>
                {paginatedData.map((c: Conge) => {
                  const typeColor = getTypeColor(c.abscod);
                  return (
                    <Box key={c.concod} className="dcm-row">
                      <Box className="dcm-col-emp dcm-emp-cell">
                        <Avatar className="dcm-avatar">{(c.emplib || c.empcod)?.charAt(0)?.toUpperCase()}</Avatar>
                        <Box>
                          <Typography className="dcm-emp-name">{c.emplib || c.empcod}</Typography>
                        </Box>
                      </Box>

                      <Box className="dcm-col-type">
                        <Box className="dcm-type-badge" style={{ backgroundColor: typeColor.bg, color: typeColor.text }}>
                          {c.abscod || '—'}
                        </Box>
                      </Box>

                      <Box className="dcm-col-period">
                        <Typography className="dcm-period-dates">
                          {fmtDate(c.condep)} — {fmtDate(c.conret)}
                        </Typography>
                        <Typography className="dcm-period-days">{t('conge.titreConge.days', { count: c.connbjour })}</Typography>
                      </Box>

                      <Box className="dcm-col-status">
                        <Typography sx={{ fontWeight: 700, color: '#475569', fontSize: '13px' }}>#{c.concod}</Typography>
                      </Box>

                      <Box className="dcm-col-actions dcm-actions" sx={{ gap: 1 }}>
                        <IconButton size="small" onClick={() => handlePrint(c)} title={t('conge.titreConge.actions.print')} sx={{ color: '#0040a1', backgroundColor: '#e0e7ff', '&:hover': { backgroundColor: '#c7d2fe' } }}>
                          <PrintIcon fontSize="small" />
                        </IconButton>
                        {canModify && (
                          <IconButton size="small" onClick={() => handleEdit(c)} title={t('conge.titreConge.actions.edit')} sx={{ color: '#16a34a', backgroundColor: '#dcfce7', '&:hover': { backgroundColor: '#bbf7d0' } }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        )}
                        {canDelete && (
                          <IconButton size="small" onClick={() => requestDelete(c)} title={t('conge.titreConge.actions.delete')} sx={{ color: '#dc2626', backgroundColor: '#fee2e2', '&:hover': { backgroundColor: '#fecaca' } }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>

              {data.length > 0 && (
                <Box sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  py: 1.5, px: 3, borderTop: '1px solid #f1f5f9', background: '#f8fafc',
                  borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px'
                }}>
                  <Typography sx={{ fontSize: '13px', color: '#64748b' }}>
                    <Trans
                      i18nKey="conge.titreConge.pagination.showing"
                      values={{
                        from: (currentPage - 1) * ITEMS_PER_PAGE + 1,
                        to: Math.min(currentPage * ITEMS_PER_PAGE, data.length),
                        total: data.length
                      }}
                      components={{ 0: <strong style={{ color: '#1e293b' }} />, 1: <strong style={{ color: '#1e293b' }} />, 2: <strong style={{ color: '#1e293b' }} /> }}
                    />
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small" variant="outlined"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      sx={{ minWidth: '40px', padding: '4px', borderColor: '#e2e8f0', color: '#475569' }}
                    >
                      <ChevronLeftIcon />
                    </Button>
                    <Button
                      size="small" variant="outlined"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      sx={{ minWidth: '40px', padding: '4px', borderColor: '#e2e8f0', color: '#475569' }}
                    >
                      <ChevronRightIcon />
                    </Button>
                  </Box>
                </Box>
              )}
            </>
          )}
        </Box>

        <Box className="dcm-sidebar">
          <MiniCalendar leaves={data} />
          <Paper className="dcm-stat-card" sx={{ mt: 2 }}>
            <Typography className="dcm-stat-value dcm-stat-primary">{data.length}</Typography>
            <Typography className="dcm-stat-label">{t('conge.titreConge.stat.totalEmitted')}</Typography>
          </Paper>
        </Box>
      </Box>

      {/* Modern Form Dialog replacing the old SaisieTitreConge */}
      <CongeFormDialog open={formOpen} onClose={() => { setFormOpen(false); refetch(); }} editConge={editConge} isBulk={!editConge} />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} PaperProps={{ sx: { borderRadius: '12px', minWidth: '350px' } }}>
        <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', color: '#dc2626' }}>
          {t('conge.titreConge.delete.title')}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#475569', fontSize: '14px', mt: 1 }}>{t('conge.titreConge.delete.message', { order: congeToDelete?.concod ?? '' })}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} sx={{ color: '#64748b', textTransform: 'none' }}>{t('conge.titreConge.delete.cancel')}</Button>
          <Button onClick={confirmDelete} variant="contained" color="error" sx={{ textTransform: 'none', borderRadius: '8px' }}>{t('conge.titreConge.delete.confirm')}</Button>
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

const CongeGeneral = () => {
  return (
    <CongeProvider>
        <CongeGeneralInner />
      </CongeProvider>
  );
};

export default CongeGeneral;
