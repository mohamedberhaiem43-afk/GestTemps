import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress,
  TablePagination, IconButton, Avatar, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, Select, MenuItem, TextField,
  Tooltip,
} from '@mui/material';
import { useFeedbackSnackbar, extractErrorMessage } from '../../../../helper/FeedbackSnackbar';
import { LocalizationProvider, DatePicker, TimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import duration from 'dayjs/plugin/duration';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/FileUpload';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import EventNoteIcon from '@mui/icons-material/EventNote';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTranslation, Trans } from 'react-i18next';
import useGetAbsencesLibs from '../../../../../hooks/absenceHooks/useGetAbsenceLibs';
import useGetEmployee from '../../../../../hooks/employeHooks/useGetEmployee';
import useAddSortie from '../../../../../hooks/sortieHooks/useAddSortie';
import useGetAllSorties from '../../../../../hooks/sortieHooks/useGetAllSorties';
import useDeleteSortie from '../../../../../hooks/sortieHooks/useDeleteSortie';
import useUpdateSortie from '../../../../../hooks/sortieHooks/useUpdateSortie';
import { Autoriser } from '../../../../../models/Autoriser';
import generateNumeroOrdre from '../../../../helper/GenerateNumOrdre';
import { useAuth } from '../../../../helper/AuthProvider';
import SortieService from '../../../../../services/SortieService/SortieService';
import SortieReportService from '../../../../../services/SortieService/SortieReportService';
import AccessDenied from '../../../../helper/AccessDenied';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import './AutSortieModern.css';

dayjs.extend(duration);

// ── helpers ──────────────────────────────────────────────────────────────────
function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} H`;
}

const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); }
  catch { return '—'; }
};

const fmtTime = (d: Date | string | null | undefined) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
};

// ── Mini Calendar ─────────────────────────────────────────────────────────────
function MiniCalendar({ sorties }: { sorties: any[] }) {
  const [current, setCurrent] = useState(new Date());
  const year = current.getFullYear();
  const month = current.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const sortieDays = useMemo(() => {
    const set = new Set<string>();
    sorties.forEach((s) => {
      if (!s?.condep) return;
      const d = new Date(s.condep);
      if (!Number.isNaN(d.getTime()) && d.getMonth() === month && d.getFullYear() === year) {
        set.add(d.getDate().toString());
      }
    });
    return set;
  }, [sorties, month, year]);

  const monthName = current.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const cells = Array.from({ length: offset + daysInMonth }, (_, i) =>
    i < offset ? null : i - offset + 1
  );

  return (
    <Paper className="as-calendar-card">
      <Box className="as-calendar-header">
        <Typography className="as-calendar-title">{monthName.charAt(0).toUpperCase() + monthName.slice(1)}</Typography>
        <Box className="as-calendar-nav">
          <IconButton size="small" onClick={() => setCurrent(new Date(year, month - 1, 1))}><ChevronLeftIcon fontSize="small" /></IconButton>
          <IconButton size="small" onClick={() => setCurrent(new Date(year, month + 1, 1))}><ChevronRightIcon fontSize="small" /></IconButton>
        </Box>
      </Box>
      <Box className="as-calendar-grid">
        {['LU','MA','ME','JE','VE','SA','DI'].map((d) => (
          <Box key={d} className="as-cal-dow">{d}</Box>
        ))}
        {cells.map((day, i) => (
          <Box key={i} className={`as-cal-day ${day && sortieDays.has(day.toString()) ? 'as-cal-day--leave' : ''} ${!day ? 'as-cal-day--empty' : ''}`}>
            {day ?? ''}
            {day && sortieDays.has(day.toString()) && <span className="as-cal-dot" />}
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

// ── Form Dialog ───────────────────────────────────────────────────────────────
function SortieFormDialog({
  open, onClose, editSortie, onSuccess, onError, refetch, employes, absences, soccod,
}: {
  open: boolean;
  onClose: () => void;
  editSortie: Autoriser | null;
  onSuccess: (mode: 'add' | 'edit') => void;
  onError: (mode: 'add' | 'edit', err: any) => void;
  refetch: () => void;
  employes: any[];
  absences: any[];
  soccod: string | null | undefined;
}) {
  const { t } = useTranslation();
  const { mutate: addSortie } = useAddSortie();
  const { mutate: updateSortie } = useUpdateSortie();

  const [empcod, setEmpcod] = useState<string>('');
  const [concod, setConcod] = useState<string>('');
  const [conmotif, setConmotif] = useState<string>('');
  const [abscod, setAbscod] = useState<string>('');
  const [conref, setConref] = useState<string>('');
  const [condat, setCondat] = useState<[Dayjs | null, Dayjs | null]>([dayjs(), dayjs()]);
  const [isSaving, setIsSaving] = useState(false);

  const hoursDiff = useMemo(() => {
    if (condat[0] && condat[1]) {
      const sMin = condat[0].hour() * 60 + condat[0].minute();
      const eMin = condat[1].hour() * 60 + condat[1].minute();
      let diff = eMin - sMin;
      if (diff < 0) diff += 24 * 60;
      return dayjs.duration(diff, 'minutes').asHours();
    }
    return 0;
  }, [condat]);

  // Init form when dialog opens
  useEffect(() => {
    if (!open) return;
    if (editSortie && editSortie.concod) {
      SortieService.getWithParams(`get-autorisation/${soccod}/${editSortie.concod}`).then((res: any) => {
        setAbscod(res?.abscod || '');
        setConcod(res?.concod || '');
        setConmotif(res?.conmotif || '');
        setCondat([dayjs(res?.condep), dayjs(res?.conret)]);
        setConref(res?.conref || '');
        setEmpcod(res?.empcod || '');
      }).catch(() => {});
    } else {
      setEmpcod('');
      setConcod(generateNumeroOrdre());
      setConmotif('');
      setAbscod(absences && absences[0] ? (absences[0].abscod || absences[0].code || '') : '');
      setConref('');
      setCondat([dayjs(), dayjs()]);
    }
  }, [open, editSortie, soccod]);

  const handleSubmit = () => {
    if (!concod) return;
    setIsSaving(true);
    const payload: Autoriser = {
      empcod,
      concod,
      abscod: abscod || null,
      conref: conref || null,
      conmotif: conmotif || null,
      condat: condat[0]?.format('YYYY-MM-DD'),
      condep: `${condat[0]?.format('YYYY-MM-DD')}T${condat[0]?.format('HH:mm:ss')}`,
      conret: `${condat[1]?.format('YYYY-MM-DD')}T${condat[1]?.format('HH:mm:ss')}`,
      connbjour: parseFloat(hoursDiff.toFixed(2)),
      soccod: soccod || '01',
    };
    const cb = {
      onSuccess: () => {
        setIsSaving(false);
        refetch();
        onSuccess(editSortie ? 'edit' : 'add');
        onClose();
      },
      onError: (err: any) => {
        // FIX : avant on appelait onSuccess() ici, ce qui faisait apparaître le
        // snackbar "ajouté avec succès" même en cas d'échec côté serveur.
        setIsSaving(false);
        onError(editSortie ? 'edit' : 'add', err);
      },
    };
    if (editSortie) updateSortie(payload, cb);
    else addSortie(payload, cb);
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
          margin: { xs: '16px', sm: '32px' },
          width: { xs: 'calc(100% - 32px)', sm: '100%' },
          maxWidth: { xs: '100%', sm: '640px' },
        },
      }}>
      <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', pb: 1 }}>
        {editSortie ? t('autSortie.form.editTitle') : t('autSortie.form.newTitle')}
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('autSortie.fields.orderNo')}</Typography>
            <TextField size="small" fullWidth value={concod} InputProps={{ readOnly: true }} sx={fieldSx} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('autSortie.fields.reference')}</Typography>
            <TextField size="small" fullWidth value={conref || ''} placeholder={t('autSortie.fields.referencePlaceholder')} onChange={(e) => setConref(e.target.value)} sx={fieldSx} />
          </Box>
        </Box>

        <Box>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('autSortie.fields.employeeSelection')}</Typography>
          <FormControl fullWidth size="small">
            <Select
              value={empcod}
              onChange={(e) => setEmpcod(e.target.value)}
              displayEmpty
              sx={{ borderRadius: '8px', backgroundColor: '#f8fafc', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' } }}
            >
              <MenuItem value=""><em style={{ color: '#94a3b8' }}>{t('autSortie.fields.employeeSearchPlaceholder')}</em></MenuItem>
              {(employes || []).map((e: any) => (
                <MenuItem key={e.empcod || e.code} value={e.empcod || e.code}>
                  {e.emplib || e.lib} ({e.empcod || e.code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="fr">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('autSortie.fields.date')}</Typography>
              <DatePicker
                value={condat[0]}
                onChange={(v) => setCondat([v, condat[1]])}
                format="DD/MM/YYYY"
                slotProps={{ textField: { size: 'small', fullWidth: true, sx: fieldSx } }}
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('autSortie.fields.startTime')}</Typography>
              <TimePicker
                value={condat[0]}
                onChange={(v) => setCondat([v, condat[1]])}
                ampm={false}
                slotProps={{ textField: { size: 'small', fullWidth: true, sx: fieldSx } }}
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('autSortie.fields.endTime')}</Typography>
              <TimePicker
                value={condat[1]}
                onChange={(v) => setCondat([condat[0], v])}
                ampm={false}
                slotProps={{ textField: { size: 'small', fullWidth: true, sx: fieldSx } }}
              />
            </Box>
          </Box>
        </LocalizationProvider>

        {/* Duration display */}
        <Box sx={{ background: 'linear-gradient(135deg, #f0f5ff 0%, #e8f0fe 100%)', borderRadius: '12px', p: 2, border: '1px solid #bfdbfe', textAlign: 'center' }}>
          <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>{t('autSortie.fields.totalDuration')}</Typography>
          <Typography sx={{ fontSize: '24px', fontWeight: 800, color: '#0040a1' }}>{formatDuration(hoursDiff)}</Typography>
        </Box>

        {/* Type d'autorisation */}
        <Box>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('autSortie.fields.imputation')}</Typography>
          <Box className="as-type-list">
            {(absences || []).map((abs: any) => {
              const code = abs.abscod || abs.code;
              const lib = abs.abslib || abs.lib;
              const active = abscod === code;
              return (
                <label
                  key={code}
                  className={`as-type-item ${active ? 'as-type-item--active' : ''}`}
                  onClick={() => setAbscod(code)}
                >
                  <input type="radio" name="type" checked={active} readOnly />
                  <span>{lib}</span>
                  <span className="as-type-dot" />
                </label>
              );
            })}
          </Box>
        </Box>

        <Box>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('autSortie.fields.comments')}</Typography>
          <TextField
            size="small" fullWidth multiline rows={3}
            value={conmotif || ''}
            onChange={(e) => setConmotif(e.target.value)}
            placeholder={t('autSortie.fields.commentsPlaceholder')}
            sx={fieldSx}
          />
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: '8px', textTransform: 'none', color: '#64748b' }}>{t('autSortie.form.cancel')}</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isSaving}
          startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)' }}>
          {editSortie ? t('autSortie.form.modify') : t('autSortie.form.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function AutSortieModernContent() {
  const { t } = useTranslation();
  const { soccod, hasPermission } = useAuth();

  const canAdd = hasPermission('Absences et Sanctions', 'add');
  const canModify = hasPermission('Absences et Sanctions', 'modify');
  const canDelete = hasPermission('Absences et Sanctions', 'delete');
  const canConsult = hasPermission('Absences et Sanctions', 'consult');

  // Hooks
  const { data: absencesRaw } = useGetAbsencesLibs();
  const absences = useMemo(() => {
    if (Array.isArray(absencesRaw)) return absencesRaw;
    if (absencesRaw && typeof absencesRaw === 'object') {
      if ('data' in absencesRaw) { const d = (absencesRaw as any).data; return Array.isArray(d) ? d : []; }
      return Object.entries(absencesRaw).map(([code, lib]) => ({ abscod: code, abslib: lib }));
    }
    return [];
  }, [absencesRaw]);
  const { data: employesRaw } = useGetEmployee();
  const employes = useMemo(() => {
    if (Array.isArray(employesRaw)) return employesRaw;
    if (employesRaw && typeof employesRaw === 'object') {
      if ('data' in employesRaw) { const d = (employesRaw as any).data; return Array.isArray(d) ? d : []; }
      return Object.entries(employesRaw).map(([code, lib]) => ({ empcod: code, emplib: lib }));
    }
    return [];
  }, [employesRaw]);
  const { mutate: deleteSortie } = useDeleteSortie();
  // Liste société-wide (et non plus filtrée par le site du compte) pour que toutes les
  // autorisations existantes s'affichent dès l'ouverture, sans devoir en créer une.
  const { data: sorties = [], refetch, isLoading } = useGetAllSorties();

  // UI state
  const feedback = useFeedbackSnackbar();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [empFilter, setEmpFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [formOpen, setFormOpen] = useState(false);
  const [editSortie, setEditSortie] = useState<Autoriser | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [sortieToDelete, setSortieToDelete] = useState<Autoriser | null>(null);

  const showSnack = (msg: string, sev: 'success' | 'error' = 'success') =>
    sev === 'success' ? feedback.showSuccess(msg) : feedback.showError(msg);

  // Filtered table data : recherche libre + type d'autorisation + employé + plage de dates
  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() : null;
    return (sorties as any[]).filter((s: any) => {
      if (typeFilter && (s.abscod || '') !== typeFilter) return false;
      if (empFilter && (s.empcod || '') !== empFilter) return false;
      if (q) {
        const hay = `${s.concod ?? ''} ${s.emplib ?? ''} ${s.empcod ?? ''} ${s.abslib ?? ''} ${s.conmotif ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (from !== null || to !== null) {
        const dep = s.condep ? new Date(s.condep).getTime() : (s.condat ? new Date(s.condat).getTime() : null);
        const ret = s.conret ? new Date(s.conret).getTime() : dep;
        if (dep === null) return false;
        if (from !== null && ret !== null && ret < from) return false;
        if (to !== null && dep > to) return false;
      }
      return true;
    });
  }, [sorties, search, typeFilter, empFilter, dateFrom, dateTo]);

  const hasActiveFilter = search !== '' || typeFilter !== '' || empFilter !== '' || dateFrom !== '' || dateTo !== '';
  const resetFilters = () => {
    setSearch(''); setTypeFilter(''); setEmpFilter(''); setDateFrom(''); setDateTo('');
    setPage(0);
  };

  const paginatedData = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  // Handlers
  const handleNew = () => {
    setEditSortie(null);
    setFormOpen(true);
  };

  const handleEdit = (row: any) => {
    setEditSortie(row);
    setFormOpen(true);
  };

  const handleDeleteClick = (row: any) => {
    setSortieToDelete(row);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!sortieToDelete) return;
    deleteSortie({ code: sortieToDelete.concod }, {
      onSuccess: () => {
        showSnack(t('autSortie.msg.deleted'), 'success');
        refetch();
      },
      onError: () => {
        showSnack(t('autSortie.msg.saveError'), 'error');
      },
    });
    setDeleteConfirmOpen(false);
    setSortieToDelete(null);
  };

  const handleReport = async (rowSoccod: string, concod: string) => {
    try {
      const response = await SortieReportService.getReport(`get-autorisation-report/${rowSoccod}/${concod}`, 'blob');
      const blob = new Blob([response], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'AutorisationSortie.pdf';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showSnack(t('autSortie.msg.saveError'), 'error');
    }
  };

  const handleExportRows = () => {
    const doc = new jsPDF();
    const tableData = (filteredData as any[]).map((row) => [
      row.concod ?? '',
      row.condat ? new Date(row.condat).toLocaleDateString('fr-FR') : '',
      row.emplib ?? row.empcod ?? '',
      row.abslib ?? row.abscod ?? '',
      row.condep ? new Date(row.condep).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
      row.conret ? new Date(row.conret).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
      row.connbjour?.toString() ?? '',
    ]);
    autoTable(doc, {
      head: [[
        t('autSortie.pdf.headers.orderNo'),
        t('autSortie.pdf.headers.date'),
        t('autSortie.pdf.headers.employee'),
        t('autSortie.pdf.headers.imputation'),
        t('autSortie.pdf.headers.out'),
        t('autSortie.pdf.headers.in'),
        t('autSortie.pdf.headers.duration'),
      ]],
      body: tableData,
      styles: { cellPadding: 3, fontSize: 8, valign: 'middle', halign: 'center' },
      headStyles: { fillColor: [0, 64, 161], textColor: 255, fontStyle: 'bold' },
    });
    doc.save('autorisation-sortie-export.pdf');
  };

  if (!canConsult) {
    return <AccessDenied />;
  }

  return (
    <Box className="as-container">
      {/* Header */}
      <Box className="as-header">
        <Box>
          <Typography className="as-title">{t('autSortie.header.heading')}</Typography>
          <Typography className="as-subtitle">
            <Trans
              i18nKey="autSortie.subtitle"
              count={(sorties as any[]).length}
              values={{ count: (sorties as any[]).length }}
              components={{ 0: <strong style={{ color: '#0040a1' }} /> }}
            />
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            startIcon={<DownloadIcon />}
            onClick={handleExportRows}
            sx={{
              color: '#0040a1', borderRadius: '12px', textTransform: 'none',
              fontWeight: 700, px: 2.5, backgroundColor: '#e0e7ff',
              '&:hover': { backgroundColor: '#c7d2fe' }
            }}
          >
            {t('autSortie.actions.export')}
          </Button>
          {canAdd && (
            <Button className="as-new-btn" startIcon={<AddIcon />} onClick={handleNew}>
              {t('autSortie.form.newTitle')}
            </Button>
          )}
        </Box>
      </Box>

      <Box className="as-body">
        {/* Left: table */}
        <Box className="as-left">
          {/* Filter toolbar */}
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
                placeholder={t('autSortie.table.searchPlaceholder')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', flex: 1, color: '#0f172a' }}
              />
            </Box>

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <Select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
                displayEmpty
                sx={{ height: 34, fontSize: '13px', background: '#fff', borderRadius: '8px' }}
              >
                <MenuItem value=""><em>{t('autSortie.filters.typeAll')}</em></MenuItem>
                {(absences as any[]).map((a: any) => (
                  <MenuItem key={a.abscod || a.code} value={a.abscod || a.code}>{a.abslib || a.lib}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <Select
                value={empFilter}
                onChange={(e) => { setEmpFilter(e.target.value); setPage(0); }}
                displayEmpty
                sx={{ height: 34, fontSize: '13px', background: '#fff', borderRadius: '8px' }}
              >
                <MenuItem value=""><em>{t('autSortie.filters.empAll')}</em></MenuItem>
                {(employes as any[]).map((e: any) => (
                  <MenuItem key={e.empcod || e.code} value={e.empcod || e.code}>{e.emplib || e.lib}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              type="date" size="small" value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
              label={t('autSortie.filters.from')}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 150, '& .MuiInputBase-root': { height: 34, background: '#fff', borderRadius: '8px', fontSize: '12px' } }}
            />
            <TextField
              type="date" size="small" value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
              label={t('autSortie.filters.to')}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 150, '& .MuiInputBase-root': { height: 34, background: '#fff', borderRadius: '8px', fontSize: '12px' } }}
            />

            {hasActiveFilter && (
              <IconButton size="small" onClick={resetFilters} title={t('autSortie.filters.reset')} sx={{ color: '#64748b' }}>
                <FilterAltOffIcon fontSize="small" />
              </IconButton>
            )}
          </Box>

          {/* Table head */}
          <Box className="as-table-head">
            <Box className="as-th as-col-no">{t('autSortie.table.headers.orderNo')}</Box>
            <Box className="as-th as-col-emp">{t('autSortie.table.headers.employee')}</Box>
            <Box className="as-th as-col-date">{t('autSortie.table.headers.date')}</Box>
            <Box className="as-th as-col-type">{t('autSortie.table.headers.type')}</Box>
            <Box className="as-th as-col-time">{t('autSortie.table.headers.out')}</Box>
            <Box className="as-th as-col-time">{t('autSortie.table.headers.in')}</Box>
            <Box className="as-th as-col-dur">{t('autSortie.table.headers.duration')}</Box>
            <Box className="as-th as-col-actions" style={{ textAlign: 'right' }}>{t('autSortie.table.headers.actions')}</Box>
          </Box>

          {/* Rows */}
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : paginatedData.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: '#94a3b8' }}>
              <EventNoteIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
              <Typography>{t('autSortie.table.empty')}</Typography>
            </Box>
          ) : (
            <Box className="as-rows">
              {paginatedData.map((row: any) => (
                <Box key={row.concod} className="as-row">
                  <Box className="as-col-no as-cell-mono">{row.concod}</Box>
                  <Box className="as-col-emp as-emp-cell">
                    <Avatar className="as-avatar">{(row.emplib || row.empcod || '?').charAt(0).toUpperCase()}</Avatar>
                    <Box>
                      <Typography className="as-emp-name">{row.emplib || row.empcod}</Typography>
                      <Typography className="as-emp-sub">#{row.empcod}</Typography>
                    </Box>
                  </Box>
                  <Box className="as-col-date">
                    <Typography className="as-date-text">{fmtDate(row.condat)}</Typography>
                  </Box>
                  <Box className="as-col-type">
                    <Box className="as-type-badge">{row.abslib || row.abscod || '—'}</Box>
                  </Box>
                  <Box className="as-col-time">
                    <Typography className="as-time-text">{fmtTime(row.condep)}</Typography>
                  </Box>
                  <Box className="as-col-time">
                    <Typography className="as-time-text">{fmtTime(row.conret)}</Typography>
                  </Box>
                  <Box className="as-col-dur">
                    <Box className="as-duration-badge">
                      {row.connbjour ? formatDuration(row.connbjour) : '—'}
                    </Box>
                  </Box>
                  <Box className="as-col-actions as-actions">
                    {canModify && (
                      <Tooltip title={t('autSortie.actions.edit')}>
                        <IconButton size="small" className="as-action-edit" onClick={() => handleEdit(row)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canDelete && (
                      <Tooltip title={t('autSortie.actions.delete')}>
                        <IconButton size="small"
                          sx={{ color: '#ba1a1a', backgroundColor: '#fee2e2', '&:hover': { backgroundColor: '#fecaca' } }}
                          onClick={() => handleDeleteClick(row)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title={t('autSortie.actions.pdfReport')}>
                      <IconButton size="small"
                        sx={{ color: '#0040a1', backgroundColor: '#e0e7ff', '&:hover': { backgroundColor: '#c7d2fe' } }}
                        onClick={() => handleReport(row.soccod || soccod || '', row.concod)}
                      >
                        <PrintIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {/* Pagination footer */}
          <Box className="as-table-footer">
            <Typography sx={{ fontSize: 12, color: '#64748b' }}>
              {t('autSortie.table.footer', { showing: paginatedData.length, total: filteredData.length })}
            </Typography>
            <TablePagination
              component="div"
              count={filteredData.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[5, 10, 20]}
              labelRowsPerPage={t('autSortie.table.rowsPerPage')}
              sx={{ borderTop: 'none' }}
            />
          </Box>
        </Box>

        {/* Right sidebar */}
        <Box className="as-sidebar">
          <MiniCalendar sorties={sorties as any[]} />

          <Paper className="as-stat-card-large">
            <Typography className="as-stat-label">{t('autSortie.sidebar.total')}</Typography>
            <Typography className="as-stat-value as-stat-primary">{(sorties as any[]).length}</Typography>
            <Typography className="as-stat-hint">{t('autSortie.header.heading')}</Typography>
          </Paper>
        </Box>
      </Box>

      {/* Form Dialog */}
      <SortieFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editSortie={editSortie}
        refetch={refetch}
        employes={employes as any[]}
        absences={absences as any[]}
        soccod={soccod}
        onSuccess={(mode) => feedback.showSuccess(mode === 'edit' ? t('autSortie.msg.updated') : t('autSortie.msg.added'))}
        onError={(mode, err) => {
          const fallback = mode === 'edit' ? t('autSortie.msg.updateError') : t('autSortie.msg.addError');
          // extractErrorMessage gère message / title / detail / err.message dans l'ordre.
          feedback.showError(extractErrorMessage(err, fallback));
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}
        PaperProps={{ sx: { borderRadius: '12px', minWidth: '350px' } }}>
        <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', color: '#ba1a1a' }}>
          {t('autSortie.actions.delete')}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#475569', fontSize: '14px', mt: 1 }}>
            {t('autSortie.deleteConfirm')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} sx={{ color: '#64748b', textTransform: 'none' }}>
            {t('autSortie.form.cancel')}
          </Button>
          <Button onClick={confirmDelete} variant="contained" color="error"
            startIcon={<DeleteIcon />}
            sx={{ textTransform: 'none', borderRadius: '8px' }}>
            {t('autSortie.actions.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {feedback.element}
    </Box>
  );
}

export default function AutSortieModern() {
  return (
    <AutSortieModernContent />
  );
}
