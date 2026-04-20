import { Box, Typography, CircularProgress, Avatar } from '@mui/material';
import { useContext, useEffect, useState, useMemo } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import TimerIcon from '@mui/icons-material/Timer';
import { QueryClient, QueryClientProvider } from 'react-query';
import { EmployeeProvider, EmployeeContext } from './EmployeeContext';
import { DateRangeProvider, useDateRange } from './FilterContext';
import EmpEtatPeriodique from './EmpEtatPeriodique';
import { useAuth } from '../../helper/AuthProvider';
import apiInstance from '../../API/apiInstance';
import useGenerateEtatDetaille from '../../../hooks/presenceHooks/useGenerateEtatDetaille';
import useGetEmpEtat from '../../../hooks/presenceHooks/useGetEmpEtat';
import useGetEmployePosteByDate from '../../../hooks/employeHooks/useGetEmpPoste';
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

const fmtTime = (t: string) => t ? t.slice(0, 5) : '--:--';

const AVATAR_COLORS = ['#0040a1','#047857','#b45309','#6d28d9','#065f46','#9d174d'];
const DAY_NAMES = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

type EmpRow = { empcod: string; emplib: string; nbJours: number; totalMinutes: number; totalRetards: number };

// ── Calendar cell ─────────────────────────────────────────────────────────────
function CalCell({ day, etat, onClick, selected }: {
  day: number | null; etat?: EmpEtat; onClick?: () => void; selected?: boolean;
}) {
  if (!day) return <Box className="ep-cal-cell ep-cal-cell-empty" />;

  const isRepos = etat?.prerepos === '1';
  const hasRetard = etat && parseFloat(etat.totret || '0') > 0;
  const hasPresence = etat && !isRepos && (etat.preentmatup || etat.tothre);
  const etatLabel = etat?.etat?.trim();

  let cellClass = 'ep-cal-cell';
  if (isRepos) cellClass += ' ep-cal-cell-repos';
  else if (hasRetard) cellClass += ' ep-cal-cell-retard';
  else if (hasPresence) cellClass += ' ep-cal-cell-present';
  else if (etatLabel) cellClass += ' ep-cal-cell-etat';
  if (selected) cellClass += ' ep-cal-cell-selected';

  const totalH = etat?.tothre ? `${parseFloat(etat.tothre).toFixed(2)}h` : null;
  const retardMin = etat?.totret ? Math.round(parseFloat(etat.totret)) : 0;

  return (
    <Box className={cellClass} onClick={onClick}>
      <span className="ep-cal-num">{day}</span>
      {isRepos ? (
        <span className="ep-cal-val-repos">Repos</span>
      ) : etatLabel && !hasPresence ? (
        /* état spécial: congé, absence, etc. */
        <span className="ep-cal-val-etat">{etatLabel}</span>
      ) : hasRetard ? (
        <Box>
          <div className="ep-cal-val-retard">{totalH || '--'}</div>
          <div className="ep-cal-val-sub">+{retardMin}min retard</div>
          {etatLabel && <div className="ep-cal-val-etat-small">{etatLabel}</div>}
        </Box>
      ) : hasPresence ? (
        <Box>
          <span className="ep-cal-val-present">{totalH || '--'}</span>
          {etatLabel && <div className="ep-cal-val-etat-small">{etatLabel}</div>}
        </Box>
      ) : null}
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
        <Avatar sx={{ width: 40, height: 40, fontSize: '13px', fontWeight: 700,
          background: active ? 'linear-gradient(135deg,#0040a1,#1a6eff)' : `${color}22`,
          color: active ? 'white' : color, border: active ? 'none' : `1.5px solid ${color}44` }}>
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
  const { soccod, uticod, isManager, sercod: managerSercod } = useAuth();
  const isManagerScoped = Boolean(isManager && managerSercod);
  const { setSelectedEmpMat, setSelectedEmpLib, selectedEmpMat, selectedEmpLib, empEtatData,
    setSelectedEmpPoste, setDate, setSelectedEmp, setArrondi, setArrondiSup } = useContext(EmployeeContext);
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
  const [showTable, setShowTable] = useState(false); // toggle calendar vs table

  const { mutateAsync: generatePdf } = useGenerateEtatDetaille();

  // Fetch etat data for selected employee
  const { data: etatData = [] } = useGetEmpEtat({
    soccod,
    selectedEmpMat,
    dateRange: selectedEmpMat ? { dateDebut: new Date(dateDebut), dateFin: new Date(dateFin) } : null,
  });

  // Build a map: date string → EmpEtat
  const etatByDate = useMemo(() => {
    const map: Record<string, EmpEtat> = {};
    const arr = Array.isArray(etatData) ? etatData : (etatData as any)?.$values ?? [];
    arr.forEach((e: EmpEtat) => {
      const key = dayjs(e.predat).format('YYYY-MM-DD');
      map[key] = e;
    });
    return map;
  }, [etatData]);

  // Fetch poste data for the selected day
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
      setDateDebut(`${sy}-${String(sm).padStart(2,'0')}-${joudeb}`);
      setDateFin(`${ey}-${String(em).padStart(2,'0')}-${joufin}`);
    }).catch(console.error);
  }, [soccod, isManagerScoped, managerSercod]);

  useEffect(() => {
    if (isManagerScoped && managerSercod) {
      setSelectedService(managerSercod);
    }
  }, [isManagerScoped, managerSercod]);

  useEffect(() => {
    if (!annee || !mois) return;
    const { joudeb, joufin, moisdeb, moisfin } = paramMois;
    const mo = parseInt(mois, 10);
    let sm = moisdeb === 'P' ? mo - 1 : mo, em = moisfin === 'P' ? mo - 1 : mo;
    let sy = sm === 0 ? parseInt(annee) - 1 : parseInt(annee), ey = em === 0 ? parseInt(annee) - 1 : parseInt(annee);
    sm = sm === 0 ? 12 : sm; em = em === 0 ? 12 : em;
    setDateDebut(`${sy}-${String(sm).padStart(2,'0')}-${joudeb}`);
    setDateFin(`${ey}-${String(em).padStart(2,'0')}-${joufin}`);
  }, [mois, annee, paramMois]);

  const handleSearch = () => {
    if (!soccod || !uticod) return;
    setLoadingEmps(true);
    const params = new URLSearchParams();
    params.append('debut', dateDebut + 'T00:00:00');
    params.append('fin', dateFin + 'T00:00:00');
    if (selectedRegime) params.append('empreg', selectedRegime);
    if (selectedService) params.append('service', selectedService);

    // Use selectedFiliale if set, otherwise fall back to soccod's default site
    const sitcod = selectedFiliale || sessionStorage.getItem('sitcod') || soccod || '';

    apiInstance.get(`/Employes/get-emps/${soccod}/${sitcod}/${uticod}?${params}`)
      .then(r => {
        const data = r.data;
        const arr = Array.isArray(data) ? data : Array.isArray(data?.$values) ? data.$values : [];
        setRows(arr);
        setDateRange({
          dateDebut: new Date(dateDebut), dateFin: new Date(dateFin),
          selectedFiliale: sitcod, selectedRegime, selectedService,
          pres: '', mois, empcods: [], retapres: false, retmat: false, retmin: 0, compterAvance: false,
        });
      })
      .catch(err => {
        console.error('Erreur chargement employés:', err);
      })
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
    const ws = XLSX.utils.json_to_sheet(rows.map(r => ({ Matricule: r.empcod, Nom: r.emplib, 'Nb Jours': r.nbJours, 'Total Heures': fmtMin(r.totalMinutes), 'Total Retards': fmtMin(r.totalRetards) })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Etat');
    XLSX.writeFile(wb, `EtatPeriodique_${mois}_${annee}.xlsx`);
  };

  const filteredRows = useMemo(() => {
    const arr = Array.isArray(rows) ? rows : [];
    return arr.filter(r => !searchQ || r.emplib?.toLowerCase().includes(searchQ.toLowerCase()) || r.empcod.includes(searchQ));
  }, [rows, searchQ]);

  const selectedEmpRow = Array.isArray(rows) ? rows.find(r => r.empcod === selectedEmpMat) : undefined;
  const periodLabel = `${dateDebut.slice(8,10)}/${dateDebut.slice(5,7)} – ${dateFin.slice(8,10)}/${dateFin.slice(5,7)}`;
  const monthLabel = MONTH_NAMES[parseInt(mois) - 1] || mois;

  // Build calendar grid for the current month
  const calendarCells = useMemo(() => {
    const yr = parseInt(annee), mo = parseInt(mois);
    if (!yr || !mo) return [];
    const firstDay = new Date(yr, mo - 1, 1).getDay(); // 0=Sun
    const offset = firstDay === 0 ? 6 : firstDay - 1; // Mon-based
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const cells: (number | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [annee, mois]);

  const handleDayClick = (day: number) => {
    const key = `${annee}-${String(parseInt(mois)).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const etat = etatByDate[key];
    if (etat) {
      setSelectedDay(etat);
      setSelectedEmpPoste({ codposte: etat.codposte, day: dayjs(etat.predat).locale('fr').format('ddd').replace('.','') });
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
        <Box>
          <Typography className="ep-title">État Périodique</Typography>
          <Typography className="ep-subtitle">Suivi détaillé des présences et horaires des collaborateurs</Typography>
        </Box>
        <Box className="ep-header-actions">
          <button className="ep-btn-secondary" onClick={handleExportExcel}>
            <DownloadIcon sx={{ fontSize: 16 }} />Exporter Excel
          </button>
          <button className="ep-btn-primary" onClick={handlePrint}>
            <PrintIcon sx={{ fontSize: 16 }} />Imprimer
          </button>
        </Box>
      </Box>

      {/* Filter bar */}
      <Box className="ep-filter-bar">
        <Box className="ep-filter-grid">
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
          {/* Detail paper: calendar + day detail */}
          <Box className="ep-detail-paper">
            <Box className="ep-detail-header">
              <Box>
                <Typography className="ep-detail-title">Planning Mensuel — {monthLabel} {annee}</Typography>
                {selectedEmpRow && (
                  <Typography className="ep-detail-sub">
                    {selectedEmpRow.emplib} · {selectedEmpRow.nbJours}j · {fmtMin(selectedEmpRow.totalMinutes)}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box className="ep-legend">
                  {[{ color: '#dcfce7', border: '#86efac', label: 'Présent' },
                    { color: '#fee2e2', border: '#fca5a5', label: 'Retard' },
                    { color: '#f1f5f9', border: '#e2e8f0', label: 'Repos' }].map(l => (
                    <Box key={l.label} className="ep-legend-item">
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: l.color, border: `1.5px solid ${l.border}` }} />
                      <Typography className="ep-legend-label">{l.label}</Typography>
                    </Box>
                  ))}
                </Box>
                {/* Toggle calendar / table */}
                <button className="ep-btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}
                  onClick={() => setShowTable(t => !t)}>
                  {showTable ? 'Calendrier' : 'Tableau'}
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
              /* ── Table view (existing MRT) ── */
              <Box className="ep-table-wrap"><EmpEtatPeriodique /></Box>
            ) : (
              /* ── Calendar view ── */
              <>
                <Box className="ep-cal-grid">
                  {DAY_NAMES.map((d, i) => (
                    <Box key={d} className={`ep-cal-dayname ${i >= 5 ? 'ep-cal-dayname-weekend' : ''}`}>{d}</Box>
                  ))}
                  {calendarCells.map((day, i) => {
                    const key = day ? `${annee}-${String(parseInt(mois)).padStart(2,'0')}-${String(day).padStart(2,'0')}` : '';
                    const etat = key ? etatByDate[key] : undefined;
                    const isSelected = selectedDay && day ? dayjs(selectedDay.predat).date() === day : false;
                    return (
                      <CalCell key={i} day={day} etat={etat}
                        selected={isSelected}
                        onClick={day ? () => handleDayClick(day) : undefined} />
                    );
                  })}
                </Box>

                {/* Day detail bento */}
                {selectedDay && (
                  <Box className="ep-day-section">
                    {/* Col 1: pointage + all day details */}
                    <Box className="ep-day-card">
                      <Box className="ep-day-card-top">
                        <Box>
                          <Typography className="ep-day-card-title">Détails de la journée</Typography>
                          <Typography className="ep-day-card-date">
                            {dayjs(selectedDay.predat).format('dddd D MMMM YYYY')}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {selectedDay.etat?.trim() && (
                            <span className="ep-etat-badge">{selectedDay.etat}</span>
                          )}
                          {parseFloat(selectedDay.totret || '0') > 0 && (
                            <span className="ep-action-badge">Action requise</span>
                          )}
                          {selectedDay.prerepos === '1' && (
                            <span className="ep-repos-badge">Repos</span>
                          )}
                        </Box>
                      </Box>
                      <Box className="ep-detail-cols">
                        <Box>
                          <Box className="ep-detail-row">
                            <span className="ep-detail-row-label">Entrée Matin</span>
                            <span className={`ep-detail-row-val ${parseFloat(selectedDay.totret || '0') > 0 ? 'ep-val-error' : ''}`}>
                              {fmtTime(selectedDay.preentmatup)}
                            </span>
                          </Box>
                          <Box className="ep-detail-row">
                            <span className="ep-detail-row-label">Sortie Matin</span>
                            <span className="ep-detail-row-val">{fmtTime(selectedDay.presortmatup)}</span>
                          </Box>
                          <Box className="ep-detail-row">
                            <span className="ep-detail-row-label">Entrée AM</span>
                            <span className="ep-detail-row-val">{fmtTime(selectedDay.preentamidiup)}</span>
                          </Box>
                          <Box className="ep-detail-row">
                            <span className="ep-detail-row-label">Sortie AM</span>
                            <span className="ep-detail-row-val">{fmtTime(selectedDay.presortamidiup)}</span>
                          </Box>
                          <Box className="ep-detail-row">
                            <span className="ep-detail-row-label">Total Travaillé</span>
                            <span className="ep-detail-row-val ep-val-primary">{selectedDay.tothre || '--'}</span>
                          </Box>
                          <Box className="ep-detail-row">
                            <span className="ep-detail-row-label">Repas</span>
                            <span className="ep-detail-row-val">{selectedDay.prerepas || '0'}</span>
                          </Box>
                        </Box>
                        <Box>
                          <Box className="ep-detail-row">
                            <span className="ep-detail-row-label">Retard</span>
                            <span className="ep-detail-row-val ep-val-error">{selectedDay.totret || '0'}</span>
                          </Box>
                          <Box className="ep-detail-row">
                            <span className="ep-detail-row-label">H. Suppl.</span>
                            <span className="ep-detail-row-val ep-val-tertiary">{selectedDay.tothsup || '0'}</span>
                          </Box>
                          <Box className="ep-detail-row">
                            <span className="ep-detail-row-label">H. Nuits</span>
                            <span className="ep-detail-row-val">{selectedDay.tothnuit || '0'}</span>
                          </Box>
                          <Box className="ep-detail-row">
                            <span className="ep-detail-row-label">H. Absences</span>
                            <span className="ep-detail-row-val ep-val-error">{selectedDay.tothabs || '0'}</span>
                          </Box>
                          <Box className="ep-detail-row">
                            <span className="ep-detail-row-label">Compensation</span>
                            <span className="ep-detail-row-val">{selectedDay.totcmp || '0'}</span>
                          </Box>
                          <Box className="ep-detail-row">
                            <span className="ep-detail-row-label">Observation</span>
                            <span className="ep-detail-row-val" style={{ fontSize: '11px', maxWidth: 110, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {selectedDay.preobs || '—'}
                            </span>
                          </Box>
                        </Box>
                      </Box>
                    </Box>

                    {/* Col 2: poste du jour — real data */}
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
