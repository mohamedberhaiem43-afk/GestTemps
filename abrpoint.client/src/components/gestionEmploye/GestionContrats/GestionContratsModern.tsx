import React, { useState, useMemo, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Select, MenuItem,
  FormControl, Button, Avatar, Chip, IconButton, CircularProgress, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ChecklistIcon from '@mui/icons-material/Checklist';
import AddIcon from '@mui/icons-material/Add';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Skeleton } from '@mui/material';
import { staggerSx } from '../../helper/animations/Stagger';
import { Contrat } from '../../../models/Contrat';
import useUpdateContrat from '../../../hooks/contratHooks/useUpdateContrat';
import useDeleteContrat from '../../../hooks/contratHooks/useDeleteContrat';
import RenewContractDialog from './RenewContractDialog';
import useGetEmployeesLibs from '../../../hooks/employeHooks/useGetEmployeesLibs';
import useGetEmployee from '../../../hooks/employeHooks/useGetEmployee';
import useGetSocLibs from '../../../hooks/societeHooks/useGetSocLibs';
import useGetSiteLibs from '../../../hooks/siteHooks/useGetSiteLibs';
import useGetFonctionsLibs from '../../../hooks/fonctionHooks/useGetFonctionsLibs';
import { useAuth } from '../../helper/AuthProvider';
import AlertModal from '../../AlertModal/AlertModal';
import apiInstance from '../../API/apiInstance';
import AccessDenied from '../../helper/AccessDenied';
import OnboardingNextStepHint from '../../Dashboard/OnboardingNextStepHint';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import './GestionContratsModern.css';

// ── helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d: any) => {
  if (!d) return '—';
  try { return dayjs(d).format('DD MMM YYYY'); } catch { return '—'; }
};

const fmtDateInput = (d: any) => {
  if (!d) return '';
  try { return dayjs(d).format('YYYY-MM-DD'); } catch { return ''; }
};

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  CDI:     { bg: '#d1fae5', color: '#047857' },
  CDD:     { bg: '#dbeafe', color: '#1d4ed8' },
  Stage:   { bg: '#fef3c7', color: '#b45309' },
  CIVP:    { bg: '#ede9fe', color: '#6d28d9' },
  Ouvrier: { bg: '#fce7f3', color: '#9d174d' },
};
const typeColor = (t: string) => TYPE_COLORS[t] ?? { bg: '#f1f5f9', color: '#475569' };

const AVATAR_COLORS = ['#1d4ed8', '#047857', '#b45309', '#6d28d9', '#0040a1', '#065f46'];

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#f5f7fa', borderRadius: '8px', fontSize: '13px',
    '& fieldset': { border: '1.5px solid #e8ecf2' },
    '&:hover fieldset': { borderColor: '#b8c4d0' },
    '&.Mui-focused fieldset': { borderColor: '#0040a1', borderWidth: '1.5px' },
    '& input': { fontSize: '13px', padding: '9px 12px', color: '#1a2236' },
    '& textarea': { fontSize: '13px', color: '#1a2236' },
  },
};
const selectSx = {
  backgroundColor: '#f5f7fa', borderRadius: '8px', fontSize: '13px',
  '& .MuiOutlinedInput-notchedOutline': { border: '1.5px solid #e8ecf2' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#b8c4d0' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#0040a1' },
  '& .MuiSelect-select': { fontSize: '13px', padding: '9px 12px' },
};
const labelSx = {
  fontSize: '10px', fontWeight: 700, color: '#8896a8',
  textTransform: 'uppercase' as const, letterSpacing: '0.1em', mb: 0.6,
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, subColor, highlight }: {
  label: string; value: string | number; sub?: string; subColor?: string; highlight?: boolean;
}) {
  return (
    <Paper elevation={0} sx={{
      p: 2.5, borderRadius: '14px', backgroundColor: '#fff',
      border: '1px solid #edf0f5', boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
      borderLeft: highlight ? '4px solid #0040a1' : '1px solid #edf0f5',
      '&:hover': { boxShadow: '0 4px 16px rgba(15,23,42,0.1)' }, transition: 'box-shadow 0.2s',
    }}>
      <Typography sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: highlight ? '#0040a1' : '#8896a8', mb: 1 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5 }}>
        <Typography sx={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'Manrope, sans-serif', color: '#0040a1', lineHeight: 1 }}>
          {value}
        </Typography>
        {sub && <Typography sx={{ fontSize: '12px', fontWeight: 700, color: subColor || '#10b981', mb: 0.6 }}>{sub}</Typography>}
      </Box>
    </Paper>
  );
}

// ── Row menu ──────────────────────────────────────────────────────────────────
function RowMenu({ onEdit, onDelete, onRenew, onExport, canModify, canDelete, canAdd }: {
  onEdit: () => void; onDelete: () => void; onRenew: () => void; onExport: () => void;
  canModify: boolean; canDelete: boolean; canAdd: boolean;
}) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  return (
    <>
      <IconButton size="small" onClick={e => setAnchor(e.currentTarget)}
        sx={{ color: '#94a3b8', '&:hover': { backgroundColor: '#f0f5ff', color: '#0040a1' }, borderRadius: '6px' }}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      {anchor && (
        <Paper sx={{ position: 'fixed', zIndex: 1300, borderRadius: '10px', boxShadow: '0 8px 24px rgba(15,23,42,0.12)', minWidth: 160, border: '1px solid #edf0f5', mt: 0.5 }}
          onClick={() => setAnchor(null)}>
          {[
            { label: t('contrat.exportPdf'), icon: <PictureAsPdfIcon fontSize="small" />, onClick: onExport, color: '#16a34a' },
            canAdd && { label: t('contrat.renew'), icon: <RefreshIcon fontSize="small" />, onClick: onRenew, color: '#0040a1' },
            canModify && { label: t('contrat.edit'), icon: <EditIcon fontSize="small" />, onClick: onEdit },
            canDelete && { label: t('contrat.delete'), icon: <DeleteIcon fontSize="small" />, onClick: onDelete, color: '#ef4444' },
          ].filter(Boolean).map((item: any) => (
            <Box key={item.label} onClick={item.onClick}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.2, cursor: 'pointer', color: item.color || '#334155',
                '&:hover': { backgroundColor: item.color ? '#fef2f2' : '#f8faff' } }}>
              <Box sx={{ color: item.color || '#64748b', display: 'flex' }}>{item.icon}</Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>{item.label}</Typography>
            </Box>
          ))}
        </Paper>
      )}
    </>
  );
}

// ── Empty form ────────────────────────────────────────────────────────────────
const emptyForm = (soccod: string): Contrat => ({
  soccod, concod: '', empcod: '',
  condat: undefined, contype: undefined,
  empemb: undefined, empsort: undefined,
  emppost: '', empadr: '', emptel: '',
  empmotif: '', empcontrat: 'CDI',
  empsbase: '', empsbrut: '',
});

// ── Main ──────────────────────────────────────────────────────────────────────
const GestionContratsModernInner = () => {
  const { t } = useTranslation();
  const { soccod, uticod, hasPermission } = useAuth();

  const canAdd = hasPermission('Contrats et Avenants', 'add');
  const canModify = hasPermission('Contrats et Avenants', 'modify');
  const canDelete = hasPermission('Contrats et Avenants', 'delete');

  if (!hasPermission('Contrats et Avenants', 'consult')) {
    return <AccessDenied message={t('contrat.noConsultRight')} />;
  }

  const { data: contratsRaw, isLoading, refetch } = useQuery({
    queryKey: ['contrats', soccod, uticod],
    queryFn: async () => {
      const res = await apiInstance.get(`/Contrats/${soccod}/${uticod}`);
      return res.data;
    },
    enabled: !!soccod && !!uticod,
  });
  const { mutateAsync: updateContrat } = useUpdateContrat();
  const { mutateAsync: deleteContrat } = useDeleteContrat();
  const { data: empLibsRaw = {} } = useGetEmployeesLibs();
  const { data: empLibsDirect } = useGetEmployee();
  const { data: socLibs = {} } = useGetSocLibs();
  const { data: sitLibs = {} } = useGetSiteLibs();
  const { data: fonLibs = {} } = useGetFonctionsLibs();

  const contrats: Contrat[] = useMemo(() => {
    if (Array.isArray(contratsRaw)) return contratsRaw;
    if (Array.isArray((contratsRaw as any)?.$values)) return (contratsRaw as any).$values;
    return [];
  }, [contratsRaw]);

  const empMap: Record<string, string> = useMemo(() => {
    const fromDirect = empLibsDirect;
    if (fromDirect && typeof fromDirect === 'object' && !Array.isArray(fromDirect)) {
      return fromDirect as Record<string, string>;
    }
    const raw = empLibsRaw;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, string>;
    }
    return {};
  }, [empLibsRaw, empLibsDirect]);

  const [form, setForm] = useState<Contrat>(emptyForm(soccod || ''));
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  const [filterType, setFilterType] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Contrat | null>(null);
  const [renewTarget, setRenewTarget] = useState<Contrat | null>(null);
  const [exportTarget, setExportTarget] = useState<Contrat | null>(null);
  const [exportTemplates, setExportTemplates] = useState<{ name: string }[]>([]);
  const [exportTpl, setExportTpl] = useState('');
  const [exporting, setExporting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [loadingEmployee, setLoadingEmployee] = useState(false);

  useEffect(() => {
    if (soccod && mode === 'add' && !form.empcod) {
      apiInstance.get(`/Contrats/get-next-concod/${soccod}`)
        .then(res => {
          const nextConcod = res.data?.concod || res.data || '';
          setForm(prev => ({ ...prev, concod: nextConcod }));
        })
        .catch(() => { /* silent */ });
    }
  }, [soccod, mode]);

  // Pré-remplissage depuis l'URL (?empcod=...) : utilisé après création d'un employé
  // dans EmployeModern → l'admin clique « Créer le contrat » et arrive ici avec
  // l'employé déjà sélectionné, prêt à saisir les infos contractuelles.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const empcodParam = searchParams.get('empcod');
    if (empcodParam && soccod && !form.empcod) {
      handleEmployeeSelect(empcodParam).finally(() => {
        // Nettoie l'URL pour qu'un refresh ultérieur ne re-déclenche pas la sélection
        // (la prop reste cohérente avec le state du form si l'admin change d'employé).
        const next = new URLSearchParams(searchParams);
        next.delete('empcod');
        setSearchParams(next, { replace: true });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, soccod]);

  const showSnack = (message: string, severity: 'success' | 'error') =>
    setSnackbar({ open: true, message, severity });

  const today = dayjs();
  const activeCount = contrats.filter(c => !c.empsort || dayjs(c.empsort).isAfter(today)).length;
  const expiringCount = contrats.filter(c => {
    if (!c.empsort) return false;
    const d = dayjs(c.empsort);
    return d.isAfter(today) && d.diff(today, 'day') <= 30;
  }).length;
  const newThisMonth = contrats.filter(c => c.empemb && dayjs(c.empemb).month() === today.month() && dayjs(c.empemb).year() === today.year()).length;

  const filtered = useMemo(() => {
    return contrats.filter(c => {
      const matchType = filterType === 'all' || c.empcontrat === filterType || c.contype === filterType;
      const empName = c.emplib || empMap[c.empcod] || c.empcod || '';
      const matchSearch = !searchQ || empName.toLowerCase().includes(searchQ.toLowerCase()) || c.concod.toLowerCase().includes(searchQ.toLowerCase());
      return matchType && matchSearch;
    });
  }, [contrats, filterType, searchQ]);

  const handleField = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSelect = (name: string) => (e: any) =>
    setForm(p => ({ ...p, [name]: e.target.value }));

  const handleEmployeeSelect = async (empcod: string) => {
    if (!empcod) {
      setForm(emptyForm(soccod || ''));
      return;
    }

    setLoadingEmployee(true);
    try {
      const resolvedSoccod = soccod || '';
      const [empRes, concodRes] = await Promise.all([
        apiInstance.get(`/Employes/get-employe/${resolvedSoccod}/${empcod}`),
        apiInstance.get(`/Contrats/get-next-concod/${resolvedSoccod}`),
      ]);

      const emp = empRes.data;
      const nextConcod = concodRes.data?.concod || concodRes.data || '';

      setForm(prev => ({
        ...prev,
        empcod,
        concod: nextConcod,
        sitcod: emp.sitcod || prev.sitcod || '',
        empcontrat: emp.empcontrat || prev.empcontrat || 'CDI',
        contype: emp.empcontrat || prev.contype,
        empemb: emp.empemb || prev.empemb,
        empsort: emp.empsort || prev.empsort,
        emppost: emp.foncod || emp.empfonc || emp.poscod || prev.emppost || '',
        empsbase: emp.empsbase ?? prev.empsbase ?? '',
        empadr: emp.empadr || prev.empadr || '',
        emptel: emp.emptel || prev.emptel || '',
      }));
    } catch (err: any) {
      console.error('Error fetching employee details:', err);
      showSnack(t('contrat.loadEmployeeError'), 'error');
      setForm(prev => ({ ...prev, empcod }));
    } finally {
      setLoadingEmployee(false);
    }
  };

  const handleEdit = (c: Contrat) => {
    setForm({
      ...c,
      empcontrat: c.empcontrat || c.contype || 'CDI',
    });
    setMode('edit');
  };

  const handleReset = () => {
    setForm(emptyForm(soccod || ''));
    setMode('add');
  };

  const handleSave = async () => {
    if (!form.empcod) { showSnack(t('contrat.selectEmployee'), 'error'); return; }
    if (!form.concod?.trim()) { showSnack(t('contrat.concodRequired'), 'error'); return; }

    const resolvedSoccod = soccod || form.soccod || '';
    if (!resolvedSoccod) { showSnack(t('contrat.sessionExpired'), 'error'); return; }

    const parseDate = (val: any): string | null => {
      if (!val) return null;
      const d = dayjs(val);
      return d.isValid() ? d.toISOString() : null;
    };

    const parseFloat2 = (val: any): number | null => {
      if (val === null || val === undefined || val === '') return null;
      const n = Number(val);
      return isNaN(n) ? null : n;
    };

    const payload = {
      soccod:     resolvedSoccod.slice(0, 4),
      concod:     form.concod.trim().slice(0, 9),
      empcod:     form.empcod.trim().slice(0, 12),
      sitcod:     form.sitcod    || null,
      empcontrat: form.empcontrat || null,
      emppost:    form.emppost   || null,
      empadr:     form.empadr    || null,
      emptel:     form.emptel    || null,
      empmotif:   form.empmotif  || null,
      empsbase:   parseFloat2(form.empsbase),
      empsbrut:   parseFloat2(form.empsbrut),
      condat:     parseDate(form.condat),
      empemb:     parseDate(form.empemb),
      empsort:    parseDate(form.empsort),
    };

    try {
      if (mode === 'edit') {
        await updateContrat(payload as any);
        showSnack(t('contrat.updatedSuccess'), 'success');
      } else {
        await apiInstance.post('/Contrats', payload);
        showSnack(t('contrat.addedSuccess'), 'success');
      }
      handleReset();
      refetch();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data || err?.message || t('contrat.saveError');
      showSnack(String(msg), 'error');
    }
  };

  const handleDelete = async (c: Contrat) => {
    try {
      await deleteContrat({ soccod: c.soccod, concod: c.concod });
      showSnack(t('contrat.deletedSuccess'), 'success');
      setDeleteTarget(null);
      refetch();
    } catch { showSnack(t('contrat.deleteError'), 'error'); }
  };

  const openExportDialog = async (c: Contrat) => {
    setExportTarget(c);
    setExportTpl('');
    try {
      const { data } = await apiInstance.get('/Templates');
      const list = Array.isArray(data) ? data : Array.isArray((data as any)?.$values) ? (data as any).$values : [];
      const tpls = list.map((t: any) => ({ name: t.name || t }));
      setExportTemplates(tpls);
      // Pré-sélection : modèle nommé "Contrat" si présent.
      const contratTpl = tpls.find((t: any) => /contrat/i.test(t.name));
      if (contratTpl) setExportTpl(contratTpl.name);
      else if (tpls.length > 0) setExportTpl(tpls[0].name);
    } catch {
      showSnack(t('contrat.templatesLoadError'), 'error');
    }
  };

  const doExport = async () => {
    if (!exportTarget || !exportTpl) {
      showSnack(t('contrat.selectTemplate'), 'error');
      return;
    }
    const target = exportTarget;
    const empName = target.emplib || empMap[target.empcod] || target.empcod;
    setExporting(true);
    try {
      const res = await apiInstance.get(
        `/Templates/preview/${encodeURIComponent(exportTpl)}`,
        { params: { soccod: target.soccod, empcod: target.empcod }, responseType: 'blob' }
      );
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanTpl = exportTpl.replace(/\.(html|frx)$/i, '');
      const cleanEmp = String(empName).replace(/[^a-zA-Z0-9_-]+/g, '_');
      link.download = `${cleanTpl}_${cleanEmp}_${target.concod}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showSnack(t('contrat.exported'), 'success');
      setExportTarget(null);
    } catch (err: any) {
      let msg = t('contrat.exportError');
      if (err?.response?.data instanceof Blob) {
        try { msg = JSON.parse(await err.response.data.text())?.message || msg; } catch { /* ignore */ }
      }
      showSnack(msg, 'error');
    } finally {
      setExporting(false);
    }
  };

  const CONTRACT_TYPES = ['CDI', 'CDD', 'Stage', 'CIVP', 'Ouvrier', 'Alternance'];

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', backgroundColor: '#f0f3f8', fontFamily: 'Manrope, sans-serif', pb: 6 }}>

      {/* Étape 5/5 — dernière étape du parcours d'onboarding. Le bandeau
          félicite l'admin et l'invite à retourner au tableau de bord. */}
      <OnboardingNextStepHint
        currentStep="contrat"
        dataCount={(contrats || []).length}
      />

      {/* KPI Row — responsive: 1 col on mobile, 3 on tablet+ */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, px: { xs: 1.5, sm: 3 }, pt: 3, pb: 2 }}>
        <KpiCard label={t('contrat.kpiActive')}    value={activeCount}    sub={t('contrat.kpiActiveSub', { total: contrats.length })} subColor="#10b981" highlight />
        <KpiCard label={t('contrat.kpiExpiring')}  value={expiringCount}  sub={t('contrat.kpiExpiringSub')} subColor="#f59e0b" />
        <KpiCard label={t('contrat.kpiNew')}       value={newThisMonth}   sub={t('contrat.kpiNewSub')} subColor="#8896a8" />
      </Box>

      {/* Main grid — responsive: stacked on mobile, side-by-side on desktop */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '360px 1fr' }, gap: 2.5, px: { xs: 1.5, sm: 3 } }}>

        {/* ── Form ── */}
        <Paper elevation={0} sx={{ borderRadius: '16px', backgroundColor: '#fff', border: '1px solid #edf0f5', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', overflow: 'hidden' }}>
          <Box sx={{ px: { xs: 2, sm: 3 }, pt: 3, pb: 2.5, borderBottom: '1px solid #f1f5f9' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ backgroundColor: '#eff6ff', p: '8px', borderRadius: '9px', display: 'flex' }}>
                  <CreditCardIcon sx={{ color: '#0040a1', fontSize: 20 }} />
                </Box>
                <Typography sx={{ fontSize: '17px', fontWeight: 800, fontFamily: 'Manrope, sans-serif', color: '#0d1f3c' }}>
                  {mode === 'edit' ? t('contrat.editTitle') : t('contrat.newTitle')}
                </Typography>
              </Box>
              {mode === 'edit' && canModify && (
                <IconButton size="small" onClick={handleReset} sx={{ color: '#94a3b8' }}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          </Box>

          <Box sx={{ px: { xs: 2, sm: 3 }, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Société + Filiale */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <Box>
                <Typography sx={labelSx}>{t('contrat.company')}</Typography>
                <FormControl fullWidth size="small">
                  <Select value={form.soccod || soccod || ''} onChange={handleSelect('soccod')} sx={selectSx}>
                    <MenuItem value=""><em>{t('contrat.selectPlaceholder')}</em></MenuItem>
                    {Object.entries(socLibs).map(([k, v]) => (
                      <MenuItem key={k} value={k} sx={{ fontSize: '13px' }}>{String(v)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <Typography sx={labelSx}>{t('contrat.branchSite')}</Typography>
                <FormControl fullWidth size="small">
                  <Select value={form.sitcod || ''} onChange={handleSelect('sitcod')} sx={selectSx}>
                    <MenuItem value=""><em>{t('contrat.selectPlaceholder')}</em></MenuItem>
                    {Object.entries(sitLibs).map(([k, v]) => (
                      <MenuItem key={k} value={k} sx={{ fontSize: '13px' }}>{String(v)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>

            {/* Employé */}
            <Box>
              <Typography sx={labelSx}>{t('contrat.employee')}</Typography>
              {mode === 'edit' ? (
                <TextField
                  size="small" fullWidth
                  value={form.emplib || empMap[form.empcod] || form.empcod}
                  InputProps={{ readOnly: true }} sx={fieldSx}
                />
              ) : (
                <FormControl fullWidth size="small">
                  <Select
                    value={form.empcod}
                    onChange={(e) => handleEmployeeSelect(e.target.value as string)}
                    sx={selectSx}
                    displayEmpty
                    disabled={loadingEmployee}
                    MenuProps={{ PaperProps: { sx: { maxHeight: 300, borderRadius: '10px' } } }}
                  >
                    <MenuItem value=""><em style={{ color: '#aaa' }}>{t('contrat.selectEmployeePlaceholder')}</em></MenuItem>
                    {Object.entries(empMap).map(([code, lib]) => (
                      <MenuItem key={code} value={code} sx={{ fontSize: '13px', py: 1 }}>
                        <Box>
                          <Box sx={{ fontWeight: 600, fontSize: '13px' }}>{String(lib)}</Box>
                          <Box sx={{ fontSize: '11px', color: '#8896a8' }}>{code}</Box>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {loadingEmployee && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <CircularProgress size={14} sx={{ color: '#0040a1' }} />
                  <Typography sx={{ fontSize: '11px', color: '#0040a1', fontWeight: 600 }}>
                    {t('contrat.loadingEmployee')}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* N° Contrat + Type */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <Box>
                <Typography sx={labelSx}>{t('contrat.concodLabel')}</Typography>
                <TextField name="concod" value={form.concod} onChange={handleField}
                  size="small" fullWidth sx={fieldSx} InputProps={{ readOnly: mode === 'edit' }} />
              </Box>
              <Box>
                <Typography sx={labelSx}>{t('contrat.typeLabel')}</Typography>
                <FormControl fullWidth size="small">
                  <Select value={form.empcontrat || form.contype || 'CDI'} onChange={handleSelect('empcontrat')} sx={selectSx}>
                    {CONTRACT_TYPES.map(ct => <MenuItem key={ct} value={ct} sx={{ fontSize: '13px' }}>{ct}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
            </Box>

            {/* Date début + Date fin */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <Box>
                <Typography sx={labelSx}>{t('contrat.dateStart')}</Typography>
                <TextField name="empemb" type="date" value={fmtDateInput(form.empemb)} onChange={handleField}
                  size="small" fullWidth sx={fieldSx} InputLabelProps={{ shrink: true }} />
              </Box>
              <Box>
                <Typography sx={labelSx}>{t('contrat.dateEnd')}</Typography>
                <TextField name="empsort" type="date" value={fmtDateInput(form.empsort)} onChange={handleField}
                  size="small" fullWidth sx={fieldSx} InputLabelProps={{ shrink: true }} />
              </Box>
            </Box>

            {/* Poste + Salaire */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <Box>
                <Typography sx={labelSx}>{t('contrat.positionFunction')}</Typography>
                <FormControl fullWidth size="small">
                  <Select value={form.emppost || ''} onChange={handleSelect('emppost')} sx={selectSx}
                    displayEmpty MenuProps={{ PaperProps: { sx: { maxHeight: 250, borderRadius: '10px' } } }}>
                    <MenuItem value=""><em style={{ color: '#aaa' }}>{t('contrat.selectPlaceholder')}</em></MenuItem>
                    {Object.entries(fonLibs as Record<string, string>).map(([code, lib]) => (
                      <MenuItem key={code} value={code} sx={{ fontSize: '13px' }}>{String(lib)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <Typography sx={labelSx}>{t('contrat.baseSalary')}</Typography>
                <TextField name="empsbase" type="number" value={form.empsbase ?? ''} onChange={handleField} size="small" fullWidth sx={fieldSx} />
              </Box>
            </Box>

            {/* Observations */}
            <Box>
              <Typography sx={labelSx}>{t('contrat.motifObs')}</Typography>
              <TextField name="empmotif" value={form.empmotif || ''} onChange={handleField}
                size="small" fullWidth multiline rows={3} placeholder={t('contrat.obsPlaceholder')} sx={fieldSx} />
            </Box>

            {/* Save */}
              {((mode === 'edit' && canModify) || (mode === 'add' && canAdd)) && (
                <Button variant="contained" fullWidth startIcon={loadingEmployee ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <SaveIcon />} onClick={handleSave}
                  disabled={loadingEmployee}
                  sx={{
                    mt: 0.5, borderRadius: '10px', textTransform: 'none', fontWeight: 800, fontSize: '14px', py: 1.5,
                    background: 'linear-gradient(135deg, #0a2463 0%, #0040a1 50%, #1a6eff 100%)',
                    boxShadow: '0 4px 14px rgba(0,64,161,0.3)',
                    '&:hover': { background: 'linear-gradient(135deg, #071a47 0%, #003080 50%, #0040a1 100%)', transform: 'translateY(-1px)' },
                    '&:disabled': { background: '#c0c8d4', color: '#fff' },
                    transition: 'all 0.2s',
                  }}>
                  {mode === 'edit' ? t('contrat.editTitle') : t('contrat.saveContract')}
                </Button>
              )}
          </Box>
          <Box sx={{ height: 4, background: 'linear-gradient(90deg, #0040a1, #1a6eff, #0040a1)', mt: 'auto' }} />
        </Paper>

        {/* ── Table ── */}
        <Paper elevation={0} sx={{ borderRadius: '16px', backgroundColor: '#fff', border: '1px solid #edf0f5', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Filters bar */}
          <Box sx={{ px: { xs: 1.5, sm: 3 }, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              {['all', ...CONTRACT_TYPES].map(f => (
                <Box key={f} onClick={() => setFilterType(f)}
                  sx={{
                    px: 2, py: 0.7, borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, transition: 'all 0.15s',
                    ...(filterType === f
                      ? { backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1.5px solid #bfdbfe' }
                      : { backgroundColor: 'transparent', color: '#64748b', border: '1.5px solid #e8ecf2', '&:hover': { backgroundColor: '#f8faff' } }),
                  }}>
                  {f === 'all' ? t('contrat.all') : f}
                </Box>
              ))}
              <TextField size="small" placeholder={t('contrat.searchPlaceholder')} value={searchQ} onChange={e => setSearchQ(e.target.value)}
                sx={{ ml: 1, width: { xs: 120, sm: 180 }, '& .MuiOutlinedInput-root': { borderRadius: '20px', fontSize: '12px', height: 32 } }} />
            </Box>
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1 }}>
              {[{ label: t('contrat.exportPdfBtn'), icon: <PictureAsPdfIcon sx={{ fontSize: 15 }} /> }, { label: t('contrat.selection'), icon: <ChecklistIcon sx={{ fontSize: 15 }} /> }].map(btn => (
                <Button key={btn.label} startIcon={btn.icon} size="small"
                  sx={{ borderRadius: '9px', textTransform: 'none', fontWeight: 600, fontSize: '12px', color: '#4a5568', border: '1.5px solid #e2e8f0', backgroundColor: '#fafbfc', px: 1.8, py: 0.7, '&:hover': { borderColor: '#0040a1', color: '#0040a1', backgroundColor: '#f0f5ff' } }}>
                  {btn.label}
                </Button>
              ))}
            </Box>
          </Box>

          {/* Table header — hidden on mobile */}
          <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: '130px 1fr 160px 90px 120px 60px', px: 3, py: 1.5, borderBottom: '1px solid #f1f5f9', backgroundColor: '#fafbfc' }}>
            {[t('contrat.headers.concod'), t('contrat.headers.employee'), t('contrat.headers.period'), t('contrat.headers.type'), t('contrat.headers.position'), t('contrat.headers.actions')].map((h, i) => (
              <Typography key={h} sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8896a8', textAlign: i === 5 ? 'right' : 'left' }}>
                {h}
              </Typography>
            ))}
          </Box>

          {/* Rows container */}
          <Box sx={{ flex: 1, overflow: 'auto', maxHeight: { xs: 'none', md: 480 }, scrollbarWidth: 'thin', scrollbarColor: '#e2e8f0 transparent', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: '#e2e8f0', borderRadius: 99 } }}>
            {isLoading ? (
              // Skeleton table : 5 lignes silhouette sur la même grille que le rendu
              // final, pour éviter le saut visuel quand la donnée arrive.
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <Box key={`sk-c-${i}`} sx={{ display: 'grid', gridTemplateColumns: '130px 1fr 160px 90px 120px 60px', alignItems: 'center', px: 3, py: 1.8, borderBottom: '1px solid #f8fafc', gap: 2 }}>
                    <Skeleton variant="text" sx={{ width: '70%', fontSize: 12 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Skeleton variant="circular" width={36} height={36} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" sx={{ fontSize: 13, width: '80%' }} />
                        <Skeleton variant="text" sx={{ fontSize: 11, width: '40%' }} />
                      </Box>
                    </Box>
                    <Skeleton variant="text" sx={{ width: '85%' }} />
                    <Skeleton variant="rounded" width={50} height={20} />
                    <Skeleton variant="text" sx={{ width: '75%' }} />
                    <Skeleton variant="circular" width={24} height={24} />
                  </Box>
                ))}
              </Box>
            ) : filtered.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                <Typography sx={{ color: '#94a3b8', fontSize: '13px' }}>{t('contrat.noContracts')}</Typography>
              </Box>
            ) : (
              <>
                {/* ── Mobile cards (visible on xs/sm only) ── */}
                <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5, p: 1.5 }}>
                  {filtered.map((c, i) => {
                    const tc = typeColor(c.empcontrat || c.contype || '');
                    const empName = c.emplib || empMap[c.empcod] || c.empcod;
                    const initials = empName ? String(empName).split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() : '?';
                    const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
                    const isExpired = c.empsort && dayjs(c.empsort).isBefore(today);
                    return (
                      <Paper key={`m-${c.soccod}-${c.concod}`} elevation={0} sx={{
                        p: 2, borderRadius: '12px', border: '1px solid #edf0f5',
                        '&:hover': { boxShadow: '0 2px 8px rgba(15,23,42,0.08)' }, transition: 'box-shadow 0.15s',
                        ...staggerSx(i),
                      }}>
                        {/* Top row: avatar + name + actions */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                          <Avatar sx={{ width: 36, height: 36, fontSize: '12px', fontWeight: 700, background: `linear-gradient(135deg, ${avatarColor}cc, ${avatarColor})`, border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                            {initials || '?'}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#0d1f3c', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{empName}</Typography>
                            <Typography sx={{ fontSize: '11px', color: '#8896a8', fontWeight: 500 }}>{c.concod} · {c.empcod}</Typography>
                          </Box>
                          {(canModify || canDelete || canAdd) && (
                            <RowMenu onEdit={() => handleEdit(c)} onDelete={() => setDeleteTarget(c)} onRenew={() => setRenewTarget(c)} onExport={() => openExportDialog(c)} canModify={canModify} canDelete={canDelete} canAdd={canAdd} />
                          )}
                        </Box>
                        {/* Info chips row */}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                          <Chip label={c.empcontrat || c.contype || '—'} size="small"
                            sx={{ backgroundColor: tc.bg, color: tc.color, fontWeight: 800, fontSize: '11px', height: 24, borderRadius: '6px', '& .MuiChip-label': { px: 1.2 } }} />
                          <Typography sx={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                            {fmtDate(c.empemb)} → {c.empsort ? fmtDate(c.empsort) : t('contrat.indefinite')}
                          </Typography>
                          {isExpired && (
                            <Chip label={t('contrat.expired')} size="small" sx={{ backgroundColor: '#fee2e2', color: '#ef4444', fontWeight: 700, fontSize: '10px', height: 20 }} />
                          )}
                        </Box>
                        {/* Poste */}
                        {(fonLibs as Record<string, string>)?.[c.emppost || ''] || c.emppost ? (
                          <Typography sx={{ fontSize: '11px', color: '#8896a8', mt: 0.5 }}>
                            {(fonLibs as Record<string, string>)?.[c.emppost || ''] || c.emppost}
                          </Typography>
                        ) : null}
                      </Paper>
                    );
                  })}
                </Box>

                {/* ── Desktop grid rows (visible on md+ only) ── */}
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  {filtered.map((c, i) => {
                    const tc = typeColor(c.empcontrat || c.contype || '');
                    const empName = c.emplib || empMap[c.empcod] || c.empcod;
                    const initials = empName ? String(empName).split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() : '?';
                    const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
                    const isExpired = c.empsort && dayjs(c.empsort).isBefore(today);
                    return (
                      <Box key={`${c.soccod}-${c.concod}`}
                        sx={{ display: 'grid', gridTemplateColumns: '130px 1fr 160px 90px 120px 60px', alignItems: 'center', px: 3, py: 1.8, borderBottom: '1px solid #f8fafc', transition: 'background-color 0.15s', '&:hover': { backgroundColor: '#f8faff' }, '&:last-child': { borderBottom: 'none' }, ...staggerSx(i) }}>

                        <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#0040a1', fontFamily: 'monospace' }}>
                          {c.concod}
                        </Typography>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 36, height: 36, fontSize: '12px', fontWeight: 700, background: `linear-gradient(135deg, ${avatarColor}cc, ${avatarColor})`, border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                            {initials || '?'}
                          </Avatar>
                          <Box>
                            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#0d1f3c', lineHeight: 1.3 }}>{empName}</Typography>
                            <Typography sx={{ fontSize: '11px', color: '#8896a8', fontWeight: 500 }}>{c.empcod}</Typography>
                          </Box>
                        </Box>

                        <Box>
                          <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>{fmtDate(c.empemb)}</Typography>
                          <Typography sx={{ fontSize: '11px', color: isExpired ? '#ef4444' : c.empsort ? '#8896a8' : '#10b981', fontWeight: 500 }}>
                            {c.empsort ? `→ ${fmtDate(c.empsort)}` : 'Indéterminé'}
                          </Typography>
                        </Box>

                        <Chip label={c.empcontrat || c.contype || '—'} size="small"
                          sx={{ backgroundColor: tc.bg, color: tc.color, fontWeight: 800, fontSize: '11px', height: 24, borderRadius: '6px', '& .MuiChip-label': { px: 1.2 } }} />

                        <Typography sx={{ fontSize: '12px', color: '#64748b', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(fonLibs as Record<string, string>)?.[c.emppost || ''] || c.emppost || '—'}
                        </Typography>

                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                          {(canModify || canDelete || canAdd) ? (
                            <RowMenu onEdit={() => handleEdit(c)} onDelete={() => setDeleteTarget(c)} onRenew={() => setRenewTarget(c)} onExport={() => openExportDialog(c)} canModify={canModify} canDelete={canDelete} canAdd={canAdd} />
                          ) : (
                            <Typography variant="caption">—</Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </>
            )}
          </Box>

          {/* Footer */}
          <Box sx={{ px: { xs: 1.5, sm: 3 }, py: 2, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafbfc' }}>
            <Typography sx={{ fontSize: '12px', color: '#8896a8', fontWeight: 500 }}>
              {t('contrat.displayedCount', { count: filtered.length })}
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* FAB */}
      {canAdd && (
        <Box onClick={handleReset}
          sx={{ position: 'fixed', bottom: 28, right: 28, width: 52, height: 52, background: 'linear-gradient(135deg, #0a2463 0%, #0040a1 100%)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(0,64,161,0.4)', cursor: 'pointer', zIndex: 100, transition: 'all 0.2s', '&:hover': { transform: 'scale(1.08)' } }}>
          <AddIcon sx={{ color: '#fff', fontSize: 24 }} />
        </Box>
      )}

      <AlertModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        message={t('contrat.deleteConfirm', {
          concod: deleteTarget?.concod ?? '',
          employee: deleteTarget?.emplib || empMap[deleteTarget?.empcod || ''] || deleteTarget?.empcod || '',
        })}
      />

      <RenewContractDialog
        open={!!renewTarget}
        source={renewTarget}
        onClose={() => setRenewTarget(null)}
        onSuccess={() => { setRenewTarget(null); refetch(); showSnack(t('contrat.renewedSuccess'), 'success'); }}
      />

      <Dialog open={!!exportTarget} onClose={() => !exporting && setExportTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <PictureAsPdfIcon sx={{ color: '#16a34a' }} />
          {t('contrat.exportTitle', { concod: exportTarget?.concod ?? '' })}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: '#475569', mb: 2 }}>
            {t('contrat.exportPrompt')}{' '}
            <strong>{exportTarget?.emplib || empMap[exportTarget?.empcod || ''] || exportTarget?.empcod}</strong>.
          </Typography>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <Select
              value={exportTpl}
              onChange={(e) => setExportTpl(e.target.value as string)}
              displayEmpty
              sx={selectSx}
            >
              <MenuItem value=""><em>{t('contrat.selectTemplatePlaceholder')}</em></MenuItem>
              {exportTemplates.map((tpl) => (
                <MenuItem key={tpl.name} value={tpl.name} sx={{ fontSize: 13 }}>{tpl.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {exportTemplates.length === 0 && (
            <Typography sx={{ fontSize: 12, color: '#ef4444', mt: 1 }}>
              {t('contrat.noTemplate')}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setExportTarget(null)} disabled={exporting} sx={{ textTransform: 'none' }}>
            {t('contrat.cancel')}
          </Button>
          <Button
            onClick={doExport}
            disabled={exporting || !exportTpl}
            variant="contained"
            startIcon={exporting ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <PictureAsPdfIcon />}
            sx={{ bgcolor: '#16a34a', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#15803d' } }}
          >
            {exporting ? t('contrat.exporting') : t('contrat.downloadPdf')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

const GestionContratsModern = () => (
  <GestionContratsModernInner />
);

export default GestionContratsModern;