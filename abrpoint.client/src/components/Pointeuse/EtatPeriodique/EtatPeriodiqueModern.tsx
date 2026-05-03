import { Box, Typography, CircularProgress, Avatar, Snackbar, Alert } from '@mui/material';
import { useContext, useEffect, useState, useMemo } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import TimerIcon from '@mui/icons-material/Timer';
import TuneIcon from '@mui/icons-material/Tune';
import { QueryClient, QueryClientProvider } from 'react-query';
import { EmployeeProvider, EmployeeContext } from './EmployeeContext';
import { DateRangeProvider, useDateRange } from './FilterContext';
import { useAuth } from '../../helper/AuthProvider';
import apiInstance from '../../API/apiInstance';
import useGenerateEtatDetaille from '../../../hooks/presenceHooks/useGenerateEtatDetaille';
import useGetEmpEtat from '../../../hooks/presenceHooks/useGetEmpEtat';
import useGetEmployePosteByDate from '../../../hooks/employeHooks/useGetEmpPoste';
import useGetEmployeesLibs from '../../../hooks/employeHooks/useGetEmployeesLibs';
import EmployeeMultiSelectDropdown from '../../helper/EmployeeMultiSelectDropdown';
import PointageAdjustDialog from '../Adjustment/PointageAdjustDialog';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import EmpEtat from '../../../models/EmpEtat';
import './EtatPeriodiqueModern.css';

// ── helpers ───────────────────────────────────────────────────────────────────
const fmtMin = (totalMinutes: number) => {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}`;
};

const fmtTime = (t: string) => (t ? t.slice(0, 5) : '--:--');

const AVATAR_COLORS = ['#0040a1', '#047857', '#b45309', '#6d28d9', '#065f46', '#9d174d'];
const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

type EmpRow = { empcod: string; emplib: string; nbJours: number; totalMinutes: number; totalRetards: number };

// ── Day Status classification ─────────────────────────────────────────────────
// Mirrors exactly the backend logic from GetEmpEtatPeriodiqueAsync
export type DayStatus = 'present' | 'absent' | 'retard' | 'conge' | 'autorisation' | 'ferie' | 'repos' | 'unknown';

export function classifyDayStatus(etat: EmpEtat | undefined): DayStatus {
  if (!etat) return 'unknown';

  const etatStr = (etat.etat ?? '').trim().toLowerCase();

  // Repos (highest priority — backend sets prerepos="1" and etat="J.Repos")
  if (etat.prerepos === '1' || etatStr === 'j.repos') return 'repos';

  // Férié — backend sets etat = "Férié (motif)"
  if (etatStr.startsWith('férié') || etatStr.startsWith('ferie') || etatStr.startsWith('ferié')) return 'ferie';

  // ✅ Use explicit backend flags for reliable conge/autorisation classification
  // Congé — flag set by backend when a congé record exists for this date
  if (etat.hasConge) return 'conge';
  // Fallback: also match by etat string for backwards compatibility
  if (
    etatStr.includes('congé') || etatStr.includes('conge') ||
    etatStr.startsWith('ca ') || etatStr === 'ca' ||
    etatStr.startsWith('cp ') || etatStr === 'cp'
  ) return 'conge';

  // Autorisation — flag set by backend when an autorisation record exists for this date
  if (etat.hasAutorisation) return 'autorisation';
  // Fallback: also match by etat string for backwards compatibility
  if (
    etatStr.includes('autorisation') ||
    etatStr.includes('autori') ||
    etatStr.includes('permission')
  ) return 'autorisation';

  // Sanction / absence explicite set by backend
  if (etatStr === 'absence') return 'absent';

  // No codposte means outside of contract range — treat as unknown, not absent
  // if (!etat.codposte) return 'unknown';

  // --- Pointage-based classification ---
  const hasEntry = !!etat.preentmatup;
  const hasExit = !!etat.presortmatup;
  const tothre = (etat.tothre ?? '00:00').trim();
  const hasHours = tothre !== '' && tothre !== '00:00';

  // Missing entry when there IS a poste → absent
  // (backend rule: preentmatup null, not congé/férié/repos → Absence)
  if (!hasEntry && !hasHours) return 'absent';

  // Single punch (only entry OR only exit) → treat as absent/incomplete
  if (hasEntry && !hasExit) return 'absent';

  // Has both punches — check retard
  if (hasEntry && hasExit) {
    const totret = etat.totret ?? '00:00';
    // totret format "HH:MM" — non-zero means retard
    const [rh, rm] = totret.split(':').map(Number);
    const retardMins = (rh || 0) * 60 + (rm || 0);
    if (retardMins > 0) return 'retard';
    return 'present';
  }

  return 'unknown';
}

// Status visual config
const STATUS_CFG: Record<DayStatus, {
  calBg: string; calBorder: string; calText: string;
  rowBg: string; rowBorder: string;
  badgeBg: string; badgeText: string;
  icon: string; label: string;
}> = {
  present: {
    calBg: '#f0fdf4', calBorder: '#86efac', calText: '#166534',
    rowBg: '#f0fdf4', rowBorder: '#bbf7d0',
    badgeBg: '#dcfce7', badgeText: '#15803d',
    icon: '✓', label: 'Présent',
  },
  absent: {
    calBg: '#fff1f2', calBorder: '#fca5a5', calText: '#991b1b',
    rowBg: '#fff1f2', rowBorder: '#fecaca',
    badgeBg: '#fee2e2', badgeText: '#b91c1c',
    icon: '✗', label: 'Absent',
  },
  retard: {
    calBg: '#fff7ed', calBorder: '#fdba74', calText: '#9a3412',
    rowBg: '#fff7ed', rowBorder: '#fed7aa',
    badgeBg: '#ffedd5', badgeText: '#c2410c',
    icon: '⏱', label: 'Retard',
  },
  conge: {
    calBg: '#eff6ff', calBorder: '#93c5fd', calText: '#1d4ed8',
    rowBg: '#eff6ff', rowBorder: '#bfdbfe',
    badgeBg: '#dbeafe', badgeText: '#1e40af',
    icon: '🏖', label: 'Congé',
  },
  autorisation: {
    calBg: '#faf5ff', calBorder: '#c4b5fd', calText: '#6d28d9',
    rowBg: '#faf5ff', rowBorder: '#ddd6fe',
    badgeBg: '#ede9fe', badgeText: '#7c3aed',
    icon: '📋', label: 'Autorisation',
  },
  ferie: {
    calBg: '#fefce8', calBorder: '#fde047', calText: '#854d0e',
    rowBg: '#fefce8', rowBorder: '#fef08a',
    badgeBg: '#fef9c3', badgeText: '#a16207',
    icon: '🎉', label: 'Férié',
  },
  repos: {
    calBg: '#f8fafc', calBorder: '#e2e8f0', calText: '#64748b',
    rowBg: '#f8fafc', rowBorder: '#e2e8f0',
    badgeBg: '#f1f5f9', badgeText: '#475569',
    icon: '💤', label: 'Repos',
  },
  unknown: {
    calBg: '#ffffff', calBorder: '#e5e7eb', calText: '#6b7280',
    rowBg: '#ffffff', rowBorder: '#f3f4f6',
    badgeBg: '#f9fafb', badgeText: '#6b7280',
    icon: '—', label: '—',
  },
};

// ── Table view for the date range ────────────────────────────────────────
function EmpDayTable({ etatByDate, dateDebut, dateFin }: {
  etatByDate: Record<string, EmpEtat>;
  dateDebut: string;
  dateFin: string;
}) {
  // Generate all dates in the range
  const days = useMemo(() => {
    const start = dayjs(dateDebut);
    const end = dayjs(dateFin);
    const arr: string[] = []; // YYYY-MM-DD strings
    let cur = start;
    while (cur.isBefore(end) || cur.isSame(end, 'day')) {
      arr.push(cur.format('YYYY-MM-DD'));
      cur = cur.add(1, 'day');
    }
    return arr;
  }, [dateDebut, dateFin]);

  return (
    <Box sx={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e5e7eb', mt: 1 }}>
      {/* Legend */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, p: '10px 14px', borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
        {(['present', 'retard', 'absent', 'conge', 'autorisation', 'ferie', 'repos'] as DayStatus[]).map(s => {
          const c = STATUS_CFG[s];
          return (
            <span key={s} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
              background: c.badgeBg, color: c.badgeText,
            }}>
              {c.icon} {c.label}
            </span>
          );
        })}
      </Box>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
            {['Date', 'Statut', 'Entrée', 'Sortie', 'H.Trav', 'Retard', 'H.Abs', 'H.Sup', 'Jours'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Date' || h === 'Statut' ? 'left' : 'center', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map(dateKey => {
            const e = etatByDate[dateKey];
            const status = classifyDayStatus(e);
            const cfg = STATUS_CFG[status];
            const d = dayjs(dateKey);
            const dow = d.day(); // 0=Sun,6=Sat
            const isWeekend = dow === 0 || dow === 6;
            const dateLabel = d.toDate().toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });

            // Display etat label
            const etatDisplay = e?.etat?.trim()
              ? e.etat.trim()
              : status === 'absent' ? 'Absent'
              : status === 'present' ? 'Présent'
              : cfg.label;

            // Entry/exit highlighting
            const missingEntry = e && !e.preentmatup && status !== 'repos' && status !== 'ferie' && status !== 'conge' && status !== 'autorisation';
            const missingExit = e && !e.presortmatup && status !== 'repos' && status !== 'ferie' && status !== 'conge' && status !== 'autorisation';

            // Retard highlighting
            const [rh, rm] = (e?.totret ?? '00:00').split(':').map(Number);
            const retardMins = (rh || 0) * 60 + (rm || 0);

            return (
              <tr key={dateKey} style={{
                background: isWeekend && !e ? '#f8fafc' : cfg.rowBg,
                borderBottom: `1px solid ${cfg.rowBorder}`,
                opacity: isWeekend && !e ? 0.6 : 1,
                transition: 'background 0.15s',
              }}>
                {/* Date */}
                <td style={{ padding: '7px 10px', fontWeight: 600, color: cfg.calText, whiteSpace: 'nowrap' }}>
                  {dateLabel}
                  {isWeekend && <span style={{ marginLeft: 4, fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>(W-E)</span>}
                </td>

                {/* Status badge */}
                <td style={{ padding: '7px 10px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                    background: cfg.badgeBg, color: cfg.badgeText, whiteSpace: 'nowrap',
                  }}>
                    {cfg.icon} {etatDisplay}
                  </span>
                </td>

                {/* Entrée */}
                <td style={{ padding: '7px 10px', textAlign: 'center', fontFamily: 'monospace', color: missingEntry ? '#ef4444' : '#374151', fontWeight: missingEntry ? 700 : 400 }}>
                  {e?.preentmatup ? fmtTime(e.preentmatup) : <span style={{ color: '#d1d5db' }}>—</span>}
                </td>

                {/* Sortie */}
                <td style={{ padding: '7px 10px', textAlign: 'center', fontFamily: 'monospace', color: missingExit ? '#ef4444' : '#374151', fontWeight: missingExit ? 700 : 400 }}>
                  {e?.presortmatup ? fmtTime(e.presortmatup) : <span style={{ color: '#d1d5db' }}>—</span>}
                </td>

                {/* H.Trav */}
                <td style={{ padding: '7px 10px', textAlign: 'center', fontFamily: 'monospace', color: !e?.tothre || e.tothre === '00:00' ? '#ef4444' : '#1d4ed8', fontWeight: 600 }}>
                  {e?.tothre && e.tothre !== '00:00' ? e.tothre : <span style={{ color: '#d1d5db' }}>00:00</span>}
                </td>

                {/* Retard */}
                <td style={{ padding: '7px 10px', textAlign: 'center', fontFamily: 'monospace', color: retardMins > 0 ? '#ea580c' : '#d1d5db', fontWeight: retardMins > 0 ? 700 : 400 }}>
                  {retardMins > 0 ? e!.totret : '—'}
                </td>

                {/* H.Abs */}
                <td style={{ padding: '7px 10px', textAlign: 'center', fontFamily: 'monospace' }}>
                  {e?.tothabs && e.tothabs !== '00:00'
                    ? <span style={{ color: '#dc2626', fontWeight: 600 }}>{e.tothabs}</span>
                    : <span style={{ color: '#d1d5db' }}>—</span>}
                </td>

                {/* H.Sup */}
                <td style={{ padding: '7px 10px', textAlign: 'center', fontFamily: 'monospace' }}>
                  {e?.tothsup && e.tothsup !== '00:00'
                    ? <span style={{ color: '#4f46e5', fontWeight: 600 }}>{e.tothsup}</span>
                    : <span style={{ color: '#d1d5db' }}>—</span>}
                </td>

                {/* Jours */}
                <td style={{ padding: '7px 10px', textAlign: 'center', color: e?.jour ? '#374151' : '#d1d5db', fontWeight: e?.jour ? 600 : 400 }}>
                  {e?.jour != null ? Number(e.jour).toFixed(2) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Box>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────
function SummaryBar({ etatByDate }: { etatByDate: Record<string, EmpEtat> }) {
  const counts = useMemo(() => {
    const c: Record<DayStatus, number> = { present: 0, absent: 0, retard: 0, conge: 0, autorisation: 0, ferie: 0, repos: 0, unknown: 0 };
    Object.values(etatByDate).forEach(e => { c[classifyDayStatus(e)]++; });
    return c;
  }, [etatByDate]);

  const totalJours = useMemo(() => {
    const workedStatuses: DayStatus[] = ['present', 'retard', 'conge', 'autorisation', 'ferie'];
    return Object.values(etatByDate).reduce((s, e) => {
      const status = classifyDayStatus(e);
      if (!workedStatuses.includes(status)) return s;
      // If e.jour is a valid numeric string (like "0.5" for half-day), use it; otherwise count as 1
      const jourNum = parseFloat(e.jour);
      return s + (isNaN(jourNum) ? 1 : jourNum);
    }, 0);
  }, [etatByDate]);

  const shown: DayStatus[] = ['present', 'retard', 'absent', 'conge', 'autorisation', 'ferie', 'repos'];

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, p: '10px 14px', background: 'white', borderRadius: '10px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      {shown.filter(s => counts[s] > 0).map(s => {
        const c = STATUS_CFG[s];
        // Mots invariables (déjà terminés par 's' ou 'x') : pas d'ajout de 's' au pluriel.
        const needsPlural = counts[s] > 1 && !/[sx]$/i.test(c.label);
        return (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: c.badgeBg, color: c.badgeText }}>
            {c.icon} {counts[s]} {c.label}{needsPlural ? 's' : ''}
          </span>
        );
      })}
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#f1f5f9', color: '#374151' }}>
        📅 {totalJours.toFixed(1)} j travaillés
      </span>
    </Box>
  );
}

// ── Calendar cell ─────────────────────────────────────────────────────────────
function CalCell({ dateKey, etat, onClick, selected }: {
  dateKey: string | null; etat?: EmpEtat; onClick?: () => void; selected?: boolean;
}) {
  if (!dateKey) return <Box className="ep-cal-cell ep-cal-cell-empty" />;

  const d = dayjs(dateKey);
  const dayNum = d.date();
  const status = classifyDayStatus(etat);
  const cfg = STATUS_CFG[status];

  const etatDisplay = etat?.etat?.trim()
    ? etat.etat.trim()
    : status === 'absent' ? 'Absent'
    : status === 'present' ? 'Présent'
    : cfg.label;

  const totalH = etat?.tothre && etat.tothre !== '00:00' ? etat.tothre : null;
  const [rh, rm] = (etat?.totret ?? '00:00').split(':').map(Number);
  const retardMins = (rh || 0) * 60 + (rm || 0);

  return (
    <Box
      onClick={onClick}
      sx={{
        borderRadius: '8px',
        border: `1.5px solid ${selected ? '#0040a1' : cfg.calBorder}`,
        background: selected ? '#e8f0fe' : cfg.calBg,
        p: '6px 7px',
        minHeight: 64,
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', gap: '3px',
        transition: 'all 0.15s',
        boxShadow: selected ? '0 0 0 2px #0040a166' : 'none',
        '&:hover': onClick ? { transform: 'scale(1.03)', boxShadow: '0 2px 8px rgba(0,64,161,0.12)' } : {},
      }}
    >
      {/* Day number + short month */}
      <span style={{ fontSize: 12, fontWeight: 700, color: cfg.calText }}>{dayNum} {d.format('MMM')}</span>

      {/* Status indicator */}
      {status !== 'unknown' && (
        <span
          title={etatDisplay}
          style={{
            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
            background: cfg.badgeBg, color: cfg.badgeText, alignSelf: 'flex-start',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}
        >
          <span style={{ flexShrink: 0 }}>{cfg.icon}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{etatDisplay}</span>
        </span>
      )}

      {/* Hours */}
      {totalH && status !== 'repos' && status !== 'ferie' && (
        <span style={{ fontSize: 10, color: cfg.calText, fontFamily: 'monospace', fontWeight: 500 }}>
          {totalH}
        </span>
      )}

      {/* Retard */}
      {retardMins > 0 && (
        <span style={{ fontSize: 9, color: '#c2410c', fontWeight: 600 }}>
          ⏱ +{retardMins}min
        </span>
      )}
    </Box>
  );
}

// ── Employee sidebar row ──────────────────────────────────────────────────────
function EmpSidebarRow({ row, active, onClick, index }: {
  row: EmpRow; active: boolean; onClick: () => void; index: number;
}) {
  const initials = row.emplib?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const hasRetard = row.totalRetards > 0;
  return (
    <Box onClick={onClick} className={`ep-emp-row ${active ? 'ep-emp-row-active' : ''}`}>
      <Box className="ep-emp-row-left">
        <Avatar sx={{
          width: 40, height: 40, fontSize: '13px', fontWeight: 700,
          background: active ? 'linear-gradient(135deg,#0040a1,#1a6eff)' : `${color}22`,
          color: active ? 'white' : color,
          border: active ? 'none' : `1.5px solid ${color}44`,
        }}>
          {initials}
        </Avatar>
        <Box>
          <Typography className="ep-emp-name">{row.emplib}</Typography>
          <Typography className="ep-emp-mat">MAT: {row.empcod}</Typography>
        </Box>
      </Box>
      <Box className="ep-emp-row-right">
        <Typography className="ep-emp-stats">{row.nbJours}j / {fmtMin(row.totalMinutes)}</Typography>
        <Typography className={`ep-emp-retard ${hasRetard ? 'ep-retard-error' : 'ep-retard-ok'}`}>
          {hasRetard ? `${fmtMin(row.totalRetards)} Retard` : 'Aucun retard'}
        </Typography>
      </Box>
    </Box>
  );
}

// ── Main inner ────────────────────────────────────────────────────────────────
function EtatPeriodiqueModernInner() {
  const { soccod, uticod, isManager, sercod: managerSercod, hasPermission } = useAuth();
  const isManagerScoped = Boolean(isManager && managerSercod);
  // Permissions pour l'ajustement de pointage (module distinct des classes horaires).
  const canConsultPointage = hasPermission('Pointage et Temps', 'consult');
  const canModifyPointage = hasPermission('Pointage et Temps', 'modify');
  const {
    setSelectedEmpMat, setSelectedEmpLib, selectedEmpMat, selectedEmpLib, empEtatData,
    setSelectedEmpPoste, setDate, setSelectedEmp, setArrondi, setArrondiSup,
  } = useContext(EmployeeContext);
  const { setDateRange } = useDateRange();

  const [filiale, setFiliale] = useState<Record<string, string>>({});
  const [services, setServices] = useState<Record<string, string>>({});
  const [paramMois, setParamMois] = useState({ joudeb: '01', joufin: '28', moisdeb: 'P', moisfin: 'P' });
  const [selectedFiliale, setSelectedFiliale] = useState(sessionStorage.getItem('sitcod') ?? '');
  const [selectedService, setSelectedService] = useState(isManagerScoped ? (managerSercod ?? '') : '');
  const [selectedRegime, setSelectedRegime] = useState('');
  const [mois, setMois] = useState(String(new Date().getMonth() + 1));
  const [annee, setAnnee] = useState(new Date().getFullYear().toString());
  const [dateDebut, setDateDebut] = useState(new Date().toISOString().slice(0, 10));
  const [dateFin, setDateFin] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<EmpRow[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [selectedDay, setSelectedDay] = useState<EmpEtat | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [selectedEmpcods, setSelectedEmpcods] = useState<string[]>([]);
  // Dialog "Ajuster un pointage" — pré-rempli avec l'employé sélectionné dans la
  // sidebar et la journée actuellement ouverte dans le panneau de détail.
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: 'success' | 'error' | 'warning' }>({
    open: false, msg: '', sev: 'success',
  });
  const showSnack = (msg: string, sev: 'success' | 'error' | 'warning') =>
    setSnack({ open: true, msg, sev });

  // Employee multi-select dropdown — list filtered by current filiale/service/regime selection.
  const { data: employeesLibs = {} } = useGetEmployeesLibs(
    selectedFiliale || undefined,
    isManagerScoped ? (managerSercod ?? undefined) : (selectedService || undefined),
    undefined,
    selectedRegime || undefined,
  );

  const { mutateAsync: generatePdf } = useGenerateEtatDetaille();

  const { data: etatData = [] } = useGetEmpEtat({
    soccod,
    selectedEmpMat,
    dateRange: selectedEmpMat ? { dateDebut: new Date(dateDebut), dateFin: new Date(dateFin) } : null,
  });

  const etatByDate = useMemo(() => {
    const map: Record<string, EmpEtat> = {};
    const arr = Array.isArray(etatData) ? etatData : (etatData as any)?.$values ?? [];
    arr.forEach((e: EmpEtat) => {
      const key = dayjs(e.predat).format('YYYY-MM-DD');
      map[key] = e;
    });
    return map;
  }, [etatData]);

  const selectedDayStr = selectedDay ? dayjs(selectedDay.predat).format('YYYY-MM-DD') : '';
  const selectedDayAbbr = selectedDay
    ? dayjs(selectedDay.predat).locale('fr').format('ddd').replace('.', '').toLowerCase()
    : '';
  const { data: selectedPoste } = useGetEmployePosteByDate(
    selectedEmpMat || '',
    selectedDayStr,
    selectedDayAbbr
  );

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
    apiInstance.get(`/Parametres/deb-mois/${soccod}`).then(r => {
      const { joudeb, joufin, moisdeb, moisfin } = r.data;
      setParamMois({ joudeb, joufin, moisdeb, moisfin });
      const yr = new Date().getFullYear(), mo = new Date().getMonth() + 1;
      let sm = moisdeb === 'P' ? mo - 1 : mo, em = moisfin === 'P' ? mo - 1 : mo;
      let sy = sm === 0 ? yr - 1 : yr, ey = em === 0 ? yr - 1 : yr;
      sm = sm === 0 ? 12 : sm; em = em === 0 ? 12 : em;
      setDateDebut(`${sy}-${String(sm).padStart(2, '0')}-${joudeb}`);
      setDateFin(`${ey}-${String(em).padStart(2, '0')}-${joufin}`);
    }).catch(console.error);
  }, [soccod, isManagerScoped, managerSercod]);

  useEffect(() => {
    if (isManagerScoped && managerSercod) setSelectedService(managerSercod);
  }, [isManagerScoped, managerSercod]);

  useEffect(() => {
    if (!annee || !mois) return;
    const { joudeb, joufin, moisdeb, moisfin } = paramMois;
    const mo = parseInt(mois, 10);
    let sm = moisdeb === 'P' ? mo - 1 : mo, em = moisfin === 'P' ? mo - 1 : mo;
    let sy = sm === 0 ? parseInt(annee) - 1 : parseInt(annee), ey = em === 0 ? parseInt(annee) - 1 : parseInt(annee);
    sm = sm === 0 ? 12 : sm; em = em === 0 ? 12 : em;
    setDateDebut(`${sy}-${String(sm).padStart(2, '0')}-${joudeb}`);
    setDateFin(`${ey}-${String(em).padStart(2, '0')}-${joufin}`);
  }, [mois, annee, paramMois]);

  const handleSearch = () => {
    if (!soccod || !uticod) return;

    setLoadingEmps(true);
    const params = new URLSearchParams();
    params.append('debut', dateDebut + 'T00:00:00');
    params.append('fin', dateFin + 'T00:00:00');
    if (selectedRegime) params.append('empreg', selectedRegime);
    if (selectedService) params.append('service', selectedService);
    selectedEmpcods.forEach(code => params.append('empcods', code));
    const sitcod = selectedFiliale || sessionStorage.getItem('sitcod') || soccod || '';
    apiInstance.get(`/Employes/get-emps/${soccod}/${sitcod}/${uticod}?${params}`)
      .then(r => {
        const data = r.data;
        const arr = Array.isArray(data) ? data : Array.isArray(data?.$values) ? data.$values : [];
        setRows(arr);
        setDateRange({
          dateDebut: new Date(dateDebut), dateFin: new Date(dateFin),
          selectedFiliale: sitcod, selectedRegime, selectedService,
          pres: '', mois, empcods: selectedEmpcods, retapres: false, retmat: false, retmin: 0, compterAvance: false,
        });
      })
      .catch(err => console.error('Erreur chargement employés:', err))
      .finally(() => setLoadingEmps(false));
  };

  const handlePrint = async () => {
    if (!empEtatData.length) { alert('Sélectionnez un employé d\'abord.'); return; }
    try {
      const blob = await generatePdf({ soccod: soccod || '', empcod: selectedEmpMat, emplib: selectedEmpLib, dateDebut, dateFin, rows: empEtatData });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `EtatDetaille_${selectedEmpMat}_${dateDebut}_${dateFin}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { alert('Erreur lors de la génération du rapport.'); }
  };

  const handleExportExcel = () => {
    if (!Array.isArray(rows) || !rows.length) { alert('Aucune donnée à exporter'); return; }
    const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
      Matricule: r.empcod, Nom: r.emplib,
      'Nb Jours': r.nbJours,
      'Total Heures': fmtMin(r.totalMinutes),
      'Total Retards': fmtMin(r.totalRetards),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Etat');
    XLSX.writeFile(wb, `EtatPeriodique_${mois}_${annee}.xlsx`);
  };

  const filteredRows = useMemo(() => {
    const arr = Array.isArray(rows) ? rows : [];
    return arr.filter(r => !searchQ || r.emplib?.toLowerCase().includes(searchQ.toLowerCase()) || r.empcod.includes(searchQ));
  }, [rows, searchQ]);

  const selectedEmpRow = Array.isArray(rows) ? rows.find(r => r.empcod === selectedEmpMat) : undefined;
  const periodLabel = `${dateDebut.slice(8, 10)}/${dateDebut.slice(5, 7)} – ${dateFin.slice(8, 10)}/${dateFin.slice(5, 7)}`;

  const calendarCells = useMemo(() => {
    const start = dayjs(dateDebut);
    const end = dayjs(dateFin);
    if (!start.isValid() || !end.isValid()) return [];

    // First day of the range — find its weekday offset (Mon=0 … Sun=6)
    const firstDow = start.day(); // 0=Sun
    const offset = firstDow === 0 ? 6 : firstDow - 1; // shift to Mon-based

    const cells: (string | null)[] = Array(offset).fill(null);
    let cur = start;
    while (cur.isBefore(end) || cur.isSame(end, 'day')) {
      cells.push(cur.format('YYYY-MM-DD'));
      cur = cur.add(1, 'day');
    }
    return cells;
  }, [dateDebut, dateFin]);

  const handleDayClick = (dateKey: string) => {
    const etat = etatByDate[dateKey];
    if (etat) {
      setSelectedDay(etat);
      setSelectedEmpPoste({ codposte: etat.codposte, day: dayjs(etat.predat).locale('fr').format('ddd').replace('.', '') });
      setArrondi(etat.arrondi || 0);
      setArrondiSup(etat.arrhsup || 0);
      setSelectedEmp(etat.empcod);
      setDate(etat.predat);
    } else {
      setSelectedDay(null);
    }
  };

  return (
    <Box className="ep-container">
      {/* Header */}
      <Box className="ep-header">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography className="ep-title">État Périodique</Typography>
          <Typography className="ep-subtitle">Suivi détaillé des présences et horaires des collaborateurs</Typography>
        </Box>
        <Box className="ep-header-actions" sx={{ flexShrink: 0 }}>
          <button className="ep-btn-secondary" onClick={handleExportExcel}>
            <DownloadIcon sx={{ fontSize: 16 }} /><Box sx={{ display: { xs: 'none', sm: 'inline' } }}>Exporter</Box>
          </button>
          <button className="ep-btn-primary" onClick={handlePrint}>
            <PrintIcon sx={{ fontSize: 16 }} /><Box sx={{ display: { xs: 'none', sm: 'inline' } }}>Imprimer</Box>
          </button>
        </Box>
      </Box>

      {/* Filter bar */}
      <Box className="ep-filter-bar">
        <Box className="ep-filter-grid">
          <Box className="ep-filter-field" style={{ minWidth: 220 }}>
            <span className="ep-filter-label">Collaborateurs</span>
            <EmployeeMultiSelectDropdown
              options={Object.entries(employeesLibs as Record<string, string>).map(([code, label]) => ({ code, label: String(label) }))}
              value={selectedEmpcods}
              onChange={setSelectedEmpcods}
            />
          </Box>
          <Box className="ep-filter-field">
            <span className="ep-filter-label">Filiale</span>
            <select className="ep-select" value={selectedFiliale} onChange={e => setSelectedFiliale(e.target.value)}>
              <option value="">—</option>
              {Object.entries(filiale).map(([k, v]) => <option key={k} value={k}>{String(v)}</option>)}
            </select>
          </Box>
          <Box className="ep-filter-field">
            <span className="ep-filter-label">Service</span>
            <select className="ep-select" value={selectedService} onChange={e => setSelectedService(e.target.value)} disabled={isManagerScoped}>
              <option value="">{isManagerScoped ? 'Mon service' : 'Tous'}</option>
              {Object.entries(services).map(([k, v]) => <option key={k} value={k}>{String(v)}</option>)}
            </select>
          </Box>
          <Box className="ep-filter-field">
            <span className="ep-filter-label">Régime</span>
            <select className="ep-select" value={selectedRegime} onChange={e => setSelectedRegime(e.target.value)}>
              <option value="">Tous</option>
              <option value="M">Mensuelle</option>
              <option value="H">Horaire</option>
            </select>
          </Box>
          <Box className="ep-filter-field">
            <span className="ep-filter-label">Mois</span>
            <input className="ep-input-sm" type="number" value={mois} min={1} max={12} onChange={e => setMois(e.target.value)} />
          </Box>
          <Box className="ep-filter-field">
            <span className="ep-filter-label">Année</span>
            <input className="ep-input-sm" type="number" value={annee} onChange={e => setAnnee(e.target.value)} />
          </Box>
          <Box className="ep-filter-field">
            <span className="ep-filter-label">Période</span>
            <Box className="ep-period-display">
              <CalendarMonthIcon sx={{ fontSize: 14 }} />{periodLabel}
            </Box>
          </Box>
          <Box className="ep-filter-field">
            <span className="ep-filter-label">Date début</span>
            <input className="ep-input-date" type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
          </Box>
          <Box className="ep-filter-field">
            <span className="ep-filter-label">Date fin</span>
            <input className="ep-input-date" type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} />
          </Box>
          <Box className="ep-filter-field ep-filter-search-btn">
            <button className="ep-search-btn" onClick={handleSearch} disabled={loadingEmps} title="Rechercher">
              {loadingEmps
                ? <CircularProgress size={14} sx={{ color: '#0040a1' }} />
                : <SearchIcon sx={{ fontSize: 16 }} />}
            </button>
          </Box>
        </Box>
      </Box>

      {/* Main */}
      <Box className="ep-main">
        {/* Sidebar */}
        <Box className="ep-sidebar">
          <Box className="ep-sidebar-paper">
            <Box className="ep-sidebar-header">
              <span className="ep-sidebar-title">Récapitulatif Employés</span>
              {rows.length > 0 && <span className="ep-count-chip">{rows.length}</span>}
            </Box>
            <Box className="ep-sidebar-search">
              <input type="text" placeholder="Rechercher un matricule..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
            </Box>
            <Box className="ep-sidebar-list">
              {loadingEmps ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
              ) : filteredRows.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography sx={{ fontSize: '12px', color: '#94a3b8' }}>
                    {rows.length === 0 ? 'Appliquez les filtres pour charger les employés' : 'Aucun résultat'}
                  </Typography>
                </Box>
              ) : filteredRows.map((row, i) => (
                <EmpSidebarRow key={row.empcod} row={row} index={i}
                  active={selectedEmpMat === row.empcod}
                  onClick={() => { setSelectedEmpMat(row.empcod); setSelectedEmpLib(row.emplib); setSelectedDay(null); }} />
              ))}
            </Box>
          </Box>
        </Box>

        {/* Right panel */}
        <Box className="ep-right">
          <Box className="ep-detail-paper">
            <Box className="ep-detail-header">
              <Box>
                <Typography className="ep-detail-title">Planning Périodique — {periodLabel}</Typography>
                {selectedEmpRow && (
                  <Typography className="ep-detail-sub">
                    {selectedEmpRow.emplib} · {selectedEmpRow.nbJours}j · {fmtMin(selectedEmpRow.totalMinutes)}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <button className="ep-btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}
                  onClick={() => setShowTable(t => !t)}>
                  {showTable ? '📅 Calendrier' : '📋 Tableau'}
                </button>
              </Box>
            </Box>

            {!selectedEmpMat ? (
              <Box className="ep-empty-state">
                <CalendarMonthIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
                <Typography sx={{ fontSize: '14px', color: '#94a3b8', fontWeight: 500 }}>
                  Sélectionnez un employé pour afficher son planning
                </Typography>
              </Box>
            ) : showTable ? (
              /* ── Enhanced table view ── */
              <Box className="ep-table-wrap">
                <SummaryBar etatByDate={etatByDate} />
                <EmpDayTable etatByDate={etatByDate} dateDebut={dateDebut} dateFin={dateFin} />
              </Box>
            ) : (
              /* ── Calendar view ── */
              <>
                {/* Summary chips above calendar */}
                <SummaryBar etatByDate={etatByDate} />

                {/* Wrapper scrollable horizontalement sur mobile pour que les 7 jours restent lisibles */}
                <Box className="ep-cal-scroll">
                  <Box className="ep-cal-grid">
                    {DAY_NAMES.map((d, i) => (
                      <Box key={d} className={`ep-cal-dayname ${i >= 5 ? 'ep-cal-dayname-weekend' : ''}`}>{d}</Box>
                    ))}
                    {calendarCells.map((dateKey, i) => {
                      const etat = dateKey ? etatByDate[dateKey] : undefined;
                      const isSelected = selectedDay && dateKey ? dayjs(selectedDay.predat).format('YYYY-MM-DD') === dateKey : false;
                      return (
                        <CalCell key={i} dateKey={dateKey} etat={etat}
                          selected={isSelected}
                          onClick={dateKey ? () => handleDayClick(dateKey) : undefined} />
                      );
                    })}
                  </Box>
                </Box>

                {/* Day detail panel */}
                {selectedDay && (
                  <Box className="ep-day-section">
                    <Box className="ep-day-card">
                      <Box className="ep-day-card-top">
                        <Box>
                          <Typography className="ep-day-card-title">Détails de la journée</Typography>
                          <Typography className="ep-day-card-date">
                            {dayjs(selectedDay.predat).format('dddd D MMMM YYYY')}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {(canConsultPointage || canModifyPointage) && (
                            <button
                              type="button"
                              className="ep-btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              onClick={() => setAdjustOpen(true)}
                              title="Corriger les heures d'entrée/sortie pour cette journée"
                            >
                              <TuneIcon sx={{ fontSize: 14 }} /> Ajuster pointage
                            </button>
                          )}
                          {/* Status badge using our classifier */}
                          {(() => {
                            const s = classifyDayStatus(selectedDay);
                            const c = STATUS_CFG[s];
                            return (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: c.badgeBg, color: c.badgeText }}>
                                {c.icon} {selectedDay.etat?.trim() || c.label}
                              </span>
                            );
                          })()}
                          {(() => {
                            const [rh, rm] = (selectedDay.totret ?? '00:00').split(':').map(Number);
                            return ((rh || 0) * 60 + (rm || 0)) > 0
                              ? <span className="ep-action-badge">Action requise</span>
                              : null;
                          })()}
                        </Box>
                      </Box>
                      <Box className="ep-detail-cols">
                        <Box>
                          {[
                            { label: 'Entrée Matin', val: fmtTime(selectedDay.preentmatup), warn: !selectedDay.preentmatup },
                            { label: 'Sortie Matin', val: fmtTime(selectedDay.presortmatup), warn: !selectedDay.presortmatup },
                            { label: 'Entrée AM', val: fmtTime(selectedDay.preentamidiup) },
                            { label: 'Sortie AM', val: fmtTime(selectedDay.presortamidiup) },
                            { label: 'Total Travaillé', val: selectedDay.tothre || '--', primary: true },
                            { label: 'Repas', val: String(selectedDay.prerepas || 0) },
                          ].map(({ label, val, warn, primary }) => (
                            <Box key={label} className="ep-detail-row">
                              <span className="ep-detail-row-label">{label}</span>
                              <span className={`ep-detail-row-val ${warn ? 'ep-val-error' : primary ? 'ep-val-primary' : ''}`}>{val}</span>
                            </Box>
                          ))}
                        </Box>
                        <Box>
                          {[
                            { label: 'Retard', val: selectedDay.totret || '0', err: true },
                            { label: 'H. Suppl.', val: selectedDay.tothsup || '0', tertiary: true },
                            { label: 'H. Nuits', val: selectedDay.tothnuit || '0' },
                            { label: 'H. Absences', val: selectedDay.tothabs || '0', err: true },
                            { label: 'Compensation', val: String(selectedDay.totcmp || 0) },
                            { label: 'Observation', val: selectedDay.preobs || '—' },
                          ].map(({ label, val, err, tertiary }) => (
                            <Box key={label} className="ep-detail-row">
                              <span className="ep-detail-row-label">{label}</span>
                              <span className={`ep-detail-row-val ${err ? 'ep-val-error' : tertiary ? 'ep-val-tertiary' : ''}`}>{val}</span>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    </Box>

                    {/* Autorisation du jour */}
                    {selectedDay.hasAutorisation && selectedDay.autDebut && selectedDay.autFin && (
                      <Box className="ep-horaire-mini" sx={{ borderColor: '#c4b5fd' }}>
                        <Typography className="ep-horaire-mini-title" sx={{ color: '#6d28d9' }}>📋 Autorisation</Typography>
                        <Box className="ep-horaire-item">
                          <Box className="ep-horaire-icon" style={{ background: 'rgba(109,40,217,0.08)' }}>
                            <AccessTimeIcon sx={{ fontSize: 16, color: '#6d28d9' }} />
                          </Box>
                          <Box>
                            <Typography className="ep-horaire-item-label">Plage autorisée</Typography>
                            <Typography className="ep-horaire-item-val" style={{ color: '#6d28d9', fontWeight: 700 }}>
                              {selectedDay.autDebut} → {selectedDay.autFin}
                            </Typography>
                          </Box>
                        </Box>
                        <Box className="ep-horaire-item">
                          <Box className="ep-horaire-icon" style={{ background: 'rgba(109,40,217,0.08)' }}>
                            <TimerIcon sx={{ fontSize: 16, color: '#6d28d9' }} />
                          </Box>
                          <Box>
                            <Typography className="ep-horaire-item-label">Motif</Typography>
                            <Typography className="ep-horaire-item-val">
                              {selectedDay.etat?.trim() || 'Autorisation'}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    )}

                    {/* Poste du jour */}
                    <Box className="ep-horaire-mini">
                      <Typography className="ep-horaire-mini-title">Poste du jour</Typography>
                      {selectedPoste ? (
                        <>
                          <Box className="ep-horaire-item">
                            <Box className="ep-horaire-icon"><AccessTimeIcon sx={{ fontSize: 16, color: '#0040a1' }} /></Box>
                            <Box>
                              <Typography className="ep-horaire-item-label">Plage de travail</Typography>
                              <Typography className="ep-horaire-item-val">
                                {fmtTime(selectedPoste.jourhdmat)} — {fmtTime(selectedPoste.jourhfmat)}
                                {selectedPoste.jourhdam && selectedPoste.jourhdam !== '00:00' && (
                                  <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                                    {fmtTime(selectedPoste.jourhdam)} — {fmtTime(selectedPoste.jourhfam)}
                                  </span>
                                )}
                              </Typography>
                            </Box>
                          </Box>
                          <Box className="ep-horaire-item">
                            <Box className="ep-horaire-icon"><TimerIcon sx={{ fontSize: 16, color: '#0040a1' }} /></Box>
                            <Box>
                              <Typography className="ep-horaire-item-label">Tolérance Entrée</Typography>
                              <Typography className="ep-horaire-item-val">
                                -{selectedPoste.avantent ?? 0} / +{selectedPoste.apresent ?? 0} min
                              </Typography>
                            </Box>
                          </Box>
                          <Box className="ep-horaire-item">
                            <Box className="ep-horaire-icon"><TimerIcon sx={{ fontSize: 16, color: '#515f74' }} /></Box>
                            <Box>
                              <Typography className="ep-horaire-item-label">Tolérance Sortie</Typography>
                              <Typography className="ep-horaire-item-val">
                                -{selectedPoste.avantsort ?? 0} / +{selectedPoste.apressort ?? 0} min
                              </Typography>
                            </Box>
                          </Box>
                          <Box className="ep-horaire-item">
                            <Box className="ep-horaire-icon"><RestaurantIcon sx={{ fontSize: 16, color: '#0040a1' }} /></Box>
                            <Box>
                              <Typography className="ep-horaire-item-label">Repas</Typography>
                              <Typography className="ep-horaire-item-val">
                                {selectedPoste.jourrepas ? `${selectedPoste.jourrepas} min` : '—'}
                                {selectedPoste.jourhdrep && selectedPoste.jourhdrep !== '00:00' && (
                                  <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                                    {fmtTime(selectedPoste.jourhdrep)} — {fmtTime(selectedPoste.jourhfrep)}
                                  </span>
                                )}
                              </Typography>
                            </Box>
                          </Box>
                          {selectedPoste.jourrepos === '1' && (
                            <Box className="ep-horaire-item">
                              <Box className="ep-horaire-icon" style={{ background: 'rgba(186,26,26,0.08)' }}>
                                <AccessTimeIcon sx={{ fontSize: 16, color: '#ba1a1a' }} />
                              </Box>
                              <Box>
                                <Typography className="ep-horaire-item-label">Statut</Typography>
                                <Typography className="ep-horaire-item-val" style={{ color: '#ba1a1a' }}>Jour de repos</Typography>
                              </Box>
                            </Box>
                          )}
                        </>
                      ) : (
                        <Typography sx={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', py: 2 }}>
                          Poste non défini
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Box>
      </Box>

      <PointageAdjustDialog
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        canModify={canModifyPointage}
        showSnack={showSnack}
        initialEmpcod={selectedEmpMat || ''}
        initialDate={selectedDay ? dayjs(selectedDay.predat).format('YYYY-MM-DD') : ''}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
      >
        <Alert
          severity={snack.sev}
          onClose={() => setSnack(s => ({ ...s, open: false }))}
          sx={{ borderRadius: '10px' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function EtatPeriodiqueModern() {
  const qc = new QueryClient();
  return (
    <QueryClientProvider client={qc}>
      <DateRangeProvider>
        <EmployeeProvider>
          <EtatPeriodiqueModernInner />
        </EmployeeProvider>
      </DateRangeProvider>
    </QueryClientProvider>
  );
}

export default EtatPeriodiqueModern;