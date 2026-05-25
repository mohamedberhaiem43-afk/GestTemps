import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, CircularProgress, Alert, Avatar, Chip, Button, Skeleton,
  Select, MenuItem, FormControl, Dialog, DialogTitle, DialogContent, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper,
  Switch, FormControlLabel, Stack, Tooltip, Menu, ListItemIcon, ListItemText, Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import ScheduleIcon from '@mui/icons-material/Schedule';
import MoreTimeIcon from '@mui/icons-material/MoreTime';
import WcIcon from '@mui/icons-material/Wc';
import PaymentsIcon from '@mui/icons-material/Payments';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import FilterListIcon from '@mui/icons-material/FilterList';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import TuneIcon from '@mui/icons-material/Tune';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import BoltIcon from '@mui/icons-material/Bolt';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DescriptionIcon from '@mui/icons-material/Description';
import ArticleIcon from '@mui/icons-material/Article';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../helper/AuthProvider';
import useGetDashboardData from '../../hooks/dashboardHooks/useGetDashboardData';
import useGetEvolution from '../../hooks/dashboardHooks/useGetEvolution';
import useGetPointagesInvalides from '../../hooks/dashboardHooks/useGetPointagesInvalides';
import useGetDirectionLibs from '../../hooks/directionHooks/useGetDirectionLibs';
import useGetExpiringContracts, { type ExpiringContract } from '../../hooks/contractHooks/useGetExpiringContracts';
import { DashboardRequest } from '../../models/DashboardModels';
import { CongeProvider } from '../helper/CongeContext';
import DashboardCongeList from './DashboardCongeList';
import EvolutionChart from './Bars/EvolutionChart';
import GenderDonutChart from './Bars/GenderDonutChart';
import './DashboardModern.css';
import EmployeeDashboard from './EmployeeDashboard';
import useGetPendingDemCongesByPeriode from '../../hooks/congeHooks/useGetPendingDemConge';
import RefreshIcon from '@mui/icons-material/Refresh';
import RenewContractDialog from '../gestionEmploye/GestionContrats/RenewContractDialog';
import { Contrat } from '../../models/Contrat';
import OnboardingGuide from './OnboardingGuide';
import React from 'react';
import { AnimatedNumber } from '../shared/AnimatedNumber';

const AVATAR_COLORS = ['#0040a1', '#047857', '#b45309', '#6d28d9', '#065f46'];

// Hook : anime un nombre de 0 (ou de la valeur précédente) vers `target` sur
// Le hook `useCountUp` + composant `AnimatedNumber` sont extraits dans
// components/shared/AnimatedNumber.tsx (réutilisés par SoldeConge, Remboursement,
// Etats, etc.). On les ré-exporte ici pour ne pas casser les imports existants.

function KpiCard({ icon, label, value, trend, trendLabel, trendPositive, iconBg, iconColor }: {
  icon: React.ReactNode; label: string; value: string | number;
  trend?: number; trendLabel?: string; trendPositive?: boolean;
  iconBg: string; iconColor: string;
}) {
  const isGood = trendPositive ? (trend ?? 0) >= 0 : (trend ?? 0) <= 0;
  return (
    <Box className="db-kpi-card">
      <Box className="db-kpi-top">
        <Box className="db-kpi-icon" style={{ backgroundColor: iconBg, color: iconColor }}>{icon}</Box>
        {trend !== undefined ? (
          <Box className={`db-kpi-badge ${isGood ? 'db-badge-good' : 'db-badge-bad'}`}>
            {isGood ? <TrendingUpIcon sx={{ fontSize: 12 }} /> : <TrendingDownIcon sx={{ fontSize: 12 }} />}
            {Math.abs(trend).toFixed(1)}%
          </Box>
        ) : trendLabel ? (
          <Typography className="db-kpi-badge-neutral">{trendLabel}</Typography>
        ) : null}
      </Box>
      <Typography className="db-kpi-label">{label}</Typography>
      <AnimatedNumber value={value} className="db-kpi-value" />
    </Box>
  );
}

export default function DashboardModern() {
  const { isAdmin, isManager } = useAuth();

  if (!isAdmin && !isManager) return <EmployeeDashboard />;

  return <DashboardModernAdmin />;
}

// Widgets personnalisables — l'utilisateur peut afficher/masquer chaque section.
// Les préférences sont persistées par utilisateur dans localStorage afin que la
// disposition du dashboard suive l'utilisateur d'un device à l'autre (même
// navigateur/profil).
type WidgetKey =
  | 'recap'         // bandeau récap textuel des tâches
  | 'kpis'          // grille des 4 KPI cards
  | 'totalEmployees'// bento "effectif total"
  | 'ongoingLeaves' // bento "congés en cours"
  | 'contractAlerts'// bento "alertes contrat"
  | 'evolution'     // graphique évolution
  | 'absences'      // panel absences récentes
  | 'genderDonut'   // donut effectif H / F
  | 'renewals';     // panel renouvellements

const ALL_WIDGETS: { key: WidgetKey; label: string }[] = [
  { key: 'recap', label: 'Récapitulatif des tâches' },
  { key: 'kpis', label: 'Indicateurs clés (KPI)' },
  { key: 'totalEmployees', label: 'Effectif total' },
  { key: 'ongoingLeaves', label: 'Congés en cours' },
  { key: 'contractAlerts', label: 'Alertes contrat' },
  { key: 'evolution', label: '📈 Évolution des Présences et Heures Travaillées' },
  { key: 'absences', label: 'Absences récentes' },
  { key: 'genderDonut', label: 'Répartition Hommes / Femmes' },
  { key: 'renewals', label: 'Prochains renouvellements' },
];

const DEFAULT_VISIBILITY: Record<WidgetKey, boolean> = {
  recap: true, kpis: true, totalEmployees: true, ongoingLeaves: true,
  contractAlerts: true, evolution: true, absences: true, genderDonut: true, renewals: true,
};

function loadVisibility(soccod: string | undefined | null): Record<WidgetKey, boolean> {
  if (!soccod) return DEFAULT_VISIBILITY;
  try {
    const raw = localStorage.getItem(`dashboardWidgets_${soccod}`);
    if (!raw) return DEFAULT_VISIBILITY;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_VISIBILITY, ...parsed };
  } catch { return DEFAULT_VISIBILITY; }
}

function DashboardModernAdmin() {
  const { t } = useTranslation();
  const { soccod, planAllows } = useAuth();
  // Pack Starter = dashboard simplifié (sans masse salariale, sans alertes contrat,
  // sans graphiques). Le flag serveur AdvancedDashboards est la source de vérité.
  // Les utilisateurs Standard/Business gardent la version complète.
  const advancedDashboards = planAllows('advancedDashboards');
  const [filterDateRange, setFilterDateRange] = useState<'today' | 'week' | 'month'>('today');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [openCongeDialog, setOpenCongeDialog] = useState(false);
  const [openPointageDialog, setOpenPointageDialog] = useState(false);
  const [openContractDialog, setOpenContractDialog] = useState(false);
  const [renewTarget, setRenewTarget] = useState<Contrat | null>(null);
  const [openCustomize, setOpenCustomize] = useState(false);
  const [visibility, setVisibility] = useState<Record<WidgetKey, boolean>>(() => loadVisibility(soccod));
  const [quickAnchor, setQuickAnchor] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();

  // Persister à chaque changement, et resync si soccod change (multi-tenant).
  useEffect(() => { setVisibility(loadVisibility(soccod)); }, [soccod]);
  useEffect(() => {
    if (!soccod) return;
    try { localStorage.setItem(`dashboardWidgets_${soccod}`, JSON.stringify(visibility)); }
    catch { /* quota plein, on ignore */ }
  }, [visibility, soccod]);

  const toggleWidget = (key: WidgetKey) =>
    setVisibility((v) => ({ ...v, [key]: !v[key] }));
  const resetWidgets = () => setVisibility(DEFAULT_VISIBILITY);

  const { data: expiringContractsData } = useGetExpiringContracts(soccod);
  const expiringContracts: ExpiringContract[] = expiringContractsData ?? [];
  const { data: directionsResponse } = useGetDirectionLibs();
  const directionLibs = useMemo(() => {
    if (!directionsResponse || typeof directionsResponse !== 'object') return [];
    return Object.entries(directionsResponse).map(([code, label]) => ({ dircod: code, dirlib: label }));
  }, [directionsResponse]);

  const dateRange = useMemo(() => {
    const now = dayjs();
    switch (filterDateRange) {
      case 'today': return { dateDebut: now.startOf('day').toISOString(), dateFin: now.endOf('day').toISOString() };
      case 'week': return { dateDebut: now.startOf('week').add(1, 'day').toISOString(), dateFin: now.endOf('week').add(1, 'day').toISOString() };
      case 'month': return { dateDebut: now.startOf('month').toISOString(), dateFin: now.endOf('month').toISOString() };
    }
  }, [filterDateRange]);

  const dashboardRequest: DashboardRequest | null = useMemo(() => {
    if (!soccod || !dateRange) return null;
    return { soccod, dateDebut: dateRange.dateDebut, dateFin: dateRange.dateFin, dateRange: filterDateRange, departement: filterDepartment === 'all' ? null : filterDepartment, empcods: [] };
  }, [soccod, filterDepartment, dateRange, filterDateRange]);

  const { data: dashboardData, isLoading, error } = useGetDashboardData(dashboardRequest);
  const { data: evolutionData, isLoading: loadingEvolution } = useGetEvolution(dashboardRequest);

  // Demandes de congé en attente — fenêtre VOLONTAIREMENT large (1 an dans le
  // passé + 2 ans dans le futur), indépendante du filtre période du dashboard.
  // Pourquoi : l'endpoint /get-pending-demconge-by-periode filtre par les DATES
  // DE CONGÉ demandées, pas par la date de soumission. Avant ce fix, un salarié
  // qui demandait un congé pour le mois suivant n'apparaissait PAS dans le badge
  // « X demande(s) à valider » du dashboard quand le filtre était sur « Ce mois »,
  // alors que l'admin doit pouvoir valider ces demandes dès qu'elles sont créées.
  // Désormais le badge reflète bien TOUTES les demandes en attente que l'admin a
  // à traiter, quelle que soit la période de congé visée.
  const pendingDemandesDebut = useMemo(() => dayjs().subtract(1, 'year').format('YYYY-MM-DD'), []);
  const pendingDemandesFin   = useMemo(() => dayjs().add(2, 'year').format('YYYY-MM-DD'), []);
  const { data: demandesData, isLoading: loadingDemandes } = useGetPendingDemCongesByPeriode(pendingDemandesDebut, pendingDemandesFin, true);
  const { data: pointagesData, isLoading: loadingPointages, error: errorPointages } = useGetPointagesInvalides(dashboardRequest, openPointageDialog);

  const today = dayjs().format('DD MMMM YYYY');

  const presenceRate = dashboardData ? ((dashboardData.effectifPresent / Math.max(dashboardData.effectifTotal || 1, 1)) * 100).toFixed(1) : '--';
  const absenceRate = dashboardData ? (100 - parseFloat(presenceRate as string)).toFixed(1) : '--';

  const handleExportReport = () => {
    const lines: string[] = [];
    const sep = ';'; // CSV semicolon for French Excel

    // Title
    lines.push(`Rapport Tableau de Bord - ${today}`);
    lines.push(`Période: ${filterDateRange === 'today' ? "Aujourd'hui" : filterDateRange === 'week' ? 'Cette semaine' : 'Ce mois'}`);
    lines.push(`Département: ${filterDepartment === 'all' ? 'Tous' : filterDepartment}`);
    lines.push('');

    // KPIs
    lines.push('=== INDICATEURS CLÉS ===');
    lines.push(`Taux de Présence;${presenceRate}%`);
    lines.push(`Taux d'Absentéisme;${absenceRate}%`);
    lines.push(`Ponctualité;${dashboardData?.pourcentagePonctualite != null ? `${dashboardData.pourcentagePonctualite.toFixed(1)}%` : '--'}`);
    lines.push(`Heures Supp. Cumulées;${dashboardData?.heuresTravaillees != null ? `${dashboardData.heuresTravaillees.toFixed(0)} hrs` : '--'}`);
    lines.push(`Effectif Total;${dashboardData?.effectifTotal ?? '--'}`);
    lines.push(`Effectif Présent;${dashboardData?.effectifPresent ?? '--'}`);
    lines.push(`Total Absences;${dashboardData?.totalAbsences ?? 0}`);
    lines.push(`Employés en Retard;${dashboardData?.nombreEmployesEnRetard ?? 0}`);
    lines.push(`Minutes Retard Cumulées;${dashboardData?.nombreRetards ?? 0}`);
    lines.push(`Demandes en Attente;${dashboardData?.totalDemandesEnAttente ?? 0}`);
    // Effectif par sexe + masse salariale — exposés à plat dans le CSV pour
    // permettre des reportings RH cumulés (ex : pyramide H/F par site).
    lines.push(`Effectif Hommes;${dashboardData?.effectifParSexe?.['M'] ?? 0}`);
    lines.push(`Effectif Femmes;${dashboardData?.effectifParSexe?.['F'] ?? 0}`);
    if ((dashboardData?.effectifParSexe?.['Autre'] ?? 0) > 0) {
      lines.push(`Effectif Autre;${dashboardData?.effectifParSexe?.['Autre'] ?? 0}`);
    }
    lines.push(`Masse Salariale (brute, €);${dashboardData?.masseSalariale != null ? dashboardData.masseSalariale.toFixed(2) : '--'}`);
    lines.push('');

    // Absences récentes
    if (dashboardData && dashboardData.totalAbsences > 0) {
      lines.push('=== ABSENCES DU JOUR ===');
      lines.push(`Total Absences;${dashboardData.totalAbsences}`);
      lines.push('');
    }

    // Congés en attente
    if (demandesData && demandesData.length > 0) {
      lines.push('=== DEMANDES DE CONGÉ EN ATTENTE ===');
      lines.push(['Matricule', 'Employé', 'Type', 'Date Début', 'Date Fin', 'Statut'].join(sep));
      demandesData.forEach((d: any) => {
        lines.push([d.empcod || '', d.emplib || '', d.cgntype || '', d.cgndatedebut ? dayjs(d.cgndatedebut).format('DD/MM/YYYY') : '', d.cgndatefin ? dayjs(d.cgndatefin).format('DD/MM/YYYY') : '', d.cgnstatut || 'En attente'].join(sep));
      });
      lines.push('');
    }

    // Contrats échus
    if (expiringContracts.length > 0) {
      lines.push('=== CONTRATS ÉCHUS CE MOIS ===');
      lines.push(['Matricule', 'Employé', 'Type', 'Date Échéance', 'Jours Restants'].join(sep));
      expiringContracts.forEach((c: any) => {
        const daysLeft = c.empsort ? Math.ceil((new Date(c.empsort).getTime() - Date.now()) / 86400000) : 0;
        lines.push([c.empcod || '', c.emplib || '', c.contype || 'CDD', c.empsort ? dayjs(c.empsort).format('DD/MM/YYYY') : '', `${daysLeft}j`].join(sep));
      });
      lines.push('');
    }

    // Pointages invalides
    if (pointagesData && pointagesData.length > 0) {
      lines.push('=== POINTAGES NON COMPLÈTES ===');
      lines.push(['Matricule', 'Nom', 'Département', 'Date', 'Arrivée', 'Départ', 'Commentaire'].join(sep));
      pointagesData.forEach((row: any) => {
        lines.push([row.empcod || '', row.emplib || '', row.departement || '', row.predat ? dayjs(row.predat).format('DD/MM/YYYY') : '', row.preentmatup || '', row.presortamidiup || row.presortmatup || '', row.motif || ''].join(sep));
      });
      lines.push('');
    }

    // Le CSV historique est conserv\u00E9 en commentaire pour tra\u00E7abilit\u00E9 \u2014 l'export
    // produit d\u00E9sormais un PDF pr\u00E9sentable (jspdf + autotable).
    void lines; // legacy var, plus utilis\u00E9e

    // \u2500\u2500 PDF pr\u00E9sentable \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;

    // Palette assortie au dashboard (db-* dans DashboardModern.css).
    const C_PRIMARY: [number, number, number] = [0, 64, 161];
    const C_PRIMARY_LIGHT: [number, number, number] = [218, 226, 255];
    const C_SUCCESS: [number, number, number] = [4, 120, 87];
    const C_WARN: [number, number, number] = [180, 83, 9];
    const C_DANGER: [number, number, number] = [186, 26, 26];
    const C_TEXT: [number, number, number] = [25, 28, 30];
    const C_MUTED: [number, number, number] = [115, 119, 133];

    // Header bandeau couleur primaire.
    doc.setFillColor(...C_PRIMARY);
    doc.rect(0, 0, pageW, 32, 'F');
    doc.setFillColor(...C_PRIMARY_LIGHT);
    doc.rect(0, 30, pageW, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('RAPPORT TABLEAU DE BORD', margin, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const periodeLabel = filterDateRange === 'today'
      ? "Aujourd'hui"
      : filterDateRange === 'week' ? 'Cette semaine' : 'Ce mois';
    doc.text(
      `G\u00E9n\u00E9r\u00E9 le ${dayjs().format('DD/MM/YYYY HH:mm')}  \u2022  P\u00E9riode : ${periodeLabel}  \u2022  D\u00E9partement : ${filterDepartment === 'all' ? 'Tous' : filterDepartment}`,
      margin, 22
    );

    let y = 42;

    // Synth\u00E8se ex\u00E9cutive : 3 phrases neutres, lisibles d'un coup d'\u0153il.
    doc.setTextColor(...C_TEXT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Synth\u00E8se ex\u00E9cutive', margin, y);
    y += 6;

    const summaryLines = [
      `Sur la p\u00E9riode, ${dashboardData?.effectifPresent ?? 0} employ\u00E9(s) pr\u00E9sents sur ${dashboardData?.effectifTotal ?? 0} (${presenceRate}%).`,
      `${dashboardData?.totalAbsences ?? 0} absence(s) enregistr\u00E9e(s) et ${dashboardData?.nombreEmployesEnRetard ?? 0} retard(s).`,
      `${dashboardData?.totalDemandesEnAttente ?? 0} demande(s) en attente de validation.`,
    ];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...C_MUTED);
    summaryLines.forEach((line) => {
      doc.text(`\u2022  ${line}`, margin, y);
      y += 5;
    });
    y += 4;

    // KPI cards 2x2 \u2014 bordure l\u00E9g\u00E8re, accent gauche color\u00E9, valeur en gros.
    const cardW = (pageW - margin * 2 - 8) / 2;
    const cardH = 24;
    const drawKpiCard = (
      x: number, yPos: number, label: string, value: string,
      accent: [number, number, number]
    ) => {
      doc.setDrawColor(...C_PRIMARY_LIGHT);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, yPos, cardW, cardH, 2, 2, 'FD');
      doc.setFillColor(...accent);
      doc.rect(x, yPos, 3, cardH, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C_MUTED);
      doc.text(label.toUpperCase(), x + 8, yPos + 7);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(...accent);
      doc.text(value, x + 8, yPos + 18);
    };

    const kpiX1 = margin;
    const kpiX2 = margin + cardW + 8;

    drawKpiCard(kpiX1, y, 'Taux de pr\u00E9sence', `${presenceRate}%`, C_PRIMARY);
    drawKpiCard(kpiX2, y, 'Ponctualit\u00E9', dashboardData?.pourcentagePonctualite != null
      ? `${Number(dashboardData.pourcentagePonctualite).toFixed(1)}%` : '--', C_SUCCESS);
    y += cardH + 6;
    drawKpiCard(kpiX1, y, 'Heures suppl\u00E9mentaires (sem.)',
      '--', C_WARN);
    drawKpiCard(kpiX2, y, 'Demandes en attente',
      `${dashboardData?.totalDemandesEnAttente ?? 0}`, C_DANGER);
    y += cardH + 8;

    // \u2500\u2500\u2500 DONUT \u00AB Effectif par sexe \u00BB \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // Couleurs align\u00E9es sur GenderDonutChart.tsx (#0040a1 / #d946ef / #94a3b8)
    // pour que l'export soit visuellement coh\u00E9rent avec la version \u00E9cran.
    // Trac\u00E9 par approximation polygonale via doc.lines() \u2014 \u00E9vite la d\u00E9pendance
    // \u00E0 doc.context2d (qui rend mal certains arcs dans jsPDF 4.x).
    const genderM = dashboardData?.effectifParSexe?.['M'] ?? 0;
    const genderF = dashboardData?.effectifParSexe?.['F'] ?? 0;
    const genderAutre = dashboardData?.effectifParSexe?.['Autre'] ?? 0;
    const genderTotal = genderM + genderF + genderAutre;

    if (genderTotal > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...C_TEXT);
      doc.text('Effectif par sexe', margin, y);
      y += 4;

      const donutCx = margin + 22;
      const donutCy = y + 24;
      const donutOuterR = 22;
      const donutInnerR = 12;

      // Tuples explicites `as [r, g, b]` : sans ça TS infère `number[]` (longueur
      // variable) ce qui casse le spread `doc.setFillColor(...color)` qui exige
      // exactement 3 nombres.
      const slices: { value: number; color: [number, number, number]; label: string }[] = [
        { value: genderM, color: [0, 64, 161] as [number, number, number], label: 'Hommes' },
        { value: genderF, color: [217, 70, 239] as [number, number, number], label: 'Femmes' },
        { value: genderAutre, color: [148, 163, 184] as [number, number, number], label: 'Autre' },
      ].filter((s) => s.value > 0);

      // Trace une part de tarte via polygone radial : centre \u2192 arc \u00E9chantillonn\u00E9 \u2192 centre.
      const drawSlice = (
        cx: number, cy: number, r: number,
        startAngle: number, endAngle: number,
        color: [number, number, number]
      ) => {
        const sweep = endAngle - startAngle;
        const steps = Math.max(6, Math.ceil((sweep * 180 / Math.PI) / 4));
        let px = cx + Math.cos(startAngle) * r;
        let py = cy + Math.sin(startAngle) * r;
        const path: [number, number][] = [[px - cx, py - cy]];
        for (let i = 1; i <= steps; i++) {
          const a = startAngle + (sweep * i) / steps;
          const nx = cx + Math.cos(a) * r;
          const ny = cy + Math.sin(a) * r;
          path.push([nx - px, ny - py]);
          px = nx; py = ny;
        }
        path.push([cx - px, cy - py]);
        doc.setFillColor(...color);
        doc.lines(path, cx, cy, [1, 1], 'F', false);
      };

      let curAngle = -Math.PI / 2;
      slices.forEach((s) => {
        const sweep = (s.value / genderTotal) * 2 * Math.PI;
        // Cas mono-segment (100 %) : un arc complet par lines() boucle mal,
        // on dessine un disque plein \u00E0 la place.
        if (Math.abs(sweep - 2 * Math.PI) < 1e-6) {
          doc.setFillColor(...s.color);
          doc.circle(donutCx, donutCy, donutOuterR, 'F');
        } else {
          drawSlice(donutCx, donutCy, donutOuterR, curAngle, curAngle + sweep, s.color);
        }
        curAngle += sweep;
      });

      // Trou central blanc \u2192 effet donut.
      doc.setFillColor(255, 255, 255);
      doc.circle(donutCx, donutCy, donutInnerR, 'F');

      // Total au centre.
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...C_TEXT);
      doc.text(`${genderTotal}`, donutCx, donutCy - 0.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C_MUTED);
      doc.text('total', donutCx, donutCy + 4, { align: 'center' });

      // L\u00E9gende \u00E0 droite : pastille de couleur + libell\u00E9 + nombre + pourcentage.
      const legendX = margin + 56;
      let legendY = y + 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      slices.forEach((s) => {
        const pct = ((s.value / genderTotal) * 100).toFixed(1);
        doc.setFillColor(...s.color);
        doc.roundedRect(legendX, legendY - 3, 4, 4, 1, 1, 'F');
        doc.setTextColor(...C_TEXT);
        doc.setFont('helvetica', 'bold');
        doc.text(s.label, legendX + 7, legendY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C_MUTED);
        doc.text(`${s.value}  \u00B7  ${pct} %`, legendX + 40, legendY);
        legendY += 8;
      });

      y += 52;
    }

    // Indicateurs d\u00E9taill\u00E9s.
    autoTable(doc, {
      startY: y,
      theme: 'plain',
      head: [['Indicateur', 'Valeur']],
      body: [
        ['Effectif total', `${dashboardData?.effectifTotal ?? '--'}`],
        ['Effectif pr\u00E9sent', `${dashboardData?.effectifPresent ?? '--'}`],
        ["Taux d'absent\u00E9isme", `${absenceRate}%`],
        ['Total absences', `${dashboardData?.totalAbsences ?? 0}`],
        ['Employ\u00E9s en retard', `${dashboardData?.nombreEmployesEnRetard ?? 0}`],
        ['Minutes de retard cumul\u00E9es', `${dashboardData?.nombreRetards ?? 0} min`],
        ['Heures travaill\u00E9es (p\u00E9riode)', dashboardData?.heuresTravaillees != null
          ? `${Number(dashboardData.heuresTravaillees).toFixed(1)} h` : '--'],
        ['Effectif Hommes', `${dashboardData?.effectifParSexe?.['M'] ?? 0}`],
        ['Effectif Femmes', `${dashboardData?.effectifParSexe?.['F'] ?? 0}`],
        ...((dashboardData?.effectifParSexe?.['Autre'] ?? 0) > 0
          ? [['Effectif Autre', `${dashboardData?.effectifParSexe?.['Autre'] ?? 0}`]]
          : []),
        ['Masse salariale (brute)', dashboardData?.masseSalariale != null
          ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(dashboardData.masseSalariale)} \u20AC`
          : '--'],
      ],
      headStyles: { fillColor: C_PRIMARY, textColor: 255, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, textColor: C_TEXT, lineColor: [230, 232, 234], lineWidth: 0.1 },
      alternateRowStyles: { fillColor: [248, 249, 251] },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Demandes de cong\u00E9 en attente.
    if (demandesData && demandesData.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...C_TEXT);
      doc.text(`Demandes de cong\u00E9 en attente (${demandesData.length})`, margin, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        theme: 'striped',
        head: [['Matricule', 'Employ\u00E9', 'Type', 'D\u00E9but', 'Fin', 'Statut']],
        body: demandesData.map((d: any) => [
          d.empcod || '',
          d.emplib || '',
          d.cgntype || d.abscod || '',
          d.cgndatedebut ? dayjs(d.cgndatedebut).format('DD/MM/YYYY')
            : d.condep ? dayjs(d.condep).format('DD/MM/YYYY') : '',
          d.cgndatefin ? dayjs(d.cgndatefin).format('DD/MM/YYYY')
            : d.conret ? dayjs(d.conret).format('DD/MM/YYYY') : '',
          d.cgnstatut || 'En attente',
        ]),
        headStyles: { fillColor: C_PRIMARY, textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: C_TEXT },
        alternateRowStyles: { fillColor: [248, 249, 251] },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Contrats \u00E9chus.
    if (expiringContracts.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...C_TEXT);
      doc.text(`Contrats arrivant \u00E0 \u00E9ch\u00E9ance (${expiringContracts.length})`, margin, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        theme: 'striped',
        head: [['Matricule', 'Employ\u00E9', 'Type', '\u00C9ch\u00E9ance', 'Jours restants']],
        body: expiringContracts.map((c: any) => {
          const daysLeft = c.empsort
            ? Math.ceil((new Date(c.empsort).getTime() - Date.now()) / 86400000)
            : 0;
          return [
            c.empcod || '',
            c.emplib || '',
            c.contype || 'CDD',
            c.empsort ? dayjs(c.empsort).format('DD/MM/YYYY') : '',
            `${daysLeft} j`,
          ];
        }),
        headStyles: { fillColor: C_WARN, textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: C_TEXT },
        alternateRowStyles: { fillColor: [254, 252, 232] },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Pointages incomplets.
    if (pointagesData && pointagesData.length > 0) {
      if (y > pageH - 50) {
        doc.addPage();
        y = margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...C_TEXT);
      doc.text(`Pointages incomplets (${pointagesData.length})`, margin, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        theme: 'striped',
        head: [['Matricule', 'Nom', 'D\u00E9partement', 'Date', 'Arriv\u00E9e', 'D\u00E9part', 'Motif']],
        body: pointagesData.map((row: any) => [
          row.empcod || '',
          row.emplib || '',
          row.departement || '',
          row.predat ? dayjs(row.predat).format('DD/MM/YYYY') : '',
          row.preentmatup || '\u2014',
          row.presortamidiup || row.presortmatup || '\u2014',
          row.motif || '',
        ]),
        headStyles: { fillColor: C_DANGER, textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: C_TEXT },
        alternateRowStyles: { fillColor: [254, 242, 242] },
        margin: { left: margin, right: margin },
      });
    }

    // Footer pagin\u00E9 sur toutes les pages.
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setDrawColor(...C_PRIMARY_LIGHT);
      doc.setLineWidth(0.3);
      doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C_MUTED);
      doc.text('Concorde Work Force \u2014 Rapport confidentiel', margin, pageH - 6);
      doc.text(`Page ${i} / ${totalPages}`, pageW - margin, pageH - 6, { align: 'right' });
    }

    doc.save(`Rapport_TableauDeBord_${dayjs().format('YYYY-MM-DD_HHmm')}.pdf`);
  };

  if (isLoading) return (
    // Skeleton dashboard admin : on reproduit le squelette des sections principales
    // (header, 4 KPI, deux graphes, deux listes) plutôt qu'un spinner centré qui
    // cache la mise en page pendant 1-2 s.
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 3 }}>
        <Skeleton variant="text" width={280} height={32} />
        <Skeleton variant="text" width={420} height={18} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        {[0, 1, 2, 3].map(i => (
          <Box key={`sk-kpi-${i}`} sx={{ p: 2.5, bgcolor: '#fff', borderRadius: 3, boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
            <Skeleton variant="rounded" width={36} height={36} sx={{ mb: 1.5 }} />
            <Skeleton variant="text" sx={{ fontSize: 28, width: '50%' }} />
            <Skeleton variant="text" sx={{ fontSize: 12, width: '70%' }} />
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 2, mb: 3 }}>
        <Box sx={{ p: 3, bgcolor: '#fff', borderRadius: 3, boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
          <Skeleton variant="text" sx={{ fontSize: 16, width: '30%', mb: 2 }} />
          <Skeleton variant="rounded" height={220} />
        </Box>
        <Box sx={{ p: 3, bgcolor: '#fff', borderRadius: 3, boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
          <Skeleton variant="text" sx={{ fontSize: 16, width: '50%', mb: 2 }} />
          {[0, 1, 2, 3].map(i => (
            <Box key={`sk-l-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Skeleton variant="circular" width={32} height={32} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" sx={{ fontSize: 13, width: '70%' }} />
                <Skeleton variant="text" sx={{ fontSize: 11, width: '50%' }} />
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );

  if (error) return (
    <Box sx={{ p: 3 }}><Alert severity="error">{t('dashboard.loadError')}</Alert></Box>
  );

  return (
    <Box className="db-container">
      {/* Welcome header */}
      <Box className="db-welcome">
        <Box>
          <Typography className="db-title">{t('dashboard.title')}</Typography>
          <Typography className="db-subtitle">{t('dashboard.updatedToday', { date: today })}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {/* Bouton Actions rapides : raccourcis vers les écrans les plus
              utilisés (créer un employé, courrier, demande, etc.) sans
              avoir à parcourir le menu latéral. */}
          <Tooltip title="Actions rapides">
            <Button
              startIcon={<BoltIcon />}
              variant="contained"
              onClick={(e) => setQuickAnchor(e.currentTarget)}
              sx={{
                textTransform: 'none', fontWeight: 700, fontSize: 13,
                background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
                boxShadow: '0 4px 12px rgba(245,158,11,0.35)',
                '&:hover': { background: 'linear-gradient(135deg, #d97706 0%, #ea580c 100%)' },
              }}
            >
              Actions rapides
            </Button>
          </Tooltip>
          <Tooltip title="Personnaliser le tableau de bord">
            <Button
              startIcon={<TuneIcon />}
              variant="outlined"
              onClick={() => setOpenCustomize(true)}
              sx={{
                textTransform: 'none', fontWeight: 700, fontSize: 13,
                borderColor: '#dae2ff', color: '#0040a1',
                '&:hover': { borderColor: '#0040a1', background: 'rgba(0,64,161,0.04)' },
              }}
            >
              Personnaliser
            </Button>
          </Tooltip>
          {/* Le bouton "Exporter le rapport" a été déplacé dans la barre de filtres
              (à la place de l'ancien "Appliquer filtres" qui n'avait pas de handler) :
              les filtres s'appliquent déjà automatiquement, et placer l'export à
              côté des filtres rend l'action contextuelle ("filtre + export"). */}
        </Box>
      </Box>

      {/* Menu déroulant Quick Actions — chaque entrée est un raccourci
          navigation vers l'écran qui héberge le formulaire de création.
          On ferme le menu après chaque clic pour ne pas masquer la page. */}
      <Menu
        anchorEl={quickAnchor}
        open={!!quickAnchor}
        onClose={() => setQuickAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: { minWidth: 260, mt: 1, borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' },
        }}
      >
        <Box sx={{ px: 2, py: 1, background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#92400e', letterSpacing: 0.5 }}>
            ⚡ ACTIONS RAPIDES
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => { setQuickAnchor(null); navigate('/dashboard/profil-employe?new=true'); }}>
          <ListItemIcon><PersonAddIcon fontSize="small" sx={{ color: '#0040a1' }} /></ListItemIcon>
          <ListItemText
            primary={<Typography sx={{ fontSize: 13, fontWeight: 700 }}>Ajouter un collaborateur</Typography>}
            secondary={<Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Créer une fiche employé</Typography>}
          />
        </MenuItem>
        <MenuItem onClick={() => { setQuickAnchor(null); navigate('/dashboard/contrat'); }}>
          <ListItemIcon><DescriptionIcon fontSize="small" sx={{ color: '#005136' }} /></ListItemIcon>
          <ListItemText
            primary={<Typography sx={{ fontSize: 13, fontWeight: 700 }}>Gérer les contrats</Typography>}
            secondary={<Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Nouveau contrat ou avenant</Typography>}
          />
        </MenuItem>
        <MenuItem onClick={() => { setQuickAnchor(null); navigate('/dashboard/courriers'); }}>
          <ListItemIcon><ArticleIcon fontSize="small" sx={{ color: '#6d28d9' }} /></ListItemIcon>
          <ListItemText
            primary={<Typography sx={{ fontSize: 13, fontWeight: 700 }}>Générer un courrier</Typography>}
            secondary={<Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Attestation, lettre, avenant…</Typography>}
          />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setQuickAnchor(null); navigate('/dashboard/etat-periodique'); }}>
          <ListItemIcon><EditCalendarIcon fontSize="small" sx={{ color: '#b45309' }} /></ListItemIcon>
          <ListItemText
            primary={<Typography sx={{ fontSize: 13, fontWeight: 700 }}>Saisir un pointage</Typography>}
            secondary={<Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Corriger entrée/sortie</Typography>}
          />
        </MenuItem>
        <MenuItem onClick={() => { setQuickAnchor(null); navigate('/dashboard/documents'); }}>
          <ListItemIcon><UploadFileIcon fontSize="small" sx={{ color: '#0e7490' }} /></ListItemIcon>
          <ListItemText
            primary={<Typography sx={{ fontSize: 13, fontWeight: 700 }}>Téléverser un document</Typography>}
            secondary={<Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Convention, règlement, accord</Typography>}
          />
        </MenuItem>
      </Menu>

      {/* Guide d'onboarding interactif : 5 étapes ordonnées (Poste → Classe →
          Calendrier → Employé → Contrat) que l'admin doit franchir avant que
          le pointage ne tourne. Auto-disparaît une fois masqué via la croix. */}
      <OnboardingGuide totalEmployees={dashboardData?.effectifTotal} />

      {/* Récapitulatif des tâches — bandeau textuel actionnable au-dessus des
          widgets. Chaque chip est cliquable et ouvre la section détaillée
          correspondante (dialog congé, dialog contrats, etc.). */}
      {visibility.recap && (
        <Box
          sx={{
            display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center',
            background: 'linear-gradient(135deg, #f0f4ff 0%, #fafbff 100%)',
            border: '1px solid #dae2ff', borderRadius: '14px',
            px: 2, py: 1.5, mb: 2,
          }}
        >
          <PlaylistAddCheckIcon sx={{ color: '#0040a1', fontSize: 20 }} />
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#0040a1', letterSpacing: 0.5, mr: 1 }}>
            À FAIRE AUJOURD'HUI
          </Typography>
          {(() => {
            const items: Array<{ label: string; color: string; bg: string; onClick?: () => void; emoji?: string }> = [];

            // Compteur ALIGNÉ sur la liste réellement chargée (demandesData) — c'est
            // ce que le modal affichera après clic. Auparavant on utilisait un
            // fallback vers dashboardData.totalDemandesEnAttente quand demandesData
            // était indéfini, ce qui causait l'incohérence « badge=1 mais modal vide »
            // (count tenant-wide vs liste filtrée par période). Maintenant que la
            // fenêtre de fetch est large (cf. pendingDemandesDebut/Fin), le compteur
            // reste fiable et le modal montre exactement les mêmes éléments.
            const pendingLeaves = demandesData?.length ?? 0;
            if (pendingLeaves > 0) {
              items.push({
                label: `${pendingLeaves} demande(s) de congé à valider`,
                color: '#92400e', bg: '#fef3c7', emoji: '📋',
                onClick: () => setOpenCongeDialog(true),
              });
            }

            const urgentContracts = expiringContracts.filter((c: any) => {
              const d = c.empsort ? Math.ceil((new Date(c.empsort).getTime() - Date.now()) / 86400000) : Infinity;
              return d <= 7;
            }).length;
            if (urgentContracts > 0) {
              items.push({
                label: `${urgentContracts} contrat(s) expirent dans 7 jours`,
                color: '#991b1b', bg: '#fee2e2', emoji: '⚠️',
                onClick: () => setOpenContractDialog(true),
              });
            } else if (expiringContracts.length > 0) {
              items.push({
                label: `${expiringContracts.length} contrat(s) à renouveler ce mois`,
                color: '#92400e', bg: '#fef3c7', emoji: '📝',
                onClick: () => setOpenContractDialog(true),
              });
            }

            const lateCount = dashboardData?.nombreEmployesEnRetard ?? 0;
            if (lateCount > 0) {
              items.push({
                label: `${lateCount} employé(s) en retard`,
                color: '#991b1b', bg: '#fee2e2', emoji: '⏰',
              });
            }

            const incompletePointages = pointagesData?.length ?? 0;
            if (incompletePointages > 0) {
              items.push({
                label: `${incompletePointages} pointage(s) incomplet(s)`,
                color: '#6d28d9', bg: '#ede9fe', emoji: '🔍',
                onClick: () => setOpenPointageDialog(true),
              });
            }

            const absences = dashboardData?.totalAbsences ?? 0;
            if (absences > 0) {
              items.push({
                label: `${absences} absence(s) du jour`,
                color: '#0040a1', bg: '#dae2ff', emoji: '👤',
              });
            }

            if (items.length === 0) {
              return (
                <Chip
                  label="✅ Tout est à jour — aucune action urgente"
                  size="small"
                  sx={{ background: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: 12 }}
                />
              );
            }

            return items.map((item, i) => (
              <Chip
                key={i}
                label={`${item.emoji ?? ''} ${item.label}`}
                onClick={item.onClick}
                size="small"
                sx={{
                  background: item.bg, color: item.color,
                  fontWeight: 700, fontSize: 12,
                  cursor: item.onClick ? 'pointer' : 'default',
                  '&:hover': item.onClick ? { filter: 'brightness(0.95)' } : undefined,
                }}
              />
            ));
          })()}
        </Box>
      )}

      {/* Filter bar */}
      <Box className="db-filter-bar">
        <Box className="db-filter-item">
          <Box className="db-filter-icon-wrap">
            <FilterListIcon sx={{ fontSize: 18, color: '#0040a1' }} />
          </Box>
          <FormControl size="small" variant="standard" sx={{ minWidth: 160 }}>
            <Select value={filterDateRange} onChange={e => setFilterDateRange(e.target.value as any)} disableUnderline sx={{ fontSize: '13px', fontWeight: 600 }}>
              <MenuItem value="today">{t('dashboard.today')}</MenuItem>
              <MenuItem value="week">{t('dashboard.thisWeek')}</MenuItem>
              <MenuItem value="month">{t('dashboard.thisMonth')}</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box className="db-filter-item">
          <Box className="db-filter-icon-wrap">
            <Box sx={{ width: 18, height: 18, color: '#0040a1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏢</Box>
          </Box>
          <FormControl size="small" variant="standard" sx={{ minWidth: 180 }}>
            <Select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)} disableUnderline sx={{ fontSize: '13px', fontWeight: 600 }}>
              <MenuItem value="all">{t('dashboard.allDepartments')}</MenuItem>
              {directionLibs.map((d: any) => <MenuItem key={d.dircod} value={d.dircod}>{d.dirlib}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <Button
          className="db-filter-apply-btn"
          startIcon={<FileDownloadIcon />}
          onClick={handleExportReport}
        >
          {t('dashboard.exportReport')}
        </Button>
      </Box>

      {/* KPI Row — toutes les valeurs sont déjà scopées à la période sélectionnée
          (cf. dashboardRequest qui inclut dateDebut/dateFin), on synchronise juste
          le LABEL de période affiché sur chaque carte pour qu'il corresponde au
          filtre courant ('Aujourd''hui' / 'Cette semaine' / 'Ce mois') au lieu
          d'être figé à 'Ce mois'. */}
      {visibility.kpis && (() => {
        const periodLabel = filterDateRange === 'today'
          ? t('dashboard.today')
          : filterDateRange === 'week' ? t('dashboard.thisWeek') : t('dashboard.thisMonth');
        return (
        <Box className="db-kpi-grid">
        <KpiCard
          icon={<HowToRegIcon sx={{ fontSize: 20 }} />}
          label={t('dashboard.presenceRate')}
          value={`${presenceRate}%`}
          trend={dashboardData?.pourcentagePresence}
          trendPositive
          iconBg="rgba(0,64,161,0.1)" iconColor="#0040a1"
        />
        <KpiCard
          icon={<PersonOffIcon sx={{ fontSize: 20 }} />}
          label={t('dashboard.absenceRate')}
          value={`${absenceRate}%`}
          trend={dashboardData?.evolutionAbsences}
          trendPositive={false}
          iconBg="rgba(186,26,26,0.1)" iconColor="#ba1a1a"
        />
        <KpiCard
          icon={<ScheduleIcon sx={{ fontSize: 20 }} />}
          label={t('dashboard.punctuality')}
          value={dashboardData?.pourcentagePonctualite != null ? `${dashboardData.pourcentagePonctualite.toFixed(1)}%` : '--'}
          trendLabel={periodLabel}
          iconBg="rgba(81,95,116,0.1)" iconColor="#515f74"
        />
        {/* BUG fix : on affichait `heuresTravaillees` (total pointé sur la période)
            sous le libellé « Heures Supp. Cumulées » — d'où des valeurs « illogiques »
            (ex. 168 h sur une semaine pour 4 employés). On utilise désormais le bon
            champ `heuresSupplementaires`, calculé hebdomadairement par le backend
            (seuil légal 40 h/sem) — conforme au droit du travail et cohérent avec
            la sémantique du KPI. */}
        <KpiCard
          icon={<MoreTimeIcon sx={{ fontSize: 20 }} />}
          label={t('dashboard.overtimeAccumulated')}
          value={dashboardData?.heuresSupplementaires != null ? `${dashboardData.heuresSupplementaires.toFixed(1)} hrs` : '--'}
          trendLabel={periodLabel}
          iconBg="rgba(0,81,54,0.1)" iconColor="#005136"
        />
        {/* Effectif par sexe — affiche « H / F » en compact dans la valeur ;
            le visuel détaillé (donut) est exposé plus bas dans la zone graphiques. */}
        {(() => {
          const repartition = dashboardData?.effectifParSexe ?? {};
          const nbH = repartition['M'] ?? 0;
          const nbF = repartition['F'] ?? 0;
          const nbAutre = repartition['Autre'] ?? 0;
          const hasData = (nbH + nbF + nbAutre) > 0;
          return (
            <KpiCard
              icon={<WcIcon sx={{ fontSize: 20 }} />}
              label="Effectif H / F"
              value={hasData ? `${nbH}H · ${nbF}F${nbAutre > 0 ? ` · ${nbAutre}` : ''}` : '--'}
              trendLabel={hasData ? `${nbH + nbF + nbAutre} salarié(s)` : periodLabel}
              iconBg="rgba(124,58,237,0.1)" iconColor="#7c3aed"
            />
          );
        })()}
        {/* Masse salariale brute = somme des Empsbrut déchiffrés (cf. DashboardService).
            Format FR avec séparateur d'espace pour les milliers, 0 décimales pour la
            lisibilité (un total à l'euro près n'apporte rien sur un agrégat de masse
            salariale). Réservée au Standard/Business — masquée sur Starter (dashboard
            simplifié). */}
        {advancedDashboards && (
          <KpiCard
            icon={<PaymentsIcon sx={{ fontSize: 20 }} />}
            label="Masse salariale (brute)"
            value={dashboardData?.masseSalariale != null
              ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(dashboardData.masseSalariale)} €`
              : '--'}
            trendLabel={periodLabel}
            iconBg="rgba(217,119,6,0.1)" iconColor="#d97706"
          />
        )}
        </Box>
        );
      })()}

      {/* Bento grid : Total employees / Congés / Alertes contrat */}
      {(visibility.totalEmployees || visibility.ongoingLeaves || (visibility.contractAlerts && advancedDashboards)) && (
      <Box className="db-bento-top">
        {visibility.totalEmployees && (
        <Box className="db-bento-employees">
          <Typography className="db-bento-label">{t('dashboard.totalEmployees')}</Typography>
          <Box className="db-bento-emp-value">
            <AnimatedNumber value={dashboardData?.effectifTotal ?? '--'} className="db-bento-big-num" />
            {dashboardData && <Box className="db-bento-trend-badge"><TrendingUpIcon sx={{ fontSize: 14 }} /> +12%</Box>}
          </Box>
          <Box className="db-bento-avatars">
            {[...Array(3)].map((_, i) => (
              <Avatar key={i} sx={{ width: 40, height: 40, border: '3px solid white', background: AVATAR_COLORS[i], fontSize: '13px', fontWeight: 700, ml: i > 0 ? -1.5 : 0 }}>
                {String.fromCharCode(65 + i)}
              </Avatar>
            ))}
            <Avatar sx={{ width: 40, height: 40, border: '3px solid white', background: '#d5e3fc', color: '#0040a1', fontSize: '11px', fontWeight: 700, ml: -1.5 }}>
              +{Math.max(0, (dashboardData?.effectifTotal ?? 0) - 3)}
            </Avatar>
          </Box>
        </Box>
        )}

        {visibility.ongoingLeaves && (
        <Box className="db-bento-conges" onClick={() => setOpenCongeDialog(true)} sx={{ cursor: 'pointer' }}>
          <Box className="db-bento-conges-top">
            <Typography className="db-bento-label">{t('dashboard.ongoingLeaves')}</Typography>
            <Box className="db-bento-icon-wrap-green"><EventAvailableIcon sx={{ fontSize: 20 }} /></Box>
          </Box>
          <AnimatedNumber value={demandesData?.length ?? dashboardData?.totalDemandesEnAttente ?? '--'} className="db-bento-medium-num" />
          <Typography className="db-bento-sub">{t('dashboard.pendingApproval')}</Typography>
          <Box className="db-bento-progress">
            <Box className="db-bento-progress-fill" style={{ width: '75%' }} />
          </Box>
        </Box>
        )}

        {visibility.contractAlerts && advancedDashboards && (
        <Box className="db-bento-alerts" onClick={() => setOpenContractDialog(true)} sx={{ cursor: 'pointer' }}>
          <Box className="db-bento-alerts-top">
            <Typography className="db-bento-label-error">{t('dashboard.contractAlerts')}</Typography>
            <Box className="db-bento-icon-wrap-error"><PriorityHighIcon sx={{ fontSize: 20 }} /></Box>
          </Box>
          <AnimatedNumber value={expiringContracts.length || 0} className="db-bento-medium-num" />
          <Typography className="db-bento-sub-error">
            {t('dashboard.contractsExpiringMonth')}
          </Typography>
        </Box>
        )}
      </Box>
      )}

      {/* Charts + Absences : graphique d'évolution + panel absences récentes.
          Evolution chart réservé au pack avancé (Starter voit un dashboard simplifié
          sans graphiques) ; le panel "Absences récentes" reste visible partout car
          la gestion congés/absences fait partie du Starter. */}
      {((visibility.evolution && advancedDashboards) || visibility.absences) && (
      <Box className="db-charts-row">
        {visibility.evolution && advancedDashboards && (
        <Box className="db-chart-card">
          {/* L'ancien en-tête « Tendance de recrutement » + légende Entrées/Sorties
              ne correspondait pas aux séries réellement tracées par EvolutionChart
              (Effectif Présent / Heures Travaillées / Taux de Présence). On laisse
              EvolutionChart porter son propre titre — moins de bruit, moins de
              contradiction. */}
          <EvolutionChart data={Array.isArray(evolutionData) ? evolutionData : []} isLoading={loadingEvolution} />
        </Box>
        )}

        {visibility.absences && (
        <Box className="db-absences-card">
          <Box className="db-absences-header">
            <Typography className="db-chart-title">{t('dashboard.recentAbsences')}</Typography>
          </Box>
          <Box className="db-absences-list">
            {dashboardData && dashboardData.totalAbsences > 0 ? (
              <Box className="db-absence-item">
                <Avatar sx={{ width: 40, height: 40, background: '#0040a1', fontSize: '13px', fontWeight: 700 }}>A</Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography className="db-absence-name">{t('dashboard.todaysAbsences')}</Typography>
                  <Typography className="db-absence-type">{t('dashboard.total')}: {dashboardData.totalAbsences}</Typography>
                </Box>
                <Chip label={t('dashboard.active')} size="small" sx={{ background: 'rgba(0,81,54,0.1)', color: '#005136', fontWeight: 700, fontSize: '10px' }} />
              </Box>
            ) : (
              <Typography sx={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', py: 3 }}>
                {t('dashboard.noAbsence')}
              </Typography>
            )}
            {dashboardData && dashboardData.nombreEmployesEnRetard > 0 && (
              <Box className="db-absence-item">
                <Avatar sx={{ width: 40, height: 40, background: '#ba1a1a', fontSize: '13px', fontWeight: 700 }}>R</Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography className="db-absence-name">{t('dashboard.todaysLate')}</Typography>
                  <Typography className="db-absence-type">{t('dashboard.total')}: {dashboardData.nombreEmployesEnRetard}</Typography>
                </Box>
                <Chip label={t('dashboard.active')} size="small" sx={{ background: 'rgba(186,26,26,0.1)', color: '#ba1a1a', fontWeight: 700, fontSize: '10px' }} />
              </Box>
            )}
          </Box>
          <Button className="db-see-all-btn" fullWidth onClick={() => navigate('/dashboard/calendrier-equipe')}>{t('dashboard.viewAllCalendar')}</Button>
        </Box>
        )}
      </Box>
      )}

      {/* Donut Hommes / Femmes — utilise les données déjà renvoyées par
          DashboardService.EffectifParSexe, donc pas de hook supplémentaire.
          Masqué sur Starter (dashboard simplifié sans graphiques). */}
      {visibility.genderDonut && advancedDashboards && (
        <Box className="db-chart-card" sx={{ mt: 2 }}>
          <GenderDonutChart data={dashboardData?.effectifParSexe} />
        </Box>
      )}

      {/* Bottom row — renouvellements de contrats : réservé aux packs avancés
          (le pack Starter n'inclut pas la gestion contractuelle avancée). */}
      {visibility.renewals && advancedDashboards && (
      <Box className="db-bottom-row">

        {/* Contract renewals */}
        <Box className="db-renewals-card">
          <Typography className="db-chart-title" sx={{ mb: 2 }}>{t('dashboard.nextRenewals')}</Typography>
          {expiringContracts.length > 0 ? (
            expiringContracts.slice(0, 5).map((c: any, i: number) => {
              const daysLeft = c.empsort ? Math.ceil((new Date(c.empsort).getTime() - Date.now()) / 86400000) : 0;
              return (
                <Box
                  key={i}
                  onClick={() => setRenewTarget(c as unknown as Contrat)}
                  className={`db-renewal-item ${daysLeft <= 7 ? 'db-renewal-urgent' : 'db-renewal-normal'}`}
                  sx={{ cursor: 'pointer' }}
                >
                  <Box>
                    <Typography className="db-renewal-name">{c.emplib || c.empcod}</Typography>
                    <Typography className="db-renewal-type">{c.contype || 'CDD'} — {c.empsort ? dayjs(c.empsort).format('DD/MM/YYYY') : '-'}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography className={daysLeft <= 7 ? 'db-renewal-days-error' : 'db-renewal-days-primary'}>{t('dashboard.daysLeft', { days: daysLeft })}</Typography>
                    <Typography className="db-renewal-action">{t('dashboard.renew')}</Typography>
                  </Box>
                </Box>
              );
            })
          ) : (
            <Typography sx={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', py: 3 }}>
              {t('dashboard.noRenewal')}
            </Typography>
          )}
        </Box>
      </Box>
      )}

      {/* Dialogs */}
      {/* Conge Dialog - Redesigned */}
      <Dialog open={openCongeDialog} onClose={() => setOpenCongeDialog(false)} maxWidth="md" fullWidth 
        PaperProps={{ sx: { borderRadius: '16px', overflow: 'hidden' } }}>
        <Box sx={{ background: 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)', px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <EventAvailableIcon sx={{ color: 'white', fontSize: 24 }} />
            <Box>
              <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '16px', fontFamily: 'Manrope, sans-serif' }}>{t('dashboard.congeRequestsPending')}</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>{t('dashboard.requestsFound', { count: demandesData?.length || 0 })}</Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setOpenCongeDialog(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <DialogContent sx={{ p: 0 }}>
          <CongeProvider><DashboardCongeList data={demandesData || []} isLoading={loadingDemandes} /></CongeProvider>
        </DialogContent>
      </Dialog>

      {/* Contract Expiry Dialog */}
      <Dialog open={openContractDialog} onClose={() => setOpenContractDialog(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: '16px', overflow: 'hidden' } }}>
        <Box sx={{ background: 'linear-gradient(135deg, #ba1a1a 0%, #dc2626 100%)', px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <PriorityHighIcon sx={{ color: 'white', fontSize: 24 }} />
            <Box>
              <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '16px', fontFamily: 'Manrope, sans-serif' }}>{t('dashboard.contractsExpiring')}</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>{t('dashboard.contractsExpiringSub', { count: expiringContracts.length })}</Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setOpenContractDialog(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <DialogContent sx={{ p: 2 }}>
          {!expiringContracts.length ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography sx={{ color: '#059669', fontWeight: 700, fontSize: '14px' }}>✅ {t('dashboard.noContractExpiring')}</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: '10px', mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ background: '#fef2f2' }}>
                    {[
                      t('dashboard.columns.matricule'),
                      t('dashboard.columns.employee'),
                      t('dashboard.columns.type'),
                      t('dashboard.columns.hireDate'),
                      t('dashboard.columns.dueDate'),
                      t('dashboard.columns.daysRemaining'),
                      t('dashboard.columns.action'),
                    ].map(h => (
                      <TableCell key={h} sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#991b1b' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {expiringContracts.map((c: any, i: number) => {
                    const daysLeft = c.empsort ? Math.ceil((new Date(c.empsort).getTime() - Date.now()) / 86400000) : 0;
                    return (
                      <TableRow key={i} sx={{ background: i % 2 === 0 ? '#fff' : '#fef2f2' }}>
                        <TableCell sx={{ fontWeight: 600 }}>{c.empcod || '-'}</TableCell>
                        <TableCell>{c.emplib || '-'}</TableCell>
                        <TableCell><Chip label={c.contype || 'CDD'} size="small" sx={{ background: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: '10px' }} /></TableCell>
                        <TableCell>{c.empemb ? dayjs(c.empemb).format('DD/MM/YYYY') : '-'}</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#ba1a1a' }}>{c.empsort ? dayjs(c.empsort).format('DD/MM/YYYY') : '-'}</TableCell>
                        <TableCell>
                          <Chip
                            label={t('dashboard.daysLeft', { days: daysLeft })}
                            size="small"
                            sx={{
                              background: daysLeft <= 7 ? '#fee2e2' : daysLeft <= 15 ? '#fef3c7' : '#dcfce7',
                              color: daysLeft <= 7 ? '#991b1b' : daysLeft <= 15 ? '#92400e' : '#166534',
                              fontWeight: 700, fontSize: '10px'
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
                            onClick={() => { setOpenContractDialog(false); setRenewTarget(c as unknown as Contrat); }}
                            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '11px', px: 1.5, py: 0.5, background: '#0040a1', '&:hover': { background: '#003280' } }}
                          >
                            {t('dashboard.renew')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openPointageDialog} onClose={() => setOpenPointageDialog(false)} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}
        sx={{
          '& .MuiDialog-container': { alignItems: 'center' },
          '& .MuiDialog-paper': {
            margin: { xs: 0, sm: '32px' },
            width: { xs: '30%', sm: 'auto' },
            maxWidth: { xs: '50%', sm: '500px' },
          },
        }}>
        <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>{t('dashboard.pointagesIncomplete')}</DialogTitle>
        <DialogContent>
          {loadingPointages ? <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
            : errorPointages ? <Alert severity="error">{t('dashboard.fetchError')}</Alert>
              : !pointagesData?.length ? <Alert severity="info">{t('dashboard.noIncompletePointage')}</Alert>
                : (
                  <TableContainer component={Paper} sx={{ mt: 1, borderRadius: '10px' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ background: '#f8fafc' }}>
                          {[
                            t('dashboard.columns.matricule'),
                            t('dashboard.columns.name'),
                            t('dashboard.columns.department'),
                            t('dashboard.columns.date'),
                            t('dashboard.columns.arrival'),
                            t('dashboard.columns.departure'),
                            t('dashboard.columns.comment'),
                          ].map(h => (
                            <TableCell key={h} sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pointagesData.map((row: any, i: number) => (
                          <TableRow key={i} sx={{ background: row.entreeManquante ? '#fff3e0' : '#ffebee' }}>
                            <TableCell>{row.empcod || '-'}</TableCell>
                            <TableCell>{row.emplib || '-'}</TableCell>
                            <TableCell>{row.departement || '-'}</TableCell>
                            <TableCell>{row.predat ? dayjs(row.predat).format('DD/MM/YYYY') : '-'}</TableCell>
                            <TableCell>{row.preentmatup || '-'}</TableCell>
                            <TableCell>{row.presortamidiup || row.presortmatup || '-'}</TableCell>
                            <TableCell><Typography variant="caption" sx={{ color: '#d32f2f', fontWeight: 500 }}>{row.motif || '-'}</Typography></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
        </DialogContent>
      </Dialog>

      <RenewContractDialog
        open={!!renewTarget}
        source={renewTarget}
        onClose={() => setRenewTarget(null)}
        onSuccess={() => { setRenewTarget(null); }}
      />

      {/* Customize Widgets Dialog : sélection des widgets visibles, persistée
          en localStorage par tenant. Chaque utilisateur peut adapter le dashboard
          à son rôle (un manager n'a pas besoin de voir les renouvellements de
          contrats par exemple). */}
      <Dialog
        open={openCustomize}
        onClose={() => setOpenCustomize(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 800, color: '#0040a1' }}>
          <TuneIcon /> Personnaliser
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={() => setOpenCustomize(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choisissez les éléments à afficher dans votre tableau de bord. Vos préférences
            sont sauvegardées automatiquement.
          </Typography>
          <Stack spacing={1}>
            {ALL_WIDGETS.map((w) => (
              <FormControlLabel
                key={w.key}
                control={
                  <Switch
                    checked={visibility[w.key]}
                    onChange={() => toggleWidget(w.key)}
                    color="primary"
                  />
                }
                label={<Typography sx={{ fontSize: 14, fontWeight: 600 }}>{w.label}</Typography>}
                sx={{ m: 0, justifyContent: 'space-between', width: '100%' }}
                labelPlacement="start"
              />
            ))}
          </Stack>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
            <Button
              startIcon={<RestartAltIcon />}
              onClick={resetWidgets}
              sx={{ textTransform: 'none', color: '#737785' }}
            >
              Réinitialiser
            </Button>
            <Button
              variant="contained"
              onClick={() => setOpenCustomize(false)}
              sx={{ textTransform: 'none', fontWeight: 700, background: '#0040a1' }}
            >
              Fermer
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
