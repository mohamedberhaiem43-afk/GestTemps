import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../../helper/AuthProvider';
import {
  Box, Typography, Paper, Button, CircularProgress,
  Avatar, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Snackbar, Alert, Divider,
  TextField, FormControl, Select, MenuItem
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import { useTranslation, Trans } from 'react-i18next';
import { CongeProvider, useCongeContext } from '../../../helper/CongeContext';
import '../DemConge/DemCongeModern.css';
import { Conge } from '../../../../models/Conge';
import CongeReportService from '../../../../services/CongeService/CongeReportService';
import useDeleteTitreConge from '../../../../hooks/congeHooks/useDeleteTitreConge';
import useGetTitreConge from '../../../../hooks/congeHooks/useGetTitreConge';
import useGetCongeAbsenceLibs from '../../../../hooks/absenceHooks/useGetCongeAbsenceLibs';
import useGetEmployee from '../../../../hooks/employeHooks/useGetEmployee';
import useAddConge from '../../../../hooks/congeHooks/useAddConge';
import useUpdateTitreConge from '../../../../hooks/congeHooks/useUpdateTitreConge';
import useGetDroitConge from '../../../../hooks/congeHooks/useGetDroitConge';
import { getDatePartFromDate } from '../../../helper/TimeConverter/ExtractDateOnly';
import apiInstance from '../../../API/apiInstance';

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

// ── Modern Form Dialog (from DemCongeModern) ──────────────────────────────────
function CongeFormDialog({ open, onClose, editConge, onSuccess, onError }: { open: boolean; onClose: () => void; editConge: Conge | null; onSuccess?: () => void; onError?: (err: any) => void }) {
  const { t } = useTranslation();
  const { soccod } = useAuth();
  const { data: absences = [] } = useGetCongeAbsenceLibs();
  const { data: employeOptions = [] } = useGetEmployee();
  const { mutate: addConge, isPending: adding } = useAddConge();
  const { mutate: updateConge, isPending: updating } = useUpdateTitreConge();

  const [empcod, setEmpcod] = useState('');
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

  // Balance logic — le solde dépend du TYPE de congé sélectionné : on dérive le
  // typeConge ("rtt" si la nature porte Abscng="R", sinon "paye"/CP) à partir de
  // l'imputation choisie, pour que le backend renvoie le bon droit (CP vs RTT).
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const yearEnd = `${new Date().getFullYear()}-12-31`;
  const selectedAbs = (absences as any[]).find((a) => a.abscod === abscod);
  const typeConge = selectedAbs?.abscng === 'R' ? 'rtt' : 'paye';
  const { data: droitCongeData } = useGetDroitConge(empcod, yearStart, yearEnd, typeConge);
  const droitConge = Array.isArray(droitCongeData) ? droitCongeData[0] : droitCongeData;
  const soldeAnterieur = (droitConge as any)?.soldeinit ?? (droitConge as any)?.Soldeinit ?? 0;
  const droitRestant = (droitConge as any)?.droitrestant ?? (droitConge as any)?.Droitrestant ?? 0;
  const nouveauSolde = Math.max(0, droitRestant - connbjour);

  // Auto-fill phone when employee is selected
  useEffect(() => {
    if (empcod && !editConge) {
      const empList = Object.entries(employeOptions);
      const emp = empList.find(([k]) => k === empcod);
      if (emp) {
        // Fetch employee details to get phone
        apiInstance.get(`/Employes/${empcod}`).then((res) => {
          const tel = res.data?.emptel || res.data?.empmob || '';
          if (tel) setContel(tel);
        }).catch(() => {});
      }
    }
  }, [empcod, employeOptions, editConge]);

  // Set default type de congé when absences load
  useEffect(() => {
    if (!editConge && open && absences.length > 0 && !abscod) {
      // `absences` est un TABLEAU [{abscod, abslib, abscng}] (useGetCongeAbsenceLibs),
      // pas un dictionnaire : on prend l'abscod du 1er élément, pas l'index "0".
      setAbscod(absences[0]?.abscod ?? '');
    }
  }, [open, editConge, absences, abscod]);

  // Fetch next concod from database when form opens in add mode
  useEffect(() => {
    if (!editConge && open && soccod) {
      apiInstance.get(`/Conges/get-next-concod/${soccod}`)
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
      setEmpcod('');
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
        if (onSuccess) onSuccess();
        onClose();
      },
      // FIX : avant on avalait silencieusement les erreurs d'API → l'utilisateur
      // cliquait "Enregistrer", rien ne se passait visuellement et il pensait que
      // ça avait marché. On remonte maintenant l'erreur au parent qui affiche un
      // snackbar avec le message serveur.
      onError: (err: any) => {
        if (onError) onError(err);
      },
    };
    editConge ? updateConge(payload, cb) : addConge(payload, cb);
  };

  const isBusy = adding || updating;
  const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '8px', backgroundColor: '#f8fafc', '& fieldset': { borderColor: '#e2e8f0' } } };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', pb: 1 }}>
        {editConge ? t('conge.titreConge.form.titleEdit') : t('conge.titreConge.form.titleAdd')}
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

        <Box>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>{t('conge.titreConge.form.employee')}</Typography>
          <FormControl fullWidth size="small">
            <Select value={empcod} onChange={(e) => setEmpcod(e.target.value)} sx={{ borderRadius: '8px', backgroundColor: '#f8fafc', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' } }}>
              {Object.entries(employeOptions).map(([k, v]) => <MenuItem key={k} value={k}>{String(v)}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        <Box>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>{t('conge.titreConge.form.imputation')}</Typography>
          <FormControl fullWidth size="small">
            <Select value={abscod} onChange={(e) => setAbscod(e.target.value)} sx={{ borderRadius: '8px', backgroundColor: '#f8fafc', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' } }}>
              {/* `absences` = tableau [{abscod, abslib}] → on mappe sur les objets,
                  sinon Object.entries renvoyait (index, objet) → value=index et
                  libellé "[object Object]". */}
              {(absences as any[]).map((a) => <MenuItem key={a.abscod} value={a.abscod}>{a.abslib}</MenuItem>)}
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
          startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)' }}>
          {editConge ? t('conge.titreConge.form.save') : t('conge.titreConge.form.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TitreCongeInner() {
  const { t } = useTranslation();
  const { data: globalData = [], isLoading, refetch } = useGetTitreConge();
  const { data: absenceLibs = [] } = useGetCongeAbsenceLibs();
  const { setSelectedConge } = useCongeContext();
  const { mutate: deleteConge } = useDeleteTitreConge();
  const { hasPermission } = useAuth();

  const canAdd = hasPermission('Gestion des Congés', 'add');
  const canModify = hasPermission('Gestion des Congés', 'modify');
  const canDelete = hasPermission('Gestion des Congés', 'delete');
  const canConsult = hasPermission('Gestion des Congés', 'consult');

  const sortedData = useMemo(() => {
    return [...globalData].sort((a, b) => {
      if (!a.condat || !b.condat) return 0;
      return new Date(b.condat).getTime() - new Date(a.condat).getTime();
    });
  }, [globalData]);

  // Filtres : recherche libre, type d'absence, plage de dates (recouvrement avec
  // [condep, conret]). Pas de filtre "statut" ici — un titre de congé représente
  // un congé déjà émis, il n'y a pas d'état pending/refused à distinguer.
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const data = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() : null;
    return sortedData.filter((c: Conge) => {
      if (typeFilter && c.abscod !== typeFilter) return false;
      if (q) {
        const hay = `${c.emplib ?? ''} ${c.empcod ?? ''} ${c.concod ?? ''} ${c.conref ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (from !== null || to !== null) {
        const dep = c.condep ? new Date(c.condep).getTime() : null;
        const ret = c.conret ? new Date(c.conret).getTime() : dep;
        if (dep === null) return false;
        if (from !== null && ret !== null && ret < from) return false;
        if (to !== null && dep > to) return false;
      }
      return true;
    });
  }, [sortedData, searchQuery, typeFilter, dateFrom, dateTo]);

  const hasActiveFilter = searchQuery !== '' || typeFilter !== '' || dateFrom !== '' || dateTo !== '';
  const resetFilters = () => {
    setSearchQuery(''); setTypeFilter(''); setDateFrom(''); setDateTo('');
    setCurrentPage(1);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE) || 1;
  const paginatedData = useMemo(() => {
    const begin = (currentPage - 1) * ITEMS_PER_PAGE;
    return data.slice(begin, begin + ITEMS_PER_PAGE);
  }, [currentPage, data]);

  // Reset page when filters narrow result set below current page
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

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
      <Box className="dcm-header">
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
             <Avatar sx={{ bgcolor: '#f1f5f9', color: '#1e293b' }}>
                <CalendarTodayIcon />
             </Avatar>
             <Typography className="dcm-title">{t('conge.titreConge.title')}</Typography>
          </Box>
          <Typography className="dcm-subtitle">
            <Trans
              i18nKey="conge.titreConge.subtitle"
              count={sortedData.length}
              components={{ 0: <strong style={{ color: '#0040a1' }} /> }}
            />
          </Typography>
        </Box>
        {canAdd && (
          <Button className="dcm-new-btn" startIcon={<AddIcon />} onClick={handleNewRequest}>
            {t('conge.titreConge.newButton')}
          </Button>
        )}
      </Box>

      <Box className="dcm-body">
        <Box className="dcm-left" sx={{ display: 'flex', flexDirection: 'column' }}>
          {/* Filter toolbar (search + type + date range + reset) */}
          <Box sx={{
            display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center',
            p: '10px 12px', mb: 1.5,
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px',
          }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
              px: 1.25, height: 34, flex: '1 1 220px', minWidth: 180,
            }}>
              <SearchIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder={t('conge.titreConge.filters.searchPlaceholder')}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', flex: 1, color: '#0f172a' }}
              />
            </Box>

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <Select
                value={typeFilter}
                onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                displayEmpty
                sx={{ height: 34, fontSize: '13px', background: '#fff', borderRadius: '8px' }}
              >
                <MenuItem value=""><em>{t('conge.titreConge.filters.typeAll')}</em></MenuItem>
                {/* absenceLibs = tableau [{abscod, abslib}] (useGetCongeAbsenceLibs) :
                    on mappe les objets, pas Object.entries (qui donnait index→[object Object]). */}
                {(absenceLibs as any[]).map((a) => (
                  <MenuItem key={a.abscod} value={a.abscod}>{a.abslib}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              type="date" size="small" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }}
              label={t('conge.titreConge.filters.from')}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 150, '& .MuiInputBase-root': { height: 34, background: '#fff', borderRadius: '8px', fontSize: '12px' } }}
            />
            <TextField
              type="date" size="small" value={dateTo}
              onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }}
              label={t('conge.titreConge.filters.to')}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 150, '& .MuiInputBase-root': { height: 34, background: '#fff', borderRadius: '8px', fontSize: '12px' } }}
            />

            {hasActiveFilter && (
              <IconButton size="small" onClick={resetFilters} title={t('conge.titreConge.filters.reset')} sx={{ color: '#64748b' }}>
                <FilterAltOffIcon fontSize="small" />
              </IconButton>
            )}
          </Box>

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
              <Typography>{hasActiveFilter ? t('conge.titreConge.noFilterResult') : t('conge.titreConge.noData')}</Typography>
              {hasActiveFilter && (
                <Button size="small" onClick={resetFilters} sx={{ mt: 1, textTransform: 'none', color: '#0040a1' }}>
                  {t('conge.titreConge.filters.reset')}
                </Button>
              )}
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
          <MiniCalendar leaves={sortedData} />
          <Paper className="dcm-stat-card" sx={{ mt: 2 }}>
            <Typography className="dcm-stat-value dcm-stat-primary">{sortedData.length}</Typography>
            <Typography className="dcm-stat-label">{t('conge.titreConge.stat.totalEmitted')}</Typography>
          </Paper>
        </Box>
      </Box>

      {/* Modern Form Dialog replacing the old SaisieTitreConge */}
      <CongeFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); refetch(); }}
        editConge={editConge}
        onSuccess={() => showSnack(editConge ? t('conge.titreConge.msg.updatedSuccess') : t('conge.titreConge.msg.createdSuccess'), 'success')}
        onError={(err) => {
          const serverMsg = err?.response?.data?.message
            ?? err?.response?.data?.title
            ?? err?.message;
          const fallback = editConge ? t('conge.titreConge.msg.updateError') : t('conge.titreConge.msg.createError');
          showSnack(serverMsg ? `${fallback} — ${serverMsg}` : fallback, 'error');
        }}
      />

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

const TitreConge = () => {
  return (
    <CongeProvider>
        <TitreCongeInner />
      </CongeProvider>
  );
};

export default TitreConge;
