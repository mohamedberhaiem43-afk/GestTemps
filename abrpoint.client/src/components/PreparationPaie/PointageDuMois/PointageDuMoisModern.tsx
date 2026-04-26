import {
  Box, Typography, Paper, Button, CircularProgress, Avatar,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
  Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Chip, Select, MenuItem, FormControl,
  TextField, Snackbar, Alert,
} from '@mui/material';
import { useMemo, useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import EventNoteIcon from '@mui/icons-material/EventNote';
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { toast } from 'react-toastify';
import { DateMoisPointageRangeProvider, useDateMoisPointageRange } from './FilterPointageMoisContext';
import useGetPointageMois from '../../../hooks/pointagemoisHooks/useGetPointageMois';
import useGetRubriquesPaire from '../../../hooks/rubriqueHooks/useGetRubriquePaire';
import IntegrationPaieButton from '../../helper/IntegrationPaieButton';
import { PointageMois } from '../../../models/PointageMois';
import { useAuth } from '../../helper/AuthProvider';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../helper/TimeConverter/formatDateForApi';
import apiInstance from '../../API/apiInstance';
import useGetEmployeesLibs from '../../../hooks/employeHooks/useGetEmployeesLibs';
import AccessDenied from '../../helper/AccessDenied';
import './PointageDuMoisModern.css';

// ── types ────────────────────────────────────────────────────────────────────
interface EtatGlobalData {
  empmat: string; emplib: string; empreg: string;
  jourtrv: number; tothre: string; jferier: number; jftrv: number;
  hftrv: string; hnuit: string; jconge: number;
  hs50: string; hs25: string; csf: string;
} 

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtMin = (minutes: number) => {
  const h = Math.floor(Math.round(minutes) / 60);
  const m = Math.round(minutes) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const downloadPDF = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  window.URL.revokeObjectURL(url); document.body.removeChild(a);
};

const generateEtatGlobal = async (request: any): Promise<Blob> => {
  const res = await apiInstance.post('/Presences/etat-global', request, { responseType: 'blob' });
  return res.data;
};

const getCurrentMonth = () => String(new Date().getMonth() + 1);
const getCurrentYear  = () => new Date().getFullYear().toString();

// ── Weekly detail columns ────────────────────────────────────────────────────
const WEEK_COLS = [
  { key: 'tothre',            label: 'Nb. Heures' },
  { key: 'nbJours',           label: 'Nb. Jours' },
  { key: 'retard',            label: 'Retard', fmt: (v: number) => fmtMin(v) },
  { key: 'heuresSupTranche1', label: 'HS25' },
  { key: 'heuresSupTranche2', label: 'HS50' },
  { key: 'hreSupSemaine',     label: 'HS' },
  { key: 'jourFerier',        label: 'J.Fériés' },
  { key: 'heureFerier',       label: 'H.Fériés' },
  { key: 'nbhFerierTrv',      label: 'H.Fér.Trv' },
  { key: 'hreFerieTrv',       label: 'H.Fér.Trv1' },
  { key: 'hreFerieTrv2',      label: 'H.Fér.Trv2' },
  { key: 'nbJourFerier',      label: 'J.Fér.Trv' },
  { key: 'hreAllaitement',    label: 'Allaitement' },
  { key: 'absnp',             label: 'Abs N/Payé' },
  { key: 'caltype',           label: 'Calend' },
  { key: 'totalAbsence',      label: 'H.Absences' },
  { key: 'nbJourPointer',     label: 'J.Pointés' },
  { key: 'panier',            label: 'Panier' },
  { key: 'nbNuits',           label: 'Nb.Nuits' },
  { key: 'nbJourCngPaye',     label: 'Congé Payé' },
  { key: 'nbHeureConge',      label: 'H.Congé' },
  { key: 'hcsf',              label: 'H.Spéc.Fam' },
  { key: 'heuresNormales',    label: 'H.Normales' },
  { key: 'jourRepos',         label: 'J.Repos' },
  { key: 'hreNuits',          label: 'H.Nuits' },
  { key: 'heureRepos',        label: 'H.Repos' },
  { key: 'deplacement',       label: 'Déplacement' },
  { key: 'act',               label: 'ACT' },
  { key: 'fm',                label: 'Formation' },
  { key: 'absj',              label: 'Abs.Just' },
  { key: 'ct',                label: 'Arrêt Tech.' },
  { key: 'maladie',           label: 'Maladie' },
  { key: 'absnj',             label: 'Abs.NJ' },
  { key: 'csf',               label: 'C.Spéc.Fam' },
  { key: 'css',               label: 'CSS' },
  { key: 'map',               label: 'MAP' },
  { key: 'jourSamediTrv',     label: 'Sam.Trv' },
  { key: 'hreSamediTrv',      label: 'H.Sam.Trv' },
];

// ── Main inner component ─────────────────────────────────────────────────────
function PointageDuMoisContent() {
  const { soccod, isManager, sercod: managerSercod, hasPermission } = useAuth();
  const isManagerScoped = Boolean(isManager && managerSercod);
  
  const canModify = hasPermission('Paie et Rémunération', 'modify');

  if (!hasPermission('Paie et Rémunération', 'consult')) {
    return <AccessDenied message="Vous n'avez pas le droit de consulter le pointage du mois." />;
  }
  const { t } = useTranslation();
  const context = useDateMoisPointageRange();
  const dateRange = context?.dateRange;
  const setDateRange = context?.setDateRange;

  const [mois, setMois] = useState(getCurrentMonth());
  const [annee, setAnnee] = useState(getCurrentYear());
  const [selectedFiliale, setSelectedFiliale] = useState(sessionStorage.getItem('sitcod') ?? '');
  const [selectedService, setSelectedService] = useState(isManagerScoped ? (managerSercod ?? '') : '');
  const [selectedRegime, setSelectedRegime] = useState('');
  const [selectedEmpcods, setSelectedEmpcods] = useState<string[]>([]);
  const [filiale, setFiliale] = useState<Record<string, string>>({});
  const [services, setServices] = useState<Record<string, string>>({});
  const [majorerHeures, setMajorerHeures] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<PointageMois | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [numSem, setNumSem] = useState(1);
  const [selectedWeekDetails, setSelectedWeekDetails] = useState<Record<string, string> | null>(null);
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'info' as any });
  const [openAlertsDialog, setOpenAlertsDialog] = useState(false);
  const [treatedAlerts, setTreatedAlerts] = useState<Record<string, 'traite' | 'ignore'>>({});
  const [alertFilter, setAlertFilter] = useState<'all' | 'retard' | 'absnj'>('all');

  const { data: employeesLibs = [] } = useGetEmployeesLibs(selectedFiliale, selectedService, undefined, selectedRegime);
  const { data: rubriques = [] } = useGetRubriquesPaire();

  const empcods = dateRange?.empcods ?? [];
  const ctxMois = dateRange?.mois ?? mois;
  const ctxAnnee = dateRange?.annee ?? annee;
  const ctxSemaine = dateRange?.semaine ?? '0';

  const { data: pointageMoisData = [], isLoading } = useGetPointageMois(empcods, ctxMois, ctxAnnee, ctxSemaine);

  const pointageMois: PointageMois[] = useMemo(() =>
    pointageMoisData.map((item: any) => ({
      ...item,
      heuresSupplementairesResultats: item.heuresSupplementairesResultats || [],
    })), [pointageMoisData]);

  // ── Alerts data ──
  const alertsData = useMemo(() => {
    const alerts: {
      id: string; type: 'retard' | 'absnj'; empCod: string; empLib: string; empMat: string;
      weekIdx: number; value: number; label: string; severity: 'warn' | 'err';
    }[] = [];
    pointageMois.forEach(emp => {
      (emp.heuresSupplementairesResultats ?? []).forEach((r, idx) => {
        if ((r.retard ?? 0) > 30) {
          alerts.push({
            id: `${emp.empCod}-retard-S${idx + 1}`,
            type: 'retard', empCod: emp.empCod, empLib: emp.empLib, empMat: emp.empMat,
            weekIdx: idx + 1, value: r.retard ?? 0,
            label: `Retard de ${fmtMin(r.retard ?? 0)} en Semaine ${idx + 1}`,
            severity: 'warn',
          });
        }
        if ((r.absnj ?? 0) > 0) {
          alerts.push({
            id: `${emp.empCod}-absnj-S${idx + 1}`,
            type: 'absnj', empCod: emp.empCod, empLib: emp.empLib, empMat: emp.empMat,
            weekIdx: idx + 1, value: r.absnj ?? 0,
            label: `Absence non justifiée (${(r.absnj ?? 0).toFixed(1)}j) en Semaine ${idx + 1}`,
            severity: 'err',
          });
        }
      });
    });
    return alerts;
  }, [pointageMois]);

  const filteredAlerts = useMemo(() =>
    alertFilter === 'all' ? alertsData : alertsData.filter(a => a.type === alertFilter),
    [alertsData, alertFilter]);

  const treatedCount = Object.keys(treatedAlerts).filter(k => treatedAlerts[k] === 'traite').length;
  const ignoredCount = Object.keys(treatedAlerts).filter(k => treatedAlerts[k] === 'ignore').length;
  const pendingCount = alertsData.length - treatedCount - ignoredCount;

  useEffect(() => {
    if (!soccod) return;
    apiInstance.get(`/Sites/get-sitlibs/${soccod}`).then(r => setFiliale(r.data)).catch(console.error);
    apiInstance.get(`/Services/get-servlibs/${soccod}`).then(r => {
      const allServices = r.data ?? {};
      if (isManagerScoped && managerSercod) {
        setServices(allServices[managerSercod] ? { [managerSercod]: allServices[managerSercod] } : {});
        return;
      }
      setServices(allServices);
    }).catch(console.error);
  }, [soccod, isManagerScoped, managerSercod]);

  useEffect(() => {
    if (isManagerScoped && managerSercod) {
      setSelectedService(managerSercod);
    }
  }, [isManagerScoped, managerSercod]);

  const handleSearch = () => {
    if (selectedEmpcods.length === 0) {
      setSnack({ open: true, msg: 'Veuillez sélectionner au moins un employé.', sev: 'warning' });
      return;
    }
    setDateRange?.((prev: any) => ({
      ...prev, mois, annee,
      selectedFiliale, selectedService, selectedRegime,
      semaine: '0', empcods: selectedEmpcods,
    }));
  };

  // Totals for selected employee
  const totals = useMemo(() => {
    if (!selectedEmp?.heuresSupplementairesResultats) return null;
    return selectedEmp.heuresSupplementairesResultats.reduce((acc, r) => {
      WEEK_COLS.forEach(({ key }) => {
        if (key === 'caltype') { acc[key] = (acc[key] ?? '') + (r[key as keyof typeof r] ?? ''); }
        else if (key === 'retard') { acc[key] = (acc[key] ?? 0) + (r.retard ?? 0); }
        else { acc[key] = (acc[key] ?? 0) + (Number(r[key as keyof typeof r]) || 0); }
      });
      return acc;
    }, {} as Record<string, any>);
  }, [selectedEmp]);

  // Global stats
  const totalHours = useMemo(() =>
    pointageMois.reduce((sum, emp) =>
      sum + (emp.heuresSupplementairesResultats?.reduce((s, r) => s + (r.tothre ?? 0), 0) ?? 0), 0),
    [pointageMois]);

  const totalHS = useMemo(() =>
    pointageMois.reduce((sum, emp) =>
      sum + (emp.heuresSupplementairesResultats?.reduce((s, r) => s + (r.hreSupSemaine ?? 0), 0) ?? 0), 0),
    [pointageMois]);

  const totalAbsences = useMemo(() =>
    pointageMois.reduce((sum, emp) =>
      sum + (emp.heuresSupplementairesResultats?.reduce((s, r) => s + (r.totalAbsence ?? 0), 0) ?? 0), 0),
    [pointageMois]);

  // Service distribution
  const serviceDistrib = useMemo(() => {
    const map: Record<string, number> = {};
    pointageMois.forEach(emp => {
      const svc = services[emp.empSite] || emp.empSite || 'Autre';
      const hrs = emp.heuresSupplementairesResultats?.reduce((s, r) => s + (r.tothre ?? 0), 0) ?? 0;
      map[svc] = (map[svc] ?? 0) + hrs;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [pointageMois, services]);

  // Alert counts
  const retardsCount = useMemo(() =>
    pointageMois.filter(e => e.heuresSupplementairesResultats?.some(r => (r.retard ?? 0) > 30)).length,
    [pointageMois]);

  const absNJCount = useMemo(() =>
    pointageMois.filter(e => e.heuresSupplementairesResultats?.some(r => (r.absnj ?? 0) > 0)).length,
    [pointageMois]);

  const handleExportOne = async () => {
    if (!selectedEmp || !totals) { toast.error('Sélectionnez un employé'); return; }
    try {
      const year = parseInt(ctxAnnee), month = parseInt(ctxMois);
      const blob = await generateEtatGlobal({
        soccod, soclib: sessionStorage.getItem('soclib') || '',
        datedebut: formatDate(new Date(year, month - 1, 1).toISOString()),
        datefin: formatDate(new Date(year, month, 0).toISOString()),
        data: [{
          empmat: selectedEmp.empMat, emplib: selectedEmp.empLib, empreg: selectedEmp.empReg,
          jourtrv: totals.nbJours ?? 0, tothre: (totals.tothre ?? 0).toFixed(2),
          jferier: totals.jourFerier ?? 0, jftrv: totals.nbJourFerier ?? 0,
          hftrv: (totals.nbhFerierTrv ?? 0).toFixed(2), hnuit: (totals.hreNuits ?? 0).toFixed(2),
          jconge: totals.nbJourCngPaye ?? 0, hs50: (totals.heuresSupTranche2 ?? 0).toFixed(2),
          hs25: (totals.heuresSupTranche1 ?? 0).toFixed(2), csf: (totals.csf ?? 0).toFixed(2),
        }],
      });
      downloadPDF(blob, `EtatGlobal_${selectedEmp.empMat}_${ctxMois}_${ctxAnnee}.pdf`);
    } catch { toast.error('Erreur génération rapport'); }
  };

  const handleExportAll = async () => {
    if (!pointageMois.length) { toast.error('Aucune donnée'); return; }
    try {
      const year = parseInt(ctxAnnee), month = parseInt(ctxMois);
      const data: EtatGlobalData[] = pointageMois.map(emp => {
        const t2 = emp.heuresSupplementairesResultats?.reduce((a, r) => ({
          nbJours: a.nbJours + (r.nbJours ?? 0), tothre: a.tothre + (r.tothre ?? 0),
          jourFerier: a.jourFerier + (r.jourFerier ?? 0), nbJourFerier: a.nbJourFerier + (r.nbJourFerier ?? 0),
          nbhFerierTrv: a.nbhFerierTrv + (r.nbhFerierTrv ?? 0), hreNuits: a.hreNuits + (r.hreNuits ?? 0),
          nbJourCngPaye: a.nbJourCngPaye + (r.nbJourCngPaye ?? 0),
          hs50: a.hs50 + (r.heuresSupTranche2 ?? 0), hs25: a.hs25 + (r.heuresSupTranche1 ?? 0),
          csf: a.csf + (r.csf ?? 0),
        }), { nbJours:0,tothre:0,jourFerier:0,nbJourFerier:0,nbhFerierTrv:0,hreNuits:0,nbJourCngPaye:0,hs50:0,hs25:0,csf:0 }) ?? { nbJours:0,tothre:0,jourFerier:0,nbJourFerier:0,nbhFerierTrv:0,hreNuits:0,nbJourCngPaye:0,hs50:0,hs25:0,csf:0 };
        return { empmat: emp.empMat, emplib: emp.empLib, empreg: emp.empReg,
          jourtrv: t2.nbJours, tothre: t2.tothre.toFixed(2), jferier: t2.jourFerier,
          jftrv: t2.nbJourFerier, hftrv: t2.nbhFerierTrv.toFixed(2), hnuit: t2.hreNuits.toFixed(2),
          jconge: t2.nbJourCngPaye, hs50: t2.hs50.toFixed(2), hs25: t2.hs25.toFixed(2), csf: t2.csf.toFixed(2) };
      });
      const blob = await generateEtatGlobal({
        soccod, soclib: sessionStorage.getItem('soclib') || '',
        datedebut: new Date(year, month - 1, 1).toISOString().split('T')[0],
        datefin: new Date(year, month, 0).toISOString().split('T')[0],
        data,
      });
      downloadPDF(blob, `EtatGlobal_Tous_${ctxMois}_${ctxAnnee}.pdf`);
    } catch { toast.error('Erreur génération rapport'); }
  };

  const monthLabel = new Date(parseInt(ctxAnnee), parseInt(ctxMois) - 1, 1)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // Format total hours for display (input is decimal hours, e.g. 59.883 = 59h 53min)
  const formatTotalHours = (decimalHours: number) => {
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);
    if (m === 60) return `${h + 1}h00`;
    if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, '0')}`;
    if (h > 0) return `${h}h`;
    return `${m}min`;
  };

  return (
    <Box className="pdm-container">
      {/* ── Page Header ── */}
      <Box className="pdm-header" sx={{ flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'flex-end' } }}>
        <Box>
          <Typography className="pdm-title" sx={{ fontSize: { xs: '28px', md: '36px' } }}>Pointage du mois</Typography>
          <Typography className="pdm-subtitle">Suivi architectural des heures de présence</Typography>
        </Box>
        <Box className="pdm-header-actions" sx={{ width: { xs: '100%', md: 'auto' }, justifyContent: { xs: 'flex-start', md: 'flex-end' }, flexWrap: 'wrap' }}>
          <Tooltip title="Rapport employé sélectionné">
            <IconButton className="pdm-export-btn" onClick={handleExportOne} disabled={!selectedEmp}
              sx={{ borderRadius: '12px', padding: '10px' }}>
              <PictureAsPdfIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Rapport tous les employés">
            <IconButton className="pdm-export-btn" onClick={handleExportAll} disabled={!pointageMois.length}
              sx={{ borderRadius: '12px', padding: '10px' }}>
              <PictureAsPdfIcon />
            </IconButton>
          </Tooltip>
          {canModify && <IntegrationPaieButton pointageMoisData={pointageMois as any} rubriques={rubriques} mois={ctxMois} annee={ctxAnnee} />}
          <Button className="pdm-export-btn" startIcon={<DownloadIcon />} onClick={handleExportAll} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            Exporter
          </Button>
        </Box>
      </Box>

      {/* ── Filter Bar ── */}
      <Paper className="pdm-filter-bar" elevation={0}>
        <Box className="pdm-filter-grid">
          <Box className="pdm-filter-field">
            <label>Employés</label>
            <FormControl size="small" fullWidth>
              <Select multiple value={selectedEmpcods} onChange={(e) => setSelectedEmpcods(e.target.value as string[])}
                renderValue={(sel) => `${(sel as string[]).length} sélectionné(s)`}
                sx={{ borderRadius: '12px', backgroundColor: '#fff', fontSize: '13px' }}>
                {Object.entries(employeesLibs).map(([k, v]) => (
                  <MenuItem key={k} value={k}>{String(v)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box className="pdm-filter-field">
            <label>Filiale</label>
            <FormControl size="small" fullWidth>
              <Select value={selectedFiliale} onChange={(e) => setSelectedFiliale(e.target.value)}
                sx={{ borderRadius: '12px', backgroundColor: '#fff', fontSize: '13px' }}>
                <MenuItem value="">Toutes les filiales</MenuItem>
                {Object.entries(filiale).map(([k, v]) => <MenuItem key={k} value={k}>{String(v)}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <Box className="pdm-filter-field">
            <label>Service</label>
            <FormControl size="small" fullWidth>
              <Select value={selectedService} onChange={(e) => setSelectedService(e.target.value)}
                disabled={isManagerScoped}
                sx={{ borderRadius: '12px', backgroundColor: '#fff', fontSize: '13px' }}>
                <MenuItem value="">{isManagerScoped ? 'Mon service' : 'Tous les services'}</MenuItem>
                {Object.entries(services).map(([k, v]) => <MenuItem key={k} value={k}>{String(v)}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <Box className="pdm-filter-field">
            <label>Régime</label>
            <FormControl size="small" fullWidth>
              <Select value={selectedRegime} onChange={(e) => setSelectedRegime(e.target.value)}
                sx={{ borderRadius: '12px', backgroundColor: '#fff', fontSize: '13px' }}>
                <MenuItem value="">Tous les régimes</MenuItem>
                <MenuItem value="M">35 Heures</MenuItem>
                <MenuItem value="H">39 Heures</MenuItem>
                <MenuItem value="F">Forfait Jours</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box className="pdm-filter-field">
            <label>Période</label>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, background: '#fff', borderRadius: '12px', px: 2, py: 0.5 }}>
              <ScheduleIcon sx={{ color: '#0040a1', fontSize: 18 }} />
              <TextField size="small" type="month" variant="standard"
                value={`${ctxAnnee}-${String(ctxMois).padStart(2, '0')}`}
                onChange={(e) => { const [y, m] = e.target.value.split('-'); setAnnee(y); setMois(String(parseInt(m))); }}
                sx={{ '& .MuiInputBase-input': { fontSize: '13px', fontWeight: 500 } }}
                InputProps={{ disableUnderline: true }}
              />
            </Box>
          </Box>
          <Box className="pdm-filter-field pdm-filter-field--action">
            <Button className="pdm-search-btn" startIcon={<SearchIcon />} onClick={handleSearch}>
              Rechercher
            </Button>
          </Box>
        </Box>
        <Box className="pdm-filter-option">
          <input type="checkbox" id="majorer" checked={majorerHeures} onChange={(e) => setMajorerHeures(e.target.checked)}
            style={{ accentColor: '#0040a1' }} />
          <label htmlFor="majorer" style={{ fontSize: 12, color: '#64748b', cursor: 'pointer' }}>
            Majorer heures fériées et congés
          </label>
        </Box>
      </Paper>

      {/* ── Loading ── */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={48} sx={{ color: '#0040a1' }} />
        </Box>
      )}

      {!isLoading && (
        <>
          {/* ── Ledger Table ── */}
          <Paper className="pdm-table-card" elevation={0}>
            {/* Mobile card list (hidden on desktop via CSS) */}
            <Box className="pdm-mobile-ledger">
              {pointageMois.length === 0 ? (
                <Typography sx={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', py: 4 }}>
                  Aucune donnée — sélectionnez des employés et cliquez Rechercher
                </Typography>
              ) : (
                pointageMois.map((emp) => {
                  const weeks = emp.heuresSupplementairesResultats ?? [];
                  const cumul = weeks.reduce((s, r) => s + (r.tothre ?? 0), 0);
                  const isSelected = selectedEmp?.empCod === emp.empCod;
                  return (
                    <Box key={emp.empCod}
                      className={`pdm-mobile-card${isSelected ? ' pdm-mobile-card--selected' : ''}`}
                      onClick={() => setSelectedEmp(isSelected ? null : emp)}>
                      <Box className="pdm-mobile-card-top">
                        <Avatar className="pdm-avatar">{emp.empLib?.charAt(0) ?? '?'}</Avatar>
                        <Box className="pdm-mobile-card-info">
                          <Typography className="pdm-mobile-card-name">{emp.empLib}</Typography>
                          <Typography className="pdm-mobile-card-sub">
                            {emp.empMat} · {emp.empReg}
                          </Typography>
                        </Box>
                        <Chip label={emp.empMat} size="small" className="pdm-mat-chip" />
                      </Box>
                      <Box className="pdm-mobile-weeks">
                        {Array.from({ length: 6 }, (_, i) => {
                          const w = weeks[i];
                          if (!w) return (
                            <Box key={i} className="pdm-mobile-week-chip">
                              <Typography className="pdm-mobile-week-hrs" style={{ color: '#c3c6d6' }}>—</Typography>
                              <Typography className="pdm-mobile-week-label">S{i+1}</Typography>
                            </Box>
                          );
                          const hrs = (w.tothre ?? 0).toFixed(2);
                          const hs = w.hreSupSemaine ?? 0;
                          const abs = w.totalAbsence ?? 0;
                          const conge = w.nbJourCngPaye ?? 0;
                          const mal = w.maladie ?? 0;
                          let label: string;
                          let color: string;
                          if (mal > 0) { label = 'Mal'; color = '#ba1a1a'; }
                          else if (conge > 0) { label = `CP`; color = '#0040a1'; }
                          else if (hs > 0) { label = `+${hs.toFixed(0)}h`; color = '#0040a1'; }
                          else if (abs > 0) { label = `Abs`; color = '#ba1a1a'; }
                          else { label = 'Ok'; color = '#005136'; }
                          return (
                            <Box key={i} className="pdm-mobile-week-chip"
                              onClick={(e) => { e.stopPropagation(); setNumSem(i + 1); setSelectedWeekDetails(w.weekDetails as any); setOpenDialog(true); }}>
                              <Typography className="pdm-mobile-week-hrs">{hrs}</Typography>
                              <Typography className="pdm-mobile-week-label" style={{ color }}>{label}</Typography>
                            </Box>
                          );
                        })}
                      </Box>
                      <Box className="pdm-mobile-cumul">
                        <Typography className="pdm-mobile-cumul-sub">Total mois</Typography>
                        <Typography className="pdm-mobile-cumul-val">{formatTotalHours(cumul)}</Typography>
                      </Box>
                    </Box>
                  );
                })
              )}
            </Box>

            {/* Desktop table (hidden on mobile via CSS) */}
            <Box className="pdm-table-wrap">
              <table className="pdm-table">
                <thead>
                  <tr>
                    <th>Employé</th>
                    <th>Matricule</th>
                    {Array.from({ length: 6 }, (_, i) => <th key={i}>S{i + 1}</th>)}
                    <th className="pdm-th-right">Cumul</th>
                  </tr>
                </thead>
                <tbody>
                  {pointageMois.length === 0 ? (
                    <tr><td colSpan={10} className="pdm-empty">Aucune donnée — sélectionnez des employés et cliquez Rechercher</td></tr>
                  ) : (
                    pointageMois.map((emp) => {
                      const weeks = emp.heuresSupplementairesResultats ?? [];
                      const cumul = weeks.reduce((s, r) => s + (r.tothre ?? 0), 0);
                      const isSelected = selectedEmp?.empCod === emp.empCod;
                      return (
                        <tr key={emp.empCod} className={isSelected ? 'pdm-row--selected' : ''}
                          onClick={() => setSelectedEmp(isSelected ? null : emp)}
                          style={{ cursor: 'pointer' }}>
                          <td>
                            <Box className="pdm-emp-cell">
                              <Avatar className="pdm-avatar">{emp.empLib?.charAt(0) ?? '?'}</Avatar>
                              <Box>
                                <Typography className="pdm-emp-name">{emp.empLib}</Typography>
                                <Typography className="pdm-emp-reg">{emp.empReg}</Typography>
                              </Box>
                            </Box>
                          </td>
                          <td><Chip label={emp.empMat} size="small" className="pdm-mat-chip" /></td>
                          {Array.from({ length: 6 }, (_, i) => {
                            const w = weeks[i];
                            if (!w) return (
                              <td key={i}>
                                <Typography className="pdm-week-hrs" sx={{ color: '#c3c6d6' }}>—</Typography>
                              </td>
                            );
                            const hrs = (w.tothre ?? 0).toFixed(2);
                            const hs = w.hreSupSemaine ?? 0;
                            const abs = w.totalAbsence ?? 0;
                            const conge = w.nbJourCngPaye ?? 0;
                            const mal = w.maladie ?? 0;
                            let label: string;
                            let cls: string;
                            if (mal > 0) { label = 'Maladie'; cls = 'pdm-week-neg'; }
                            else if (conge > 0) { label = `CP (${conge.toFixed(0)}j)`; cls = 'pdm-week-pos'; }
                            else if (hs > 0) { label = `+${hs.toFixed(2)}h`; cls = 'pdm-week-pos'; }
                            else if (abs > 0) { label = `Abs ${abs.toFixed(1)}j`; cls = 'pdm-week-neg'; }
                            else { label = 'Ok'; cls = 'pdm-week-ok'; }
                            return (
                              <td key={i}>
                                <Box className="pdm-week-cell"
                                  onDoubleClick={(e) => { e.stopPropagation(); setNumSem(i + 1); setSelectedWeekDetails(w.weekDetails as any); setOpenDialog(true); }}>
                                  <Typography className="pdm-week-hrs">{hrs}</Typography>
                                  <Typography className={`pdm-week-label ${cls}`}>{label}</Typography>
                                </Box>
                              </td>
                            );
                          })}
                          <td className="pdm-td-right">
                            <Typography className="pdm-cumul">{formatTotalHours(cumul)}</Typography>
                            <Typography className="pdm-cumul-sub">Total mois</Typography>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </Box>
          </Paper>

          {/* ── Detail table for selected employee ── */}
          {selectedEmp && (
            <Paper className="pdm-detail-card" elevation={0}>
              <Box className="pdm-detail-header">
                <Typography className="pdm-detail-title">
                  Détail semaines — {selectedEmp.empLib}
                </Typography>
                <Typography className="pdm-detail-hint">Double-clic sur une ligne pour voir le détail journalier</Typography>
              </Box>
              <TableContainer sx={{ maxHeight: 320 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ backgroundColor: '#e6e8ea', fontWeight: 700, fontSize: 11, color: '#424654' }}>Sem.</TableCell>
                      {WEEK_COLS.map(c => (
                        <TableCell key={c.key} sx={{ backgroundColor: '#e6e8ea', fontWeight: 700, fontSize: 11, color: '#424654', whiteSpace: 'nowrap' }}>
                          {c.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedEmp.heuresSupplementairesResultats?.map((r, idx) => (
                      <TableRow key={idx} hover sx={{ cursor: 'pointer' }}
                        onDoubleClick={() => { setNumSem(idx + 1); setSelectedWeekDetails(r.weekDetails as any); setOpenDialog(true); }}>
                        <TableCell sx={{ fontWeight: 700 }}>{idx + 1}</TableCell>
                        {WEEK_COLS.map(c => (
                          <TableCell key={c.key} sx={{ fontSize: 12 }}>
                            {c.key === 'retard'
                              ? fmtMin(r.retard ?? 0)
                              : c.key === 'caltype'
                              ? (r.caltype ?? '0')
                              : c.fmt
                              ? c.fmt(Number(r[c.key as keyof typeof r]) || 0)
                              : (Number(r[c.key as keyof typeof r]) || 0).toFixed(2)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {totals && (
                      <TableRow sx={{ backgroundColor: '#eff6ff' }}>
                        <TableCell sx={{ fontWeight: 800, color: '#0040a1' }}>Total</TableCell>
                        {WEEK_COLS.map(c => (
                          <TableCell key={c.key} sx={{ fontWeight: 700, color: '#0040a1', fontSize: 12 }}>
                            {c.key === 'retard'
                              ? fmtMin(totals.retard ?? 0)
                              : c.key === 'caltype'
                              ? String(totals.caltype ?? '').slice(-2)
                              : (Number(totals[c.key]) || 0).toFixed(2)}
                          </TableCell>
                        ))}
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* ── Summary Cards ── */}
          <Box className="pdm-summary-grid" sx={{ gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: { xs: 2, md: 4 } }}>
            {/* Total Heures Travaillées - Primary card */}
            <Paper className="pdm-summary-card pdm-summary-card--primary" elevation={0}>
              <Box className="pdm-summary-content">
                <Typography className="pdm-summary-label">Total Heures Travaillées</Typography>
                <Typography className="pdm-summary-value" sx={{ fontSize: { xs: '36px', md: '48px' } }}>{totalHours > 0 ? formatTotalHours(totalHours) : '0h'}</Typography>
                <Box className="pdm-summary-trend">
                  <TrendingUpIcon sx={{ fontSize: 16 }} />
                  <span>{pointageMois.length} employé(s)</span>
                </Box>
              </Box>
              <ScheduleIcon className="pdm-summary-deco" />
            </Paper>

            {/* Heures Supplémentaires - Light card */}
            <Paper className="pdm-summary-card pdm-summary-card--light" elevation={0}>
              <Box className="pdm-summary-content">
                <Typography className="pdm-summary-label pdm-summary-label--dark">Heures Supplémentaires</Typography>
                <Typography className="pdm-summary-value pdm-summary-value--dark" sx={{ fontSize: { xs: '36px', md: '48px' } }}>{totalHS > 0 ? formatTotalHours(totalHS) : '0h'}</Typography>
                <Box className="pdm-summary-trend pdm-summary-trend--green">
                  <CheckCircleIcon sx={{ fontSize: 16 }} />
                  <span>Dans les quotas légaux</span>
                </Box>
              </Box>
            </Paper>

            {/* Jours Absences - Light card */}
            <Paper className="pdm-summary-card pdm-summary-card--light" elevation={0}>
              <Box className="pdm-summary-content">
                <Typography className="pdm-summary-label pdm-summary-label--dark">Jours Fériés / Absences</Typography>
                <Typography className="pdm-summary-value pdm-summary-value--dark" sx={{ fontSize: { xs: '36px', md: '48px' } }}>{totalAbsences.toFixed(0)}j</Typography>
                <Box className="pdm-summary-trend pdm-summary-trend--muted">
                  <EventNoteIcon sx={{ fontSize: 16 }} />
                  <span>{monthLabel}</span>
                </Box>
              </Box>
            </Paper>
          </Box>

          {/* ── Analysis Section ── */}
          <Box className="pdm-analysis-grid" sx={{ gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 4 }}>
            {/* Service distribution */}
            <Paper className="pdm-distrib-card" elevation={0}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                <Typography className="pdm-distrib-title" sx={{ mb: 0 }}>Répartition par Service</Typography>
                <Button sx={{ fontSize: '13px', fontWeight: 700, color: '#0040a1', textTransform: 'none' }}>
                  Voir détails
                </Button>
              </Box>
              <Box className="pdm-distrib-bars">
                {serviceDistrib.length === 0 ? (
                  <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>Aucune donnée</Typography>
                ) : serviceDistrib.map(([svc, hrs]) => {
                  const max = serviceDistrib[0][1];
                  const pct = max > 0 ? (hrs / max) * 100 : 0;
                  return (
                    <Box key={svc} className="pdm-distrib-row">
                      <Box className="pdm-distrib-info">
                        <Typography className="pdm-distrib-name">{svc}</Typography>
                        <Typography className="pdm-distrib-hrs">{hrs.toFixed(0)}h ({pct.toFixed(0)}%)</Typography>
                      </Box>
                      <Box className="pdm-distrib-bar-wrap">
                        <Box className="pdm-distrib-bar" style={{ width: `${pct}%` }} />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Paper>

            {/* Alerts card */}
            <Paper className="pdm-alerts-card" elevation={0}>
              <Box>
                <Typography className="pdm-alerts-title">Alertes</Typography>
                <Typography className="pdm-alerts-sub">Écarts de pointage détectés ce mois-ci.</Typography>
                <Box className="pdm-alert-item pdm-alert-item--warn">
                  <Box className="pdm-alert-icon pdm-alert-icon--warn"><WarningIcon sx={{ color: '#f59e0b', fontSize: 20 }} /></Box>
                  <Box>
                    <Typography className="pdm-alert-title">{retardsCount} Retards récurrents</Typography>
                    <Typography className="pdm-alert-sub">Employé(s) concerné(s)</Typography>
                  </Box>
                </Box>
                <Box className="pdm-alert-item pdm-alert-item--err">
                  <Box className="pdm-alert-icon pdm-alert-icon--err"><ErrorIcon sx={{ color: '#ef4444', fontSize: 20 }} /></Box>
                  <Box>
                    <Typography className="pdm-alert-title">{absNJCount} Oublis de sortie</Typography>
                    <Typography className="pdm-alert-sub">Absences non justifiées</Typography>
                  </Box>
                </Box>
              </Box>
              <button className="pdm-alert-btn" onClick={() => { setTreatedAlerts({}); setAlertFilter('all'); setOpenAlertsDialog(true); }}>Traiter les alertes</button>
            </Paper>
          </Box>
        </>
      )}

      {/* ── Week detail dialog ── */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="lg" fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'Manrope, sans-serif', fontWeight: 800 }}>
          {t('pointageDuMois.weekDetails', { numSem })}
          <IconButton onClick={() => setOpenDialog(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedWeekDetails && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {Object.keys(selectedWeekDetails).map(k => (
                      <TableCell key={k} sx={{ fontWeight: 700, backgroundColor: '#e6e8ea', fontSize: 11, whiteSpace: 'nowrap' }}>
                        {k.substring(0, 10)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    {Object.values(selectedWeekDetails).map((v, i) => (
                      <TableCell key={i} sx={{ fontSize: 12 }}>{v}</TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>
          {snack.msg}
        </Alert>
      </Snackbar>

      {/* ── Alerts Treatment Dialog ── */}
      <Dialog open={openAlertsDialog} onClose={() => setOpenAlertsDialog(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: '16px', fontFamily: 'Manrope, sans-serif' } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, fontSize: '18px', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <WarningIcon sx={{ color: '#f59e0b', fontSize: 24 }} />
            Traitement des Alertes — {monthLabel}
          </Box>
          <IconButton onClick={() => setOpenAlertsDialog(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {/* Stats bar */}
          <Box sx={{ display: 'flex', gap: 2, px: 3, py: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <Chip label={`${alertsData.length} Total`} size="small" sx={{ fontWeight: 700, fontSize: '11px', bgcolor: '#e2e8f0', color: '#334155' }} />
            <Chip label={`${pendingCount} En attente`} size="small" sx={{ fontWeight: 700, fontSize: '11px', bgcolor: '#fef3c7', color: '#92400e' }} />
            <Chip label={`${treatedCount} Traitées`} size="small" sx={{ fontWeight: 700, fontSize: '11px', bgcolor: '#d1fae5', color: '#065f46' }} />
            <Chip label={`${ignoredCount} Ignorées`} size="small" sx={{ fontWeight: 700, fontSize: '11px', bgcolor: '#e2e8f0', color: '#64748b' }} />
          </Box>

          {/* Filter + Actions bar */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {([['all', 'Toutes'], ['retard', 'Retards'], ['absnj', 'Abs. NJ']] as const).map(([val, lbl]) => (
                <Button key={val} size="small"
                  onClick={() => setAlertFilter(val)}
                  sx={{
                    fontWeight: 700, fontSize: '12px', textTransform: 'none', borderRadius: '8px',
                    bgcolor: alertFilter === val ? '#0040a1' : 'transparent',
                    color: alertFilter === val ? '#fff' : '#64748b',
                    '&:hover': { bgcolor: alertFilter === val ? '#003080' : 'rgba(0,64,161,0.05)' },
                  }}>
                  {lbl}
                </Button>
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" startIcon={<DoneAllIcon />}
                onClick={() => {
                  const newTreated = { ...treatedAlerts };
                  filteredAlerts.forEach(a => { if (!newTreated[a.id]) newTreated[a.id] = 'traite'; });
                  setTreatedAlerts(newTreated);
                }}
                sx={{ fontWeight: 700, fontSize: '11px', textTransform: 'none', color: '#059669' }}>
                Tout traiter
              </Button>
              <Button size="small"
                onClick={() => {
                  const newTreated = { ...treatedAlerts };
                  filteredAlerts.forEach(a => { if (!newTreated[a.id]) newTreated[a.id] = 'ignore'; });
                  setTreatedAlerts(newTreated);
                }}
                sx={{ fontWeight: 700, fontSize: '11px', textTransform: 'none', color: '#94a3b8' }}>
                Tout ignorer
              </Button>
            </Box>
          </Box>

          {/* Alerts list */}
          <Box sx={{ maxHeight: 450, overflow: 'auto' }}>
            {filteredAlerts.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <CheckCircleIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 1 }} />
                <Typography sx={{ color: '#94a3b8', fontWeight: 600, fontSize: '14px' }}>
                  Aucune alerte à afficher
                </Typography>
              </Box>
            ) : (
              filteredAlerts.map(alert => {
                const status = treatedAlerts[alert.id];
                const isTraite = status === 'traite';
                const isIgnore = status === 'ignore';
                return (
                  <Box key={alert.id}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 1.5,
                      borderBottom: '1px solid #f1f5f9',
                      bgcolor: isTraite ? 'rgba(5,150,105,0.04)' : isIgnore ? 'rgba(100,116,139,0.04)' : '#fff',
                      opacity: isIgnore ? 0.6 : 1,
                      transition: 'all 0.2s',
                      '&:hover': { bgcolor: isTraite ? 'rgba(5,150,105,0.08)' : isIgnore ? 'rgba(100,116,139,0.06)' : '#f8fafc' },
                    }}>
                    {/* Icon */}
                    <Box sx={{
                      width: 36, height: 36, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      bgcolor: alert.severity === 'warn' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                    }}>
                      {alert.severity === 'warn'
                        ? <WarningIcon sx={{ color: '#f59e0b', fontSize: 18 }} />
                        : <ErrorIcon sx={{ color: '#ef4444', fontSize: 18 }} />}
                    </Box>

                    {/* Info */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                          {alert.empLib}
                        </Typography>
                        <Chip label={alert.empMat} size="small"
                          sx={{ fontSize: '10px', fontWeight: 700, height: 20, bgcolor: '#e2e8f0', color: '#475569' }} />
                        <Chip label={`S${alert.weekIdx}`} size="small"
                          sx={{ fontSize: '10px', fontWeight: 700, height: 20, bgcolor: '#eff6ff', color: '#0040a1' }} />
                      </Box>
                      <Typography sx={{ fontSize: '12px', color: '#64748b', fontWeight: 500, mt: 0.25 }}>
                        {alert.label}
                      </Typography>
                    </Box>

                    {/* Status / Actions */}
                    {isTraite ? (
                      <Chip icon={<CheckIcon sx={{ fontSize: 14 }} />} label="Traité" size="small"
                        sx={{ fontWeight: 700, fontSize: '11px', bgcolor: '#d1fae5', color: '#065f46' }} />
                    ) : isIgnore ? (
                      <Chip label="Ignoré" size="small"
                        sx={{ fontWeight: 700, fontSize: '11px', bgcolor: '#f1f5f9', color: '#94a3b8' }} />
                    ) : (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Marquer comme traité">
                          <IconButton size="small"
                            onClick={() => setTreatedAlerts(prev => ({ ...prev, [alert.id]: 'traite' }))}
                            sx={{ bgcolor: '#d1fae5', color: '#059669', borderRadius: '8px', '&:hover': { bgcolor: '#a7f3d0' } }}>
                            <CheckIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Ignorer">
                          <IconButton size="small"
                            onClick={() => setTreatedAlerts(prev => ({ ...prev, [alert.id]: 'ignore' }))}
                            sx={{ bgcolor: '#f1f5f9', color: '#94a3b8', borderRadius: '8px', '&:hover': { bgcolor: '#e2e8f0' } }}>
                            <CloseIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </Box>
                );
              })
            )}
          </Box>

          {/* Footer actions */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, py: 2, borderTop: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
            <Typography sx={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
              {pendingCount > 0 ? `${pendingCount} alerte(s) en attente` : '✅ Toutes les alertes ont été traitées'}
            </Typography>
            <Button
              variant="contained"
              disabled={pendingCount > 0}
              onClick={() => {
                setSnack({ open: true, msg: `${alertsData.length} alerte(s) traitée(s) avec succès`, sev: 'success' });
                setOpenAlertsDialog(false);
              }}
              sx={{
                fontWeight: 800, textTransform: 'none', borderRadius: '10px', fontSize: '13px',
                bgcolor: pendingCount > 0 ? '#e2e8f0' : '#0040a1',
                color: pendingCount > 0 ? '#94a3b8' : '#fff',
                '&:hover': { bgcolor: pendingCount > 0 ? '#e2e8f0' : '#003080' },
              }}>
              Confirmer le traitement
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

const PointageDuMoisModern = () => {
  const qc = new QueryClient();
  return (
    <QueryClientProvider client={qc}>
      <DateMoisPointageRangeProvider>
        <PointageDuMoisContent />
      </DateMoisPointageRangeProvider>
    </QueryClientProvider>
  );
};

export default PointageDuMoisModern;
