import {
  Box, Typography, Paper, Button, CircularProgress, Avatar,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
  Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Chip, Select, MenuItem, FormControl,
  TextField, Snackbar, Alert,
} from '@mui/material';
import { useMemo, useState, useEffect } from 'react';
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
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { toast } from 'react-toastify';
import { DateMoisPointageRangeProvider, useDateMoisPointageRange } from './FilterPointageMoisContext';
import useGetPointageMois from '../../../hooks/pointagemoisHooks/useGetPointageMois';
import useGetRubriquesPaire from '../../../hooks/rubriqueHooks/useGetRubriquePaire';
import IntegrationPaieButton from '../../helper/IntegrationPaieButton';
import PointageMensuelExportButton from './PointageMensuelExportButton';
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

// Stable enum keys for week status used for CSS class selection.
type WeekStatusKey = 'ok' | 'sick' | 'paidLeave' | 'overtime' | 'absence';

interface WeekStatus {
  key: WeekStatusKey;
  // numeric value used by some labels (overtime amount, paid leave days, absence days)
  value?: number;
}

const classifyWeekStatus = (w: { maladie?: number; nbJourCngPaye?: number; hreSupSemaine?: number; totalAbsence?: number } | undefined): WeekStatus | null => {
  if (!w) return null;
  const mal = w.maladie ?? 0;
  const conge = w.nbJourCngPaye ?? 0;
  const hs = w.hreSupSemaine ?? 0;
  const abs = w.totalAbsence ?? 0;
  if (mal > 0) return { key: 'sick' };
  if (conge > 0) return { key: 'paidLeave', value: conge };
  if (hs > 0) return { key: 'overtime', value: hs };
  if (abs > 0) return { key: 'absence', value: abs };
  return { key: 'ok' };
};

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Résout le matricule à afficher pour un employé. `empMat` est le matricule
 * « public » (généralement zéro-paddé, ex: "000003"). Quand il n'est pas saisi
 * en base, on retombe sur `empCode` (PK technique mais lisible) plutôt que d'afficher
 * un tiret — l'utilisateur veut au moins voir UNE référence stable de l'employé.
 */
const resolveMatricule = (emp: { empMat?: string | null; empCode?: string | null }): string =>
  (emp.empMat?.trim() || emp.empCode?.trim() || '');

const fmtMin = (minutes: number) => {
  const h = Math.floor(Math.round(minutes) / 60);
  const m = Math.round(minutes) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * Formate un nombre d'heures SANS arrondir à 2 décimales (qui masquait des
 * écarts payroll : 5h04 affiché en 5.07h ou 5.04h selon le contexte).
 * On conserve la précision réelle, en plafonnant à 4 décimales pour éviter
 * le bruit du flottant ("5.916666666666667" → "5.9167") et en supprimant
 * les zéros de queue ("5.0" → "5", "5.10" → "5.1").
 */
const fmtHours = (v: number | null | undefined): string => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return '0';
  return Number(n.toFixed(4)).toString();
};

/**
 * Variante 2 décimales pour le tableau "détail hebdomadaire" du dialog
 * employé : sur cet écran l'utilisateur veut une lecture rapide des cumuls
 * (heures repos, heures travaillées, etc.) — la précision flottante au-delà
 * de 2 décimales nuit à la lisibilité dans une grille dense.
 */
const fmtHours2 = (v: number | null | undefined): string => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(2);
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
// Column keys are stable identifiers; localized labels are looked up via t('pointageMois.detail.columns.<key>')
const WEEK_COLS: Array<{ key: string; fmt?: (v: number) => string }> = [
  { key: 'tothre' },
  { key: 'nbJours' },
  { key: 'retard', fmt: (v: number) => fmtMin(v) },
  { key: 'heuresSupTranche1' },
  { key: 'heuresSupTranche2' },
  { key: 'hreSupSemaine' },
  { key: 'jourFerier' },
  { key: 'heureFerier' },
  { key: 'nbhFerierTrv' },
  { key: 'hreFerieTrv' },
  { key: 'hreFerieTrv2' },
  { key: 'nbJourFerier' },
  { key: 'hreAllaitement' },
  { key: 'absnp' },
  { key: 'totalAbsence' },
  { key: 'nbJourPointer' },
  { key: 'panier' },
  { key: 'nbNuits' },
  { key: 'nbJourCngPaye' },
  { key: 'nbHeureConge' },
  { key: 'hcsf' },
  { key: 'heuresNormales' },
  { key: 'jourRepos' },
  { key: 'hreNuits' },
  { key: 'heureRepos' },
  { key: 'deplacement' },
  { key: 'act' },
  { key: 'fm' },
  { key: 'absj' },
  { key: 'ct' },
  { key: 'maladie' },
  { key: 'absnj' },
  { key: 'csf' },
  { key: 'css' },
  { key: 'map' },
  { key: 'jourSamediTrv' },
  { key: 'hreSamediTrv' },
];

// ── Main inner component ─────────────────────────────────────────────────────
function PointageDuMoisContent() {
  const { soccod, isManager, sercod: managerSercod, hasPermission } = useAuth();
  const { t } = useTranslation();
  const isManagerScoped = Boolean(isManager && managerSercod);

  const canModify = hasPermission('Paie et Rémunération', 'modify');

  if (!hasPermission('Paie et Rémunération', 'consult')) {
    return <AccessDenied message={t('pointageMois.noConsultRight')} />;
  }
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
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);
  const [treatedAlerts, setTreatedAlerts] = useState<Record<string, 'traite' | 'ignore'>>({});
  const [alertFilter, setAlertFilter] = useState<'all' | 'retard' | 'absnj'>('all');
  const [showGuide, setShowGuide] = useState(false);
  // Recherche locale dans le dropdown employés (utile dès 20+ employés).
  const [empSearch, setEmpSearch] = useState('');
  // Filtre rapide post-recherche : on garde la requête initiale et on filtre côté client
  // la liste affichée pour pointer instantanément les employés à problème.
  type QuickFilter = 'all' | 'retard' | 'absnj' | 'poste';
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');

  // Le hook est typé `Record<string,string>[]` (le générique d'ApiClient.getAllWithParams),
  // mais l'API renvoie en réalité un dictionnaire unique `{ empcod: emplib }`. On normalise
  // ici en passant par `unknown` pour ne pas avoir à recaster à chaque usage.
  const { data: employeesLibsRaw } = useGetEmployeesLibs(selectedFiliale, selectedService, undefined, selectedRegime);
  const employeesLibs: Record<string, string> = (employeesLibsRaw as unknown as Record<string, string>) ?? {};
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

  // Liste affichée : on applique le quickFilter sur pointageMois (les KPIs et
  // graphes globaux gardent la base complète pour rester représentatifs du mois).
  const displayedPointageMois = useMemo(() => {
    if (quickFilter === 'all') return pointageMois;
    return pointageMois.filter(e => {
      const weeks = e.heuresSupplementairesResultats ?? [];
      if (quickFilter === 'retard') return weeks.some(r => (r.retard ?? 0) > 30);
      if (quickFilter === 'absnj') return weeks.some(r => (r.absnj ?? 0) > 0);
      if (quickFilter === 'poste') return weeks.some(r => (r.missingPosteDates ?? []).length > 0);
      return true;
    });
  }, [pointageMois, quickFilter]);

  // ── Alerts data ──
  const alertsData = useMemo(() => {
    const alerts: {
      id: string; type: 'retard' | 'absnj'; empCode: string; empLib: string; empMat: string;
      weekIdx: number; value: number; label: string; severity: 'warn' | 'err';
    }[] = [];
    pointageMois.forEach(emp => {
      (emp.heuresSupplementairesResultats ?? []).forEach((r, idx) => {
        if ((r.retard ?? 0) > 30) {
          alerts.push({
            id: `${emp.empCode}-retard-S${idx + 1}`,
            type: 'retard', empCode: emp.empCode, empLib: emp.empLib, empMat: emp.empMat,
            weekIdx: idx + 1, value: r.retard ?? 0,
            label: t('pointageMois.alerts.delayLabel', { time: fmtMin(r.retard ?? 0), week: idx + 1 }),
            severity: 'warn',
          });
        }
        if ((r.absnj ?? 0) > 0) {
          alerts.push({
            id: `${emp.empCode}-absnj-S${idx + 1}`,
            type: 'absnj', empCode: emp.empCode, empLib: emp.empLib, empMat: emp.empMat,
            weekIdx: idx + 1, value: r.absnj ?? 0,
            label: t('pointageMois.alerts.absenceLabel', { value: (r.absnj ?? 0).toFixed(1), week: idx + 1 }),
            severity: 'err',
          });
        }
      });
    });
    return alerts;
  }, [pointageMois, t]);

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

  // Nav période : prev/next bascule mois (et année si overflow).
  const shiftMonth = (delta: number) => {
    let y = parseInt(annee, 10);
    let m = parseInt(mois, 10) + delta;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setAnnee(String(y));
    setMois(String(m));
  };

  // Réinitialise tous les filtres locaux (sans relancer la recherche : l'utilisateur
  // doit cliquer Rechercher après pour matérialiser le changement côté tableau).
  const handleResetFilters = () => {
    setSelectedEmpcods([]);
    setEmpSearch('');
    setSelectedFiliale('');
    if (!isManagerScoped) setSelectedService('');
    setSelectedRegime('');
    setMois(getCurrentMonth());
    setAnnee(getCurrentYear());
    setMajorerHeures(false);
    setQuickFilter('all');
  };

  // Liste employés filtrée par la recherche locale.
  const filteredEmployeesEntries = useMemo(() => {
    const term = empSearch.trim().toLowerCase();
    const entries = Object.entries(employeesLibs);
    if (!term) return entries;
    return entries.filter(([code, name]) =>
      code.toLowerCase().includes(term) || String(name).toLowerCase().includes(term));
  }, [employeesLibs, empSearch]);

  const handleSearch = () => {
    // Sélection vide = "Tous les employés" → on injecte la liste complète chargée
    // par le hook (filtrée par filiale/service/régime). Avant on bloquait avec un
    // warning, ce qui imposait une sélection manuelle inutile.
    const empcodsToSearch = selectedEmpcods.length === 0
      ? Object.keys(employeesLibs)
      : selectedEmpcods;

    if (empcodsToSearch.length === 0) {
      setSnack({ open: true, msg: t('pointageMois.filters.noEmployeeAvailable'), sev: 'warning' });
      return;
    }

    setDateRange?.((prev: any) => ({
      ...prev, mois, annee,
      selectedFiliale, selectedService, selectedRegime,
      semaine: '0', empcods: empcodsToSearch,
    }));
  };

  // Totals for selected employee
  const totals = useMemo(() => {
    if (!selectedEmp?.heuresSupplementairesResultats) return null;
    return selectedEmp.heuresSupplementairesResultats.reduce((acc, r) => {
      WEEK_COLS.forEach(({ key }) => {
        if (key === 'retard') { acc[key] = (acc[key] ?? 0) + (r.retard ?? 0); }
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

  // Jours fériés + jours d'absence (j Ouvrable, j Justifié, j Non Justifié, j Non Payé).
  // `totalAbsence` côté backend agrège des HEURES (cf. OptimizedPresenceService.cs:456),
  // donc on ne l'utilise PAS ici — on additionne les compteurs en jours.
  const totalHolidayAbsenceDays = useMemo(() =>
    pointageMois.reduce((sum, emp) =>
      sum + (emp.heuresSupplementairesResultats?.reduce((s, r) =>
        s + (r.nbJourFerier ?? 0) + (r.absj ?? 0) + (r.absnj ?? 0) + (r.absnp ?? 0), 0) ?? 0), 0),
    [pointageMois]);

  // Total absence en heures (utile pour le sous-titre du KPI).
  const totalAbsenceHours = useMemo(() =>
    pointageMois.reduce((sum, emp) =>
      sum + (emp.heuresSupplementairesResultats?.reduce((s, r) => s + (r.totalAbsence ?? 0), 0) ?? 0), 0),
    [pointageMois]);

  // Service distribution
  const otherLabel = t('pointageMois.distribution.other');
  const serviceDistrib = useMemo(() => {
    const map: Record<string, number> = {};
    pointageMois.forEach(emp => {
      const svc = services[emp.empSite] || emp.empSite || otherLabel;
      const hrs = emp.heuresSupplementairesResultats?.reduce((s, r) => s + (r.tothre ?? 0), 0) ?? 0;
      map[svc] = (map[svc] ?? 0) + hrs;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [pointageMois, services, otherLabel]);

  // Alert counts
  const retardsCount = useMemo(() =>
    pointageMois.filter(e => e.heuresSupplementairesResultats?.some(r => (r.retard ?? 0) > 30)).length,
    [pointageMois]);

  const absNJCount = useMemo(() =>
    pointageMois.filter(e => e.heuresSupplementairesResultats?.some(r => (r.absnj ?? 0) > 0)).length,
    [pointageMois]);

  const employesAvecPosteManquant = useMemo(() =>
    pointageMois.filter(e =>
      e.heuresSupplementairesResultats?.some(r => (r.missingPosteDates ?? []).length > 0)
    ).length,
    [pointageMois]);

  const handleExportOne = async () => {
    if (!selectedEmp || !totals) { toast.error(t('pointageMois.errors.selectEmployee')); return; }
    try {
      const year = parseInt(ctxAnnee), month = parseInt(ctxMois);
      const blob = await generateEtatGlobal({
        soccod, soclib: sessionStorage.getItem('soclib') || '',
        datedebut: formatDate(new Date(year, month - 1, 1).toISOString()),
        datefin: formatDate(new Date(year, month, 0).toISOString()),
        data: [{
          empmat: resolveMatricule(selectedEmp), emplib: selectedEmp.empLib, empreg: selectedEmp.empReg,
          jourtrv: totals.nbJours ?? 0, tothre: fmtHours(totals.tothre),
          jferier: totals.jourFerier ?? 0, jftrv: totals.nbJourFerier ?? 0,
          hftrv: fmtHours(totals.nbhFerierTrv), hnuit: fmtHours(totals.hreNuits),
          jconge: totals.nbJourCngPaye ?? 0, hs50: fmtHours(totals.heuresSupTranche2),
          hs25: fmtHours(totals.heuresSupTranche1), csf: fmtHours(totals.csf),
        }],
      });
      downloadPDF(blob, `EtatGlobal_${resolveMatricule(selectedEmp) || selectedEmp.empCode}_${ctxMois}_${ctxAnnee}.pdf`);
    } catch { toast.error(t('pointageMois.errors.reportError')); }
  };

  const handleExportAll = async () => {
    if (!pointageMois.length) { toast.error(t('pointageMois.errors.noData')); return; }
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
        return { empmat: resolveMatricule(emp), emplib: emp.empLib, empreg: emp.empReg,
          jourtrv: t2.nbJours, tothre: fmtHours(t2.tothre), jferier: t2.jourFerier,
          jftrv: t2.nbJourFerier, hftrv: fmtHours(t2.nbhFerierTrv), hnuit: fmtHours(t2.hreNuits),
          jconge: t2.nbJourCngPaye, hs50: fmtHours(t2.hs50), hs25: fmtHours(t2.hs25), csf: fmtHours(t2.csf) };
      });
      const blob = await generateEtatGlobal({
        soccod, soclib: sessionStorage.getItem('soclib') || '',
        datedebut: new Date(year, month - 1, 1).toISOString().split('T')[0],
        datefin: new Date(year, month, 0).toISOString().split('T')[0],
        data,
      });
      downloadPDF(blob, `EtatGlobal_Tous_${ctxMois}_${ctxAnnee}.pdf`);
    } catch { toast.error(t('pointageMois.errors.reportError')); }
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

  // Map week status enum key → CSS class for desktop / mobile rendering
  const statusToClass = (key: WeekStatusKey): string => {
    switch (key) {
      case 'sick': return 'pdm-week-neg';
      case 'paidLeave': return 'pdm-week-pos';
      case 'overtime': return 'pdm-week-pos';
      case 'absence': return 'pdm-week-neg';
      case 'ok':
      default: return 'pdm-week-ok';
    }
  };

  const statusToMobileColor = (key: WeekStatusKey): string => {
    switch (key) {
      case 'sick': return '#ba1a1a';
      case 'paidLeave': return '#0040a1';
      case 'overtime': return '#0040a1';
      case 'absence': return '#ba1a1a';
      case 'ok':
      default: return '#005136';
    }
  };

  // Localized week label given a stable status key + numeric value
  const labelForStatus = (st: WeekStatus, short: boolean): string => {
    switch (st.key) {
      case 'sick': return short ? t('pointageMois.table.labels.sickShort') : t('pointageMois.table.labels.sick');
      case 'paidLeave': return short
        ? t('pointageMois.table.labels.paidLeaveShort')
        : t('pointageMois.table.labels.paidLeave', { count: Math.round(st.value ?? 0) });
      case 'overtime': return t('pointageMois.table.labels.overtime', {
        value: short ? (st.value ?? 0).toFixed(0) : (st.value ?? 0).toFixed(2),
      });
      case 'absence': return short
        ? t('pointageMois.table.labels.absenceShort')
        : t('pointageMois.table.labels.absence', { value: (st.value ?? 0).toFixed(1) });
      case 'ok':
      default: return short ? t('pointageMois.table.labels.okShort') : t('pointageMois.table.labels.ok');
    }
  };

  return (
    <Box className="pdm-container">
      {/* ── Page Header ── */}
      <Box className="pdm-header" sx={{ flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'flex-end' } }}>
        <Box>
          <Typography className="pdm-title" sx={{ fontSize: { xs: '28px', md: '36px' } }}>{t('pointageMois.title')}</Typography>
          <Typography className="pdm-subtitle">{t('pointageMois.subtitle')}</Typography>
        </Box>
        <Box className="pdm-header-actions" sx={{ width: { xs: '100%', md: 'auto' }, justifyContent: { xs: 'flex-start', md: 'flex-end' }, flexWrap: 'wrap' }}>
          <Tooltip title={t('pointageMois.exportSelected')}>
            <IconButton className="pdm-export-btn" onClick={handleExportOne} disabled={!selectedEmp}
              sx={{ borderRadius: '12px', padding: '10px' }}>
              <PictureAsPdfIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('pointageMois.exportAll')}>
            <IconButton className="pdm-export-btn" onClick={handleExportAll} disabled={!pointageMois.length}
              sx={{ borderRadius: '12px', padding: '10px' }}>
              <PictureAsPdfIcon />
            </IconButton>
          </Tooltip>
          {canModify && <IntegrationPaieButton pointageMoisData={pointageMois as any} rubriques={rubriques} mois={ctxMois} annee={ctxAnnee} />}
          <PointageMensuelExportButton
            pointageMois={pointageMois}
            mois={ctxMois}
            annee={ctxAnnee}
            soclib={sessionStorage.getItem('soclib') || ''}
            services={services}
          />
          <Tooltip title={showGuide ? 'Masquer le guide' : 'Afficher le guide d\'utilisation'}>
            <IconButton
              onClick={() => setShowGuide(v => !v)}
              sx={{
                borderRadius: '12px', padding: '10px',
                bgcolor: showGuide ? 'rgba(0,64,161,0.1)' : 'transparent',
                color: '#0040a1',
                '&:hover': { bgcolor: 'rgba(0,64,161,0.15)' },
              }}
            >
              <InfoOutlinedIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Guide d'utilisation — explique le workflow de la page (recherche →
          consultation → intégration paie) et clarifie comment lever le cas
          fréquent "Lignes à exporter : 0". Replié par défaut, accessible via
          l'icône ⓘ du header. */}
      {showGuide && (
        <Paper elevation={0} sx={{
          mb: 2, p: 2.5, borderRadius: '14px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
          border: '1px solid #bfdbfe',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <InfoOutlinedIcon sx={{ color: '#0040a1', fontSize: 22, flexShrink: 0, mt: '2px' }} />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#0f172a', mb: 1 }}>
                Comment utiliser cette page ?
              </Typography>
              <Box component="ol" sx={{ m: 0, pl: 2.5, fontSize: 13, color: '#334155', lineHeight: 1.7 }}>
                <li><strong>Filtrer & rechercher</strong> &mdash; choisissez la période, la filiale, le service ou les employés ciblés, puis cliquez sur <em>Rechercher</em>.</li>
                <li><strong>Consulter</strong> &mdash; chaque ligne du tableau résume les 6 semaines du mois. Cliquez une ligne pour le détail employé, ou <em>double-cliquez</em> sur une cellule de semaine pour voir le journal jour par jour (présent / congé / repos / férié / absent).</li>
                <li><strong>Exporter en PDF</strong> &mdash; les boutons rouges <em>PDF</em> génèrent l'état global (employé sélectionné ou tous).</li>
                <li><strong>Intégrer la paie</strong> &mdash; le bouton <em>Intégrer</em> produit un fichier Excel à injecter dans votre logiciel de paie (Sage…). Il combine&nbsp;:
                  <Box component="ul" sx={{ pl: 2.5, mt: 0.5 }}>
                    <li>les <strong>employés</strong> chargés ci-dessus,</li>
                    <li>et les <strong>rubriques</strong> que vous avez configurées dans <em>Données de base → Rubriques</em>.</li>
                  </Box>
                </li>
              </Box>
              <Box sx={{ mt: 1.5, p: 1.5, borderRadius: '8px', bgcolor: '#fef9c3', border: '1px solid #fde68a' }}>
                <Typography sx={{ fontSize: 12, color: '#854d0e', lineHeight: 1.5 }}>
                  <strong>« Lignes à exporter : 0 » ?</strong> Cela signifie qu'aucune rubrique de paie n'a encore été
                  rattachée à une variable de pointage. Rendez-vous dans <strong>Données de base → Rubriques</strong> pour
                  créer au moins une rubrique en sélectionnant la <em>variable de pointage</em> source (ex&nbsp;: H.SUPP 25%, Congés payés…).
                </Typography>
              </Box>
            </Box>
          </Box>
        </Paper>
      )}

      {/* ── Filter Bar ── */}
      <Paper className="pdm-filter-bar" elevation={0}>
        <Box className="pdm-filter-grid">
          <Box className="pdm-filter-field" sx={{ position: 'relative' }}>
            <label>{t('pointageMois.filters.employees')}</label>
            <Box
              onClick={() => setShowEmpDropdown(v => !v)}
              sx={{
                cursor: 'pointer', userSelect: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                minHeight: 38, padding: '8px 12px',
                borderRadius: '12px', backgroundColor: '#fff', fontSize: '13px',
                border: '1px solid #e2e8f0',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedEmpcods.length === 0
                  ? t('pointageMois.filters.allEmployees')
                  : selectedEmpcods.length === 1
                    ? String(employeesLibs[selectedEmpcods[0]] || selectedEmpcods[0])
                    : t('pointageMois.filters.selectedCount', { count: selectedEmpcods.length })}
              </span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>▼</span>
            </Box>
            {showEmpDropdown && (
              <Box sx={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1200,
                backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 320, overflowY: 'auto', mt: 0.5,
              }}>
                {/* Recherche locale dans la liste — apparaît dès 6 employés. */}
                {Object.keys(employeesLibs).length > 6 && (
                  <Box sx={{
                    position: 'sticky', top: 0, zIndex: 1, bgcolor: '#fff',
                    padding: '8px 10px', borderBottom: '1px solid #f1f5f9',
                  }}>
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      bgcolor: '#f8fafc', borderRadius: '8px', px: 1.2, py: 0.5,
                      border: '1px solid #e2e8f0',
                    }}>
                      <SearchIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                      <input
                        autoFocus
                        type="text"
                        value={empSearch}
                        onChange={(e) => setEmpSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder={t('pointageMois.filters.searchEmployee', 'Rechercher…') as string}
                        style={{
                          border: 'none', outline: 'none', flex: 1, background: 'transparent',
                          fontSize: 12, color: '#0f172a', fontFamily: 'inherit',
                        }}
                      />
                      {empSearch && (
                        <CloseIcon
                          sx={{ fontSize: 14, color: '#94a3b8', cursor: 'pointer' }}
                          onClick={(e) => { e.stopPropagation(); setEmpSearch(''); }}
                        />
                      )}
                    </Box>
                  </Box>
                )}
                <Box
                  onClick={() => { setSelectedEmpcods([]); setShowEmpDropdown(false); }}
                  sx={{
                    padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1,
                    borderBottom: '1px solid #f1f5f9', fontWeight: 600, fontSize: 13,
                    color: selectedEmpcods.length === 0 ? '#0040a1' : '#334155',
                  }}
                >
                  <input type="checkbox" readOnly checked={selectedEmpcods.length === 0} style={{ accentColor: '#0040a1' }} />
                  {t('pointageMois.filters.allEmployees')}
                </Box>
                {filteredEmployeesEntries.length === 0 && (
                  <Box sx={{ p: 2, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
                    {t('pointageMois.filters.noResults', 'Aucun résultat')}
                  </Box>
                )}
                {filteredEmployeesEntries.map(([code, name]) => {
                  const checked = selectedEmpcods.includes(code);
                  return (
                    <Box
                      key={code}
                      onClick={() =>
                        setSelectedEmpcods(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])
                      }
                      sx={{
                        padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1,
                        fontSize: 13,
                        color: checked ? '#0040a1' : '#334155',
                        backgroundColor: checked ? '#f0f5ff' : 'transparent',
                        '&:hover': { backgroundColor: checked ? '#e6efff' : '#f8fafc' },
                      }}
                    >
                      <input type="checkbox" readOnly checked={checked} style={{ accentColor: '#0040a1' }} />
                      {String(name)}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
          <Box className="pdm-filter-field">
            <label>{t('pointageMois.filters.branch')}</label>
            <FormControl size="small" fullWidth>
              <Select value={selectedFiliale} onChange={(e) => setSelectedFiliale(e.target.value)}
                sx={{ borderRadius: '12px', backgroundColor: '#fff', fontSize: '13px' }}>
                <MenuItem value="">{t('pointageMois.filters.allBranches')}</MenuItem>
                {Object.entries(filiale).map(([k, v]) => <MenuItem key={k} value={k}>{String(v)}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <Box className="pdm-filter-field">
            <label>{t('pointageMois.filters.service')}</label>
            <FormControl size="small" fullWidth>
              <Select value={selectedService} onChange={(e) => setSelectedService(e.target.value)}
                disabled={isManagerScoped}
                sx={{ borderRadius: '12px', backgroundColor: '#fff', fontSize: '13px' }}>
                <MenuItem value="">{isManagerScoped ? t('pointageMois.filters.myService') : t('pointageMois.filters.allServices')}</MenuItem>
                {Object.entries(services).map(([k, v]) => <MenuItem key={k} value={k}>{String(v)}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <Box className="pdm-filter-field">
            <label>{t('pointageMois.filters.regime')}</label>
            <FormControl size="small" fullWidth>
              <Select value={selectedRegime} onChange={(e) => setSelectedRegime(e.target.value)}
                sx={{ borderRadius: '12px', backgroundColor: '#fff', fontSize: '13px' }}>
                <MenuItem value="">{t('pointageMois.filters.allRegimes')}</MenuItem>
                <MenuItem value="M">{t('pointageMois.filters.regimeMonthly')}</MenuItem>
                <MenuItem value="H">{t('pointageMois.filters.regimeHourly')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box className="pdm-filter-field">
            <label>{t('pointageMois.filters.period')}</label>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, background: '#fff', borderRadius: '12px', px: 1, py: 0.5 }}>
              <Tooltip title={t('pointageMois.filters.prevMonth', 'Mois précédent') as string}>
                <IconButton size="small" onClick={() => shiftMonth(-1)} sx={{ p: 0.5, color: '#0040a1' }}>
                  <KeyboardArrowLeftIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <ScheduleIcon sx={{ color: '#0040a1', fontSize: 18 }} />
              <TextField size="small" type="month" variant="standard"
                value={`${ctxAnnee}-${String(ctxMois).padStart(2, '0')}`}
                onChange={(e) => { const [y, m] = e.target.value.split('-'); setAnnee(y); setMois(String(parseInt(m))); }}
                sx={{ '& .MuiInputBase-input': { fontSize: '13px', fontWeight: 500 } }}
                InputProps={{ disableUnderline: true }}
              />
              <Tooltip title={t('pointageMois.filters.nextMonth', 'Mois suivant') as string}>
                <IconButton size="small" onClick={() => shiftMonth(1)} sx={{ p: 0.5, color: '#0040a1' }}>
                  <KeyboardArrowRightIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          {/* Action zone : largeur fixe pour ne pas étirer Rechercher sur tout l'espace
              disponible (avant: flex:1 → bouton démesurément large quand la grille a
              de la place). 160 px = lecture confortable de "Rechercher" sans dominer. */}
          <Box
            className="pdm-filter-field pdm-filter-field--action"
            sx={{
              gap: 1,
              display: 'flex',
              flex: '0 0 auto',
              minWidth: { xs: '100%', sm: 220 },
              maxWidth: { xs: '100%', sm: 220 },
            }}
          >
            <Button className="pdm-search-btn" startIcon={<SearchIcon />} onClick={handleSearch} sx={{ flex: 1, minWidth: 0 }}>
              {t('pointageMois.filters.search')}
            </Button>
            <Tooltip title={t('pointageMois.filters.reset', 'Réinitialiser les filtres') as string}>
              <IconButton
                onClick={handleResetFilters}
                sx={{
                  borderRadius: '12px', height: 40, width: 40, flexShrink: 0,
                  bgcolor: '#fff', border: '1px solid #e2e8f0', color: '#64748b',
                  '&:hover': { bgcolor: '#f8fafc', color: '#0040a1', borderColor: '#bfdbfe' },
                }}
              >
                <RestartAltIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        {/* Checkbox "Majorer" alignée à droite — calée sur la même verticale que le bouton
            Rechercher (qui termine la grille filtres). Garde une largeur cohérente :
            sur mobile elle s'étale, sur desktop elle reste compacte côté droit. */}
        <Box
          className="pdm-filter-option"
          sx={{
            display: 'flex',
            justifyContent: { xs: 'flex-start', sm: 'flex-end' },
            alignItems: 'center',
            mt: 1,
          }}
        >
          <input type="checkbox" id="majorer" checked={majorerHeures} onChange={(e) => setMajorerHeures(e.target.checked)}
            style={{ accentColor: '#0040a1' }} />
          <label htmlFor="majorer" style={{ fontSize: 12, color: '#64748b', cursor: 'pointer' }}>
            {t('pointageMois.filters.majorHolidays')}
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
          {/* ── Quick filters : drill-down par type de problème ── */}
          {pointageMois.length > 0 && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
              mb: 2, px: 0.5,
            }}>
              <FilterAltIcon sx={{ fontSize: 16, color: '#64748b' }} />
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mr: 0.5 }}>
                {t('pointageMois.quickFilter.label', 'Filtre rapide')}
              </Typography>
              {([
                ['all',     t('pointageMois.quickFilter.all', 'Tous'),                pointageMois.length],
                ['retard',  t('pointageMois.quickFilter.delays', 'Avec retards'),     retardsCount],
                ['absnj',   t('pointageMois.quickFilter.absNJ', 'Absences NJ'),       absNJCount],
                ['poste',   t('pointageMois.quickFilter.missingPoste', 'Poste manquant'), employesAvecPosteManquant],
              ] as const).map(([val, lbl, count]) => {
                const active = quickFilter === val;
                const disabled = (val !== 'all') && (count as number) === 0;
                return (
                  <Chip
                    key={val as string}
                    size="small"
                    label={`${lbl} · ${count}`}
                    onClick={disabled ? undefined : () => setQuickFilter(val as QuickFilter)}
                    sx={{
                      fontWeight: 700, fontSize: 11, height: 26, borderRadius: '8px',
                      bgcolor: active ? '#0040a1' : disabled ? '#f1f5f9' : '#fff',
                      color: active ? '#fff' : disabled ? '#cbd5e1' : '#475569',
                      border: '1px solid',
                      borderColor: active ? '#0040a1' : '#e2e8f0',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      '&:hover': { bgcolor: active ? '#003080' : disabled ? '#f1f5f9' : '#f8fafc' },
                    }}
                  />
                );
              })}
              {quickFilter !== 'all' && displayedPointageMois.length !== pointageMois.length && (
                <Typography sx={{ fontSize: 11, color: '#64748b', ml: 'auto' }}>
                  {t('pointageMois.quickFilter.showing', '{{shown}} sur {{total}} employés', {
                    shown: displayedPointageMois.length, total: pointageMois.length,
                  })}
                </Typography>
              )}
            </Box>
          )}

          {/* ── Ledger Table ── */}
          <Paper className="pdm-table-card" elevation={0}>
            {/* Mobile card list (hidden on desktop via CSS) */}
            <Box className="pdm-mobile-ledger">
              {displayedPointageMois.length === 0 ? (
                <Typography sx={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', py: 4 }}>
                  {t('pointageMois.table.noData')}
                </Typography>
              ) : (
                displayedPointageMois.map((emp) => {
                  const weeks = emp.heuresSupplementairesResultats ?? [];
                  const cumul = weeks.reduce((s, r) => s + (r.tothre ?? 0), 0);
                  const isSelected = selectedEmp?.empCode === emp.empCode;
                  return (
                    <Box key={emp.empCode}
                      className={`pdm-mobile-card${isSelected ? ' pdm-mobile-card--selected' : ''}`}
                      onClick={() => { setSelectedEmp(emp); setOpenDetailDialog(true); }}>
                      <Box className="pdm-mobile-card-top">
                        <Avatar className="pdm-avatar">{emp.empLib?.charAt(0) ?? '?'}</Avatar>
                        <Box className="pdm-mobile-card-info">
                          <Typography className="pdm-mobile-card-name">{emp.empLib}</Typography>
                          <Typography className="pdm-mobile-card-sub">
                            {(() => { const m = resolveMatricule(emp); return m ? `#${m}` : '—'; })()} · {emp.empReg}
                          </Typography>
                        </Box>
                        <Chip label={resolveMatricule(emp) || '—'} size="small" className="pdm-mat-chip" />
                      </Box>
                      <Box className="pdm-mobile-weeks">
                        {Array.from({ length: 6 }, (_, i) => {
                          const w = weeks[i];
                          if (!w) return (
                            <Box key={i} className="pdm-mobile-week-chip">
                              <Typography className="pdm-mobile-week-hrs" style={{ color: '#c3c6d6' }}>—</Typography>
                              <Typography className="pdm-mobile-week-label">{t('pointageMois.table.weekShort', { n: i + 1 })}</Typography>
                            </Box>
                          );
                          const hrs = fmtHours(w.tothre);
                          const status = classifyWeekStatus(w)!;
                          const label = labelForStatus(status, true);
                          const color = statusToMobileColor(status.key);
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
                        <Typography className="pdm-mobile-cumul-sub">{t('pointageMois.table.totalMonth')}</Typography>
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
                    <th>{t('pointageMois.table.employee')}</th>
                    <th>{t('pointageMois.table.matricule')}</th>
                    {Array.from({ length: 6 }, (_, i) => <th key={i}>{t('pointageMois.table.weekShort', { n: i + 1 })}</th>)}
                    <th className="pdm-th-right">{t('pointageMois.table.cumul')}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedPointageMois.length === 0 ? (
                    <tr><td colSpan={10} className="pdm-empty">{t('pointageMois.table.noData')}</td></tr>
                  ) : (
                    displayedPointageMois.map((emp) => {
                      const weeks = emp.heuresSupplementairesResultats ?? [];
                      const cumul = weeks.reduce((s, r) => s + (r.tothre ?? 0), 0);
                      const isSelected = selectedEmp?.empCode === emp.empCode;
                      return (
                        <tr key={emp.empCode} className={isSelected ? 'pdm-row--selected' : ''}
                          onClick={() => { setSelectedEmp(emp); setOpenDetailDialog(true); }}
                          style={{ cursor: 'pointer' }}>
                          <td>
                            <Box className="pdm-emp-cell">
                              <Avatar className="pdm-avatar">{emp.empLib?.charAt(0) ?? '?'}</Avatar>
                              <Box>
                                <Typography className="pdm-emp-name">{emp.empLib}</Typography>
                                <Typography className="pdm-emp-reg">
                                  {(() => { const m = resolveMatricule(emp); return m ? `#${m}` : '—'; })()} · {emp.empReg}
                                </Typography>
                              </Box>
                            </Box>
                          </td>
                          <td>
                            <Chip label={resolveMatricule(emp) || '—'} size="small" className="pdm-mat-chip" />
                          </td>
                          {Array.from({ length: 6 }, (_, i) => {
                            const w = weeks[i];
                            if (!w) return (
                              <td key={i}>
                                <Typography className="pdm-week-hrs" sx={{ color: '#c3c6d6' }}>—</Typography>
                              </td>
                            );
                            const hrs = fmtHours(w.tothre);
                            const status = classifyWeekStatus(w)!;
                            const label = labelForStatus(status, false);
                            const cls = statusToClass(status.key);
                            return (
                              <td key={i}>
                                <Box
                                  className="pdm-week-cell"
                                  // Stoppe le clic single avant qu'il ne remonte au <tr> (qui
                                  // ouvrirait la fiche employé). Le double-clic n'ouvre ainsi
                                  // QUE le détail de la semaine, sans empiler 2 dialogs.
                                  onClick={(e) => e.stopPropagation()}
                                  onDoubleClick={(e) => { e.stopPropagation(); setNumSem(i + 1); setSelectedWeekDetails(w.weekDetails as any); setOpenDialog(true); }}
                                >
                                  <Typography className="pdm-week-hrs">{hrs}</Typography>
                                  <Typography className={`pdm-week-label ${cls}`}>{label}</Typography>
                                </Box>
                              </td>
                            );
                          })}
                          <td className="pdm-td-right">
                            <Typography className="pdm-cumul">{formatTotalHours(cumul)}</Typography>
                            <Typography className="pdm-cumul-sub">{t('pointageMois.table.totalMonth')}</Typography>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </Box>
          </Paper>

          {/* Detail table for selected employee — shown in popup, see <Dialog> below */}

          {/* ── Summary Cards ── */}
          <Box className="pdm-summary-grid" sx={{ gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: { xs: 2, md: 4 } }}>
            {/* Total Heures Travaillées - Primary card */}
            <Paper className="pdm-summary-card pdm-summary-card--primary" elevation={0}>
              <Box className="pdm-summary-content">
                <Typography className="pdm-summary-label">{t('pointageMois.summary.totalHours')}</Typography>
                <Typography className="pdm-summary-value" sx={{ fontSize: { xs: '36px', md: '48px' } }}>{totalHours > 0 ? formatTotalHours(totalHours) : '0h'}</Typography>
                <Box className="pdm-summary-trend">
                  <TrendingUpIcon sx={{ fontSize: 16 }} />
                  <span>{t('pointageMois.summary.employeesCount', { count: pointageMois.length })}</span>
                </Box>
              </Box>
              <ScheduleIcon className="pdm-summary-deco" />
            </Paper>

            {/* Heures Supplémentaires - Light card */}
            <Paper className="pdm-summary-card pdm-summary-card--light" elevation={0}>
              <Box className="pdm-summary-content">
                <Typography className="pdm-summary-label pdm-summary-label--dark">{t('pointageMois.summary.overtime')}</Typography>
                <Typography className="pdm-summary-value pdm-summary-value--dark" sx={{ fontSize: { xs: '36px', md: '48px' } }}>{totalHS > 0 ? formatTotalHours(totalHS) : '0h'}</Typography>
                <Box className="pdm-summary-trend pdm-summary-trend--green">
                  <CheckCircleIcon sx={{ fontSize: 16 }} />
                  <span>{t('pointageMois.summary.withinLegalQuotas')}</span>
                </Box>
              </Box>
            </Paper>

            {/* Jours Absences - Light card */}
            <Paper className="pdm-summary-card pdm-summary-card--light" elevation={0}>
              <Box className="pdm-summary-content">
                <Typography className="pdm-summary-label pdm-summary-label--dark">{t('pointageMois.summary.holidaysAbsences')}</Typography>
                <Typography className="pdm-summary-value pdm-summary-value--dark" sx={{ fontSize: { xs: '36px', md: '48px' } }}>{totalHolidayAbsenceDays.toFixed(0)}j</Typography>
                <Box className="pdm-summary-trend pdm-summary-trend--muted">
                  <EventNoteIcon sx={{ fontSize: 16 }} />
                  <span>{totalAbsenceHours > 0 ? `${monthLabel} · ${formatTotalHours(totalAbsenceHours)}` : monthLabel}</span>
                </Box>
              </Box>
            </Paper>
          </Box>

          {/* ── Analysis Section ── */}
          <Box className="pdm-analysis-grid" sx={{ gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 4 }}>
            {/* Service distribution */}
            <Paper className="pdm-distrib-card" elevation={0}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                <Typography className="pdm-distrib-title" sx={{ mb: 0 }}>{t('pointageMois.distribution.title')}</Typography>
                <Button sx={{ fontSize: '13px', fontWeight: 700, color: '#0040a1', textTransform: 'none' }}>
                  {t('pointageMois.distribution.viewDetails')}
                </Button>
              </Box>
              <Box className="pdm-distrib-bars">
                {serviceDistrib.length === 0 ? (
                  <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>{t('pointageMois.distribution.noData')}</Typography>
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
                <Typography className="pdm-alerts-title">{t('pointageMois.alerts.title')}</Typography>
                <Typography className="pdm-alerts-sub">{t('pointageMois.alerts.subtitle')}</Typography>
                <Box className="pdm-alert-item pdm-alert-item--warn">
                  <Box className="pdm-alert-icon pdm-alert-icon--warn"><WarningIcon sx={{ color: '#f59e0b', fontSize: 20 }} /></Box>
                  <Box>
                    <Typography className="pdm-alert-title">{t('pointageMois.alerts.recurringDelays', { count: retardsCount })}</Typography>
                    <Typography className="pdm-alert-sub">{t('pointageMois.alerts.concernedEmployees')}</Typography>
                  </Box>
                </Box>
                <Box className="pdm-alert-item pdm-alert-item--err">
                  <Box className="pdm-alert-icon pdm-alert-icon--err"><ErrorIcon sx={{ color: '#ef4444', fontSize: 20 }} /></Box>
                  <Box>
                    <Typography className="pdm-alert-title">{t('pointageMois.alerts.exitOmissions', { count: absNJCount })}</Typography>
                    <Typography className="pdm-alert-sub">{t('pointageMois.alerts.unjustifiedAbsences')}</Typography>
                  </Box>
                </Box>
                {employesAvecPosteManquant > 0 && (
                  <Box className="pdm-alert-item pdm-alert-item--err">
                    <Box className="pdm-alert-icon pdm-alert-icon--err"><ErrorIcon sx={{ color: '#ef4444', fontSize: 20 }} /></Box>
                    <Box>
                      <Typography className="pdm-alert-title">{t('pointageMois.alerts.missingPoste', { count: employesAvecPosteManquant })}</Typography>
                      <Typography className="pdm-alert-sub">{t('pointageMois.alerts.checkAttachments')}</Typography>
                    </Box>
                  </Box>
                )}
              </Box>
              <button className="pdm-alert-btn" onClick={() => { setTreatedAlerts({}); setAlertFilter('all'); setOpenAlertsDialog(true); }}>{t('pointageMois.alerts.treatBtn')}</button>
            </Paper>
          </Box>
        </>
      )}

      {/* ── Employee weekly breakdown dialog ── */}
      <Dialog open={openDetailDialog && !!selectedEmp} onClose={() => setOpenDetailDialog(false)} maxWidth="xl" fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'Manrope, sans-serif', fontWeight: 800 }}>
          <Box>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
              {selectedEmp ? t('pointageMois.detail.title', { name: selectedEmp.empLib }) : ''}
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 500, mt: 0.5 }}>
              {t('pointageMois.detail.hint')}
            </Typography>
          </Box>
          <IconButton onClick={() => setOpenDetailDialog(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {selectedEmp && (
            <TableContainer sx={{ maxHeight: '65vh' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ backgroundColor: '#e6e8ea', fontWeight: 700, fontSize: 11, color: '#424654' }}>{t('pointageMois.detail.weekShort')}</TableCell>
                    {WEEK_COLS.map(c => (
                      <TableCell key={c.key} sx={{ backgroundColor: '#e6e8ea', fontWeight: 700, fontSize: 11, color: '#424654', whiteSpace: 'nowrap' }}>
                        {t(`pointageMois.detail.columns.${c.key}`)}
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
                            : c.fmt
                            ? c.fmt(Number(r[c.key as keyof typeof r]) || 0)
                            : fmtHours2(Number(r[c.key as keyof typeof r]))}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {totals && (
                    <TableRow sx={{ backgroundColor: '#eff6ff' }}>
                      <TableCell sx={{ fontWeight: 800, color: '#0040a1' }}>{t('pointageMois.detail.total')}</TableCell>
                      {WEEK_COLS.map(c => (
                        <TableCell key={c.key} sx={{ fontWeight: 700, color: '#0040a1', fontSize: 12 }}>
                          {c.key === 'retard'
                            ? fmtMin(totals.retard ?? 0)
                            : fmtHours2(Number(totals[c.key]))}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Week detail dialog — vue jour par jour ──
          Avant : keys = dates en colonnes, valeurs = 1 seule ligne. Lecture
          horizontale fastidieuse au-delà de 3 jours. Maintenant : 1 ligne par
          jour avec date, jour de la semaine, et statut typé (chip coloré). */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'Manrope, sans-serif', fontWeight: 800 }}>
          <Box>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
              {t('pointageDuMois.weekDetails', { numSem })}
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 500, mt: 0.5 }}>
              Détail jour par jour : statut, type d'absence ou heures pointées.
            </Typography>
          </Box>
          <IconButton onClick={() => setOpenDialog(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedWeekDetails && (() => {
            // Le backend émet des chaînes typées : "Présent: HH:mm",
            // "Congé[code]: …", "Sanction[code]: …", "Férié", "Repos", "Absent".
            // Cf. OptimizedPresenceService.GetWeekDetails. On classe pour colorer
            // la chip et faire ressortir d'un coup d'œil les écarts.
            const statusOf = (raw: string): { kind: string; bg: string; fg: string; icon: string } => {
              const v = (raw ?? '').trim();
              if (v.startsWith('Présent')) return { kind: 'Présent', bg: '#d1fae5', fg: '#065f46', icon: '✓' };
              if (v.startsWith('Congé'))   return { kind: 'Congé',   bg: '#dbeafe', fg: '#1e40af', icon: '🌴' };
              if (v.startsWith('Sanction')) return { kind: 'Sanction', bg: '#fee2e2', fg: '#991b1b', icon: '⚠' };
              if (v === 'Férié')           return { kind: 'Férié',   bg: '#fef3c7', fg: '#92400e', icon: '★' };
              if (v === 'Repos')           return { kind: 'Repos',   bg: '#f1f5f9', fg: '#475569', icon: '☾' };
              if (v === 'Absent')          return { kind: 'Absent',  bg: '#fef2f2', fg: '#b91c1c', icon: '×' };
              return { kind: v || '—', bg: '#f1f5f9', fg: '#475569', icon: '•' };
            };
            const fmtDate = (k: string) => {
              const d = new Date(k);
              if (isNaN(d.getTime())) return k.substring(0, 10);
              return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'short' });
            };
            const entries = Object.entries(selectedWeekDetails);
            return (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, backgroundColor: '#e6e8ea', fontSize: 11, color: '#424654', whiteSpace: 'nowrap' }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700, backgroundColor: '#e6e8ea', fontSize: 11, color: '#424654' }}>Statut</TableCell>
                      <TableCell sx={{ fontWeight: 700, backgroundColor: '#e6e8ea', fontSize: 11, color: '#424654' }}>Détail</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {entries.length === 0 ? (
                      <TableRow><TableCell colSpan={3} sx={{ textAlign: 'center', color: '#94a3b8', py: 3 }}>Aucun détail pour cette semaine.</TableCell></TableRow>
                    ) : entries.map(([dateKey, raw], idx) => {
                      const st = statusOf(raw);
                      const detail = raw && raw.includes(':') ? raw.substring(raw.indexOf(':') + 1).trim() : '';
                      return (
                        <TableRow key={idx} hover>
                          <TableCell sx={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                            {fmtDate(dateKey)}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={`${st.icon} ${st.kind}`}
                              sx={{ bgcolor: st.bg, color: st.fg, fontWeight: 700, fontSize: 11 }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, color: '#475569' }}>{detail || '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            );
          })()}
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
            {t('pointageMois.alerts.dialogTitle', { period: monthLabel })}
          </Box>
          <IconButton onClick={() => setOpenAlertsDialog(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {/* Stats bar */}
          <Box sx={{ display: 'flex', gap: 2, px: 3, py: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <Chip label={t('pointageMois.alerts.totalChip', { count: alertsData.length })} size="small" sx={{ fontWeight: 700, fontSize: '11px', bgcolor: '#e2e8f0', color: '#334155' }} />
            <Chip label={t('pointageMois.alerts.pendingChip', { count: pendingCount })} size="small" sx={{ fontWeight: 700, fontSize: '11px', bgcolor: '#fef3c7', color: '#92400e' }} />
            <Chip label={t('pointageMois.alerts.treatedChip', { count: treatedCount })} size="small" sx={{ fontWeight: 700, fontSize: '11px', bgcolor: '#d1fae5', color: '#065f46' }} />
            <Chip label={t('pointageMois.alerts.ignoredChip', { count: ignoredCount })} size="small" sx={{ fontWeight: 700, fontSize: '11px', bgcolor: '#e2e8f0', color: '#64748b' }} />
          </Box>

          {/* Filter + Actions bar */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {([
                ['all', t('pointageMois.alerts.filterAll')],
                ['retard', t('pointageMois.alerts.filterDelays')],
                ['absnj', t('pointageMois.alerts.filterAbsences')],
              ] as const).map(([val, lbl]) => (
                <Button key={val} size="small"
                  onClick={() => setAlertFilter(val as 'all' | 'retard' | 'absnj')}
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
                {t('pointageMois.alerts.treatAll')}
              </Button>
              <Button size="small"
                onClick={() => {
                  const newTreated = { ...treatedAlerts };
                  filteredAlerts.forEach(a => { if (!newTreated[a.id]) newTreated[a.id] = 'ignore'; });
                  setTreatedAlerts(newTreated);
                }}
                sx={{ fontWeight: 700, fontSize: '11px', textTransform: 'none', color: '#94a3b8' }}>
                {t('pointageMois.alerts.ignoreAll')}
              </Button>
            </Box>
          </Box>

          {/* Alerts list */}
          <Box sx={{ maxHeight: 450, overflow: 'auto' }}>
            {filteredAlerts.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <CheckCircleIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 1 }} />
                <Typography sx={{ color: '#94a3b8', fontWeight: 600, fontSize: '14px' }}>
                  {t('pointageMois.alerts.noAlerts')}
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
                        <Chip label={t('pointageMois.alerts.weekShort', { n: alert.weekIdx })} size="small"
                          sx={{ fontSize: '10px', fontWeight: 700, height: 20, bgcolor: '#eff6ff', color: '#0040a1' }} />
                      </Box>
                      <Typography sx={{ fontSize: '12px', color: '#64748b', fontWeight: 500, mt: 0.25 }}>
                        {alert.label}
                      </Typography>
                    </Box>

                    {/* Status / Actions */}
                    {isTraite ? (
                      <Chip icon={<CheckIcon sx={{ fontSize: 14 }} />} label={t('pointageMois.alerts.treatedBadge')} size="small"
                        sx={{ fontWeight: 700, fontSize: '11px', bgcolor: '#d1fae5', color: '#065f46' }} />
                    ) : isIgnore ? (
                      <Chip label={t('pointageMois.alerts.ignoredBadge')} size="small"
                        sx={{ fontWeight: 700, fontSize: '11px', bgcolor: '#f1f5f9', color: '#94a3b8' }} />
                    ) : (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title={t('pointageMois.alerts.markTreated')}>
                          <IconButton size="small"
                            onClick={() => setTreatedAlerts(prev => ({ ...prev, [alert.id]: 'traite' }))}
                            sx={{ bgcolor: '#d1fae5', color: '#059669', borderRadius: '8px', '&:hover': { bgcolor: '#a7f3d0' } }}>
                            <CheckIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('pointageMois.alerts.ignore')}>
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
              {pendingCount > 0
                ? t('pointageMois.alerts.pendingFooter', { count: pendingCount })
                : t('pointageMois.alerts.allTreated')}
            </Typography>
            <Button
              variant="contained"
              disabled={pendingCount > 0}
              onClick={() => {
                setSnack({ open: true, msg: t('pointageMois.alerts.successProcessed', { count: alertsData.length }), sev: 'success' });
                setOpenAlertsDialog(false);
              }}
              sx={{
                fontWeight: 800, textTransform: 'none', borderRadius: '10px', fontSize: '13px',
                bgcolor: pendingCount > 0 ? '#e2e8f0' : '#0040a1',
                color: pendingCount > 0 ? '#94a3b8' : '#fff',
                '&:hover': { bgcolor: pendingCount > 0 ? '#e2e8f0' : '#003080' },
              }}>
              {t('pointageMois.alerts.confirmTreatment')}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

const PointageDuMoisModern = () => {
  return (
    <DateMoisPointageRangeProvider>
        <PointageDuMoisContent />
      </DateMoisPointageRangeProvider>
  );
};

export default PointageDuMoisModern;
