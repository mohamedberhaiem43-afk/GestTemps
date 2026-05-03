import { useState, useMemo } from 'react';
import {
   Box, Typography, Button, Snackbar, Alert, CircularProgress,
   Avatar, Tooltip, TablePagination,
   FormControl, Select, MenuItem, TextField
} from '@mui/material';
import { LocalizationProvider, DatePicker, TimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useTranslation } from 'react-i18next';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ScheduleIcon from '@mui/icons-material/Schedule';
import InfoIcon from '@mui/icons-material/Info';
import SearchIcon from '@mui/icons-material/Search';
import './JourCompensationModern.css';
import { Compenser } from '../../../../Compense';
import useGetAbsencesLibs from '../../../../hooks/absenceHooks/useGetAbsenceLibs';
import useAddCompensation from '../../../../hooks/compensationHooks/useAddCompensation';
import useDeleteCompensation from '../../../../hooks/compensationHooks/useDeleteCompensation';
import useGetCompensations from '../../../../hooks/compensationHooks/useGetCompensations';
import useGetEmployee from '../../../../hooks/employeHooks/useGetEmployee';
import useUpdateCompensation from '../../../../hooks/compensationHooks/useUpdateCompensation';
import { useAuth } from '../../../helper/AuthProvider';
import BreadcrumbNavigation from '../../../helper/BreadcrumbNavigation';

function JourDeCompensationContent() {
   const { t } = useTranslation();
   const { soccod } = useAuth();

   // Form state
   const [empcod, setEmpcod] = useState('');
   const [concod, setConcod] = useState('');
   const [ref, setRef] = useState('');
   const [conmotif, setConmotif] = useState('');
   const [abscod, setAbscod] = useState('');
   const [condat, setCondat] = useState<[Dayjs, Dayjs]>([dayjs(), dayjs()]);
   const [mode, setMode] = useState<'save' | 'edit'>('save');

   // UI state
   const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as any });
   const [isSaving, setIsSaving] = useState(false);
   const [search, setSearch] = useState('');
   const [page, setPage] = useState(0);
   const [rowsPerPage, setRowsPerPage] = useState(10);

   // Hooks
   const { data: absencesRaw } = useGetAbsencesLibs();
   const absences = useMemo(() => {
      if (absencesRaw && typeof absencesRaw === 'object') return absencesRaw;
      return {};
   }, [absencesRaw]);

   const { data: employesRaw } = useGetEmployee();
   const employes = useMemo(() => {
      if (employesRaw && typeof employesRaw === 'object') return employesRaw;
      return {};
   }, [employesRaw]);

   const { mutate: addComp } = useAddCompensation();
   const { mutate: updateComp } = useUpdateCompensation();
   const { mutate: deleteComp } = useDeleteCompensation();
   const { data: list = [], refetch, isLoading: loadingList } = useGetCompensations();

   const hoursDiff = useMemo(() => {
      return condat[1].diff(condat[0], "hour", true);
   }, [condat]);

   const filteredData = useMemo(() => {
      if (!search) return list;
      const q = search.toLowerCase();
      return list.filter((item: any) =>
         (item.emplib || item.empcod || '').toLowerCase().includes(q) ||
         (item.concod || '').toLowerCase().includes(q)
      );
   }, [list, search]);

   const paginatedData = useMemo(() => {
      const start = page * rowsPerPage;
      return filteredData.slice(start, start + rowsPerPage);
   }, [filteredData, page, rowsPerPage]);

   const handleEdit = (item: any) => {
      setEmpcod(item.empcod || '');
      setConcod(item.concod || '');
      setRef(item.conref || '');
      setConmotif(item.conmotif || '');
      setAbscod(item.abscod || '');
      if (item.condep && item.conret) {
         setCondat([dayjs(item.condep), dayjs(item.conret)]);
      }
      setMode('edit');
      window.scrollTo({ top: 0, behavior: 'smooth' });
   };

   const handleSubmit = () => {
      if (!empcod || !concod) {
         setSnack({ open: true, msg: t('jourCompensation.msg.requiredFields'), sev: 'error' });
         return;
      }
      setIsSaving(true);
      const payload: Compenser = {
         soccod: soccod || '01',
         empcod, concod, abscod,
         conref: ref, conmotif,
         condat: condat[0].format("YYYY-MM-DD"),
         condep: condat[0].toISOString(),
         conret: condat[1].toISOString(),
         connbjour: hoursDiff,
      };

      const cb = {
         onSuccess: () => {
            setSnack({ open: true, msg: t('jourCompensation.msg.saveSuccess'), sev: 'success' });
            resetForm();
            setIsSaving(false);
         },
         onError: () => {
            setSnack({ open: true, msg: t('jourCompensation.msg.saveError'), sev: 'error' });
            setIsSaving(false);
         }
      };

      mode === 'edit' ? updateComp(payload, cb) : addComp(payload, cb);
   };

   const handleDelete = (item: any) => {
      if (window.confirm(t('jourCompensation.msg.deleteConfirm', { code: item.concod }))) {
         deleteComp({ concod: item.concod }, { onSuccess: () => { refetch(); } });
      }
   };

   const resetForm = () => {
      setEmpcod('');
      setConcod('');
      setRef('');
      setConmotif('');
      setAbscod('');
      setCondat([dayjs(), dayjs()]);
      setMode('save');
      refetch();
   };

   const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px', backgroundColor: '#f8fafc' } };
   const textFieldSx = { borderRadius: '10px', backgroundColor: '#f8fafc' };

   return (
      <Box className="jc-container">
         <Box className="jc-header">
            <Box>
               <BreadcrumbNavigation />
               <Typography className="jc-header-title">{t('jourCompensation.header.title')}</Typography>
               <Typography className="jc-header-sub">{t('jourCompensation.header.subtitle')}</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
               <Button variant="outlined" startIcon={<RefreshIcon />} onClick={resetForm} sx={{ color: '#475569', borderColor: '#e2e8f0', textTransform: 'none', borderRadius: '10px' }}>
                  {t('jourCompensation.header.newEntry')}
               </Button>
               <Button variant="contained" startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />} onClick={handleSubmit}
                  sx={{ bgcolor: '#0f172a', color: '#fff', fontWeight: 700, textTransform: 'none', borderRadius: '10px', '&:hover': { bgcolor: '#1e293b' } }}>
                  {mode === 'edit' ? t('jourCompensation.header.update') : t('jourCompensation.header.save')}
               </Button>
            </Box>
         </Box>

         <Box className="jc-body">
            {/* Left: Form */}
            <Box className="jc-card">
               <Box>
                  <Typography className="jc-card-title"><AssignmentIcon fontSize="small" color="primary" /> {t('jourCompensation.form.infoTitle')}</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                     <Box className="jc-field">
                        <label>{t('jourCompensation.form.employee')}</label>
                        <FormControl fullWidth size="small">
                           <Select value={empcod} onChange={(e) => setEmpcod(e.target.value)} sx={{ borderRadius: '10px', backgroundColor: '#f8fafc' }}>
                              {Object.entries(employes).map(([k, v]) => <MenuItem key={k} value={k}>{String(v)}</MenuItem>)}
                           </Select>
                        </FormControl>
                     </Box>
                     <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                        <Box className="jc-field">
                           <label>{t('jourCompensation.form.orderNo')}</label>
                           <TextField size="small" fullWidth value={concod} onChange={(e) => setConcod(e.target.value)} sx={fieldSx} InputProps={{ readOnly: mode === 'edit' }} />
                        </Box>
                        <Box className="jc-field">
                           <label>{t('jourCompensation.form.reference')}</label>
                           <TextField size="small" fullWidth value={ref} onChange={(e) => setRef(e.target.value)} sx={fieldSx} />
                        </Box>
                     </Box>
                  </Box>
               </Box>

               <Box>
                  <Typography className="jc-card-title"><ScheduleIcon fontSize="small" color="primary" /> {t('jourCompensation.form.scheduleTitle')}</Typography>
                  <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="fr">
                     <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box className="jc-field">
                           <label>{t('jourCompensation.form.startDateTime')}</label>
                           <Box sx={{ display: 'flex', gap: 1 }}>
                              <DatePicker value={condat[0]} onChange={(v) => v && setCondat([v, condat[1]])} format="DD/MM/YYYY" slotProps={{ textField: { size: 'small', fullWidth: true, sx: textFieldSx } }} />
                              <TimePicker value={condat[0]} onChange={(v) => v && setCondat([v, condat[1]])} ampm={false} slotProps={{ textField: { size: 'small', fullWidth: true, sx: textFieldSx } }} />
                           </Box>
                        </Box>
                        <Box className="jc-field">
                           <label>{t('jourCompensation.form.endTime')}</label>
                           <TimePicker value={condat[1]} onChange={(v) => v && setCondat([condat[0], v])} ampm={false} slotProps={{ textField: { size: 'small', fullWidth: true, sx: textFieldSx } }} />
                        </Box>
                        <Box sx={{ p: 2, bgcolor: '#e0f2fe', borderRadius: '12px', textAlign: 'center' }}>
                           <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>{t('jourCompensation.form.totalDuration')}</Typography>
                           <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#0c4a6e' }}>{t('jourCompensation.form.hoursValue', { hours: hoursDiff.toFixed(2) })}</Typography>
                        </Box>
                     </Box>
                  </LocalizationProvider>
               </Box>

               <Box>
                  <Typography className="jc-card-title"><InfoIcon fontSize="small" color="primary" /> {t('jourCompensation.form.detailsTitle')}</Typography>
                  <Box className="jc-field">
                     <label>{t('jourCompensation.form.imputation')}</label>
                     <FormControl fullWidth size="small">
                        <Select value={abscod} onChange={(e) => setAbscod(e.target.value)} sx={{ borderRadius: '10px', backgroundColor: '#f8fafc' }}>
                           {Object.entries(absences).map(([k, v]) => <MenuItem key={k} value={String(k)}>{String(v)}</MenuItem>)}
                        </Select>
                     </FormControl>
                  </Box>
                  <Box className="jc-field" sx={{ mt: 2 }}>
                     <label>{t('jourCompensation.form.reason')}</label>
                     <TextField multiline rows={3} fullWidth value={conmotif} onChange={(e) => setConmotif(e.target.value)} sx={fieldSx} placeholder={t('jourCompensation.form.reasonPlaceholder')} />
                  </Box>
               </Box>
            </Box>

            {/* Right: List */}
            <Box className="jc-list-container">
               <Box className="jc-list-header">
                  <Typography sx={{ fontWeight: 800, color: '#1e293b' }}>{t('jourCompensation.list.title')}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                     <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#f1f5f9', px: 1.5, py: 0.5, borderRadius: '8px' }}>
                        <SearchIcon sx={{ fontSize: 16, color: '#64748b', mr: 1 }} />
                        <input type="text" placeholder={t('jourCompensation.list.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)}
                           style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '150px' }} />
                     </Box>
                  </Box>
               </Box>

               <Box sx={{ overflowX: 'auto', width: '100%' }}>
                  <table className="jc-table">
                  <thead>
                     <tr>
                        <th>{t('jourCompensation.list.employee')}</th>
                        <th>{t('jourCompensation.list.date')}</th>
                        <th>{t('jourCompensation.list.period')}</th>
                        <th>{t('jourCompensation.list.duration')}</th>
                        <th style={{ textAlign: 'right' }}>{t('jourCompensation.list.actions')}</th>
                     </tr>
                  </thead>
                  <tbody>
                     {loadingList ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}><CircularProgress /></td></tr>
                     ) : paginatedData.length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>{t('jourCompensation.list.empty')}</td></tr>
                     ) : paginatedData.map((row: any) => (
                        <tr key={row.concod}>
                           <td>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                 <Avatar sx={{ width: 28, height: 28, fontSize: '11px', fontWeight: 700 }}>{(row.emplib || row.empcod || '?')?.charAt(0)}</Avatar>
                                 <Typography sx={{ fontWeight: 600, fontSize: '13px' }}>{row.emplib || row.empcod}</Typography>
                              </Box>
                           </td>
                           <td>{dayjs(row.condat).format('DD MMM YYYY')}</td>
                           <td style={{ color: '#64748b', fontSize: '12px' }}>
                              {dayjs(row.condep).format('HH:mm')} — {dayjs(row.conret).format('HH:mm')}
                           </td>
                           <td>
                              <span className="jc-badge">{row.connbjour?.toFixed(2)} H</span>
                           </td>
                           <td style={{ textAlign: 'right' }}>
                              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                 <Tooltip title={t('jourCompensation.list.edit')}>
                                    <button className="jc-action-btn jc-edit-btn" onClick={() => handleEdit(row)}><EditIcon sx={{ fontSize: 16 }} /></button>
                                 </Tooltip>
                                 <Tooltip title={t('jourCompensation.list.delete')}>
                                    <button className="jc-action-btn jc-delete-btn" onClick={() => handleDelete(row)}><DeleteIcon sx={{ fontSize: 16 }} /></button>
                                 </Tooltip>
                              </Box>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </Box>

               <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                  <TablePagination
                     component="div"
                     count={filteredData.length}
                     page={page}
                     onPageChange={(_, p) => setPage(p)}
                     rowsPerPage={rowsPerPage}
                     onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                     rowsPerPageOptions={[5, 10, 20]}
                     labelRowsPerPage={t('jourCompensation.list.rowsPerPage')}
                  />
               </Box>
            </Box>
         </Box>

         <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
            <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>{snack.msg}</Alert>
         </Snackbar>
      </Box>
   );
}

export default function JourDeCompensation() {
   const qc = new QueryClient();
   return <QueryClientProvider client={qc}><JourDeCompensationContent /></QueryClientProvider>;
}