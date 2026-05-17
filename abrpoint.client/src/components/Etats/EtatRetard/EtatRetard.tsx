import { useEffect, useMemo, useState } from 'react';
import { CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AnimatedNumber } from '../../shared/AnimatedNumber';

// Icons
import SearchIcon from '@mui/icons-material/Search';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DownloadIcon from '@mui/icons-material/FileDownload';
import PrintIcon from '@mui/icons-material/Print';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import GroupIcon from '@mui/icons-material/Group';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TimerIcon from '@mui/icons-material/Timer';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import EmployeeMultiSelectDropdown from '../../helper/EmployeeMultiSelectDropdown';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import { useEmployeeFilter } from '../../../hooks/employeHooks/useEmployeeFilter';
import useGetEmployeesLibs from '../../../hooks/employeHooks/useGetEmployeesLibs';
import useGetPresence from '../../../hooks/presenceHooks/useGetPresence';
import apiInstance from '../../API/apiInstance';

import '../EtatAbsence/Etatabsence.css';

const DASH = '—';

type RetardRow = {
  empcod?: string;
  empmat?: string;
  emplib?: string;
  empreg?: string;
  predat?: Date | string;
  entree1?: string;
  sortie1?: string;
  entree2?: string;
  sortie2?: string;
  preretmateup?: string;
  preretameup?: string;
  preretmatsup?: string;
  preretamsup?: string;
  motif?: string;
};

const toMinutes = (value?: string | null): number => {
  if (!value || value === '00:00' || value === DASH) return 0;
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
};

const toHHMM = (minutes: number): string => {
  const safe = Math.max(0, minutes);
  const h = Math.floor(safe / 60).toString().padStart(2, '0');
  const m = Math.floor(safe % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

const fmtDate = (value: any): string => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
};

const fmtDateLong = (value: any): string => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
};

const getInitials = (name?: string | null) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase()
    : parts[0].substring(0, 2).toUpperCase();
};

const regimeOptions: Record<string, string> = { M: 'Mensuelle', H: 'Horaire' };

function EtatRetard() {
  const { t } = useTranslation();
  const { soccod, hasPermission } = useAuth();

  if (!hasPermission('Rapports et Statistiques', 'consult')) {
    return <AccessDenied message={t('etats.retard.noConsultRight')} />;
  }

  const {
    filiale,
    services,
    selectedFiliale,
    setSelectedFiliale,
    selectedService,
    setSelectedService,
    selectedRegime,
    setSelectedRegime,
    isServiceLocked,
    effectiveEmpcods,
    hasEffectiveEmployees,
    effectiveEmployeesLabel,
    handleEmployeeSelection,
    selectedEmpCodes,
  } = useEmployeeFilter();

  // Régime par défaut "T" pour matcher la sémantique back-end ("tous").
  useEffect(() => { setSelectedRegime('T'); }, [setSelectedRegime]);

  const { data: emplibs = {} } = useGetEmployeesLibs(selectedFiliale, selectedService, undefined, selectedRegime);

  // Dates
  const [dateDebut, setDateDebut] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateFin, setDateFin] = useState(() => new Date().toISOString().slice(0, 10));
  const [annee, setAnnee] = useState(new Date().getFullYear().toString());

  // Options
  const [retmin, setRetmin] = useState(0);
  const [retmat, setRetmat] = useState(true);
  const [retapres, setRetapres] = useState(true);
  const [compterAvance, setCompterAvance] = useState(false);

  // UI state
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [selectedRow, setSelectedRow] = useState<RetardRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Bornes de période par défaut depuis paramètres société
  useEffect(() => {
    if (!soccod) return;
    apiInstance
      .get(`/Parametres/deb-mois/${soccod}`)
      .then((res) => {
        const { joudeb, joufin, moisdeb, moisfin } = res.data;
        const now = new Date();
        const year = now.getFullYear();
        let sm = moisdeb === 'P' ? now.getMonth() : now.getMonth() + 1;
        let em = moisfin === 'P' ? now.getMonth() : now.getMonth() + 1;
        const sy = sm === 0 ? year - 1 : year;
        const ey = em === 0 ? year - 1 : year;
        sm = sm === 0 ? 12 : sm;
        em = em === 0 ? 12 : em;
        const pad = (n: number) => String(n).padStart(2, '0');
        setAnnee(year.toString());
        setDateDebut(`${sy}-${pad(sm)}-${joudeb}`);
        setDateFin(`${ey}-${pad(em)}-${joufin}`);
      })
      .catch((err) => console.error('Params error:', err));
  }, [soccod]);

  // Sync année → dates
  useEffect(() => {
    if (!annee) return;
    const sp = dateDebut.split('-'); const ep = dateFin.split('-');
    if (sp.length === 3) setDateDebut(`${annee}-${sp[1]}-${sp[2]}`);
    if (ep.length === 3) setDateFin(`${annee}-${ep[1]}-${ep[2]}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annee]);

  const { data: rawData = [], isLoading, refetch } = useGetPresence(
    new Date(dateDebut),
    new Date(dateFin),
    selectedRegime || 'T',
    hasEffectiveEmployees ? effectiveEmpcods : null,
  );

  // ── Application des options (retmin / retmat / retapres / compterAvance)
  const rows = useMemo(() => {
    const minRetard = retmin || 0;
    return (rawData as RetardRow[]).map((row) => {
      const retardMatin = toMinutes(row.preretmateup);
      const retardAm = toMinutes(row.preretameup);
      const avanceMatin = toMinutes(row.preretmatsup);
      const avanceAm = toMinutes(row.preretamsup);

      const fRM = retmat && retardMatin > minRetard ? retardMatin : 0;
      const fRA = retapres && retardAm > minRetard ? retardAm : 0;
      const fAM = compterAvance && avanceMatin > minRetard ? avanceMatin : 0;
      const fAA = compterAvance && avanceAm > minRetard ? avanceAm : 0;

      const totalMin = fRM + fRA + fAM + fAA;
      return {
        ...row,
        preretmateup: toHHMM(fRM),
        preretameup: toHHMM(fRA),
        preretmatsup: toHHMM(fAM),
        preretamsup: toHHMM(fAA),
        totalRetard: toHHMM(totalMin),
      } as RetardRow & { totalRetard: string };
    });
  }, [rawData, retmin, retmat, retapres, compterAvance]);

  // ── Filtre recherche libre
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const text = `${row.emplib ?? ''} ${row.empcod ?? ''} ${row.empmat ?? ''} ${fmtDate(row.predat)}`.toLowerCase();
      return text.includes(q);
    });
  }, [rows, search]);

  // ── KPIs
  const kpis = useMemo(() => {
    const impactedMinutes = filteredRows.reduce((acc, r) => acc + toMinutes(r.totalRetard), 0);
    const impactedRows = filteredRows.filter((r) => toMinutes(r.totalRetard) > 0);
    const uniqueEmps = new Set(filteredRows.map((r) => r.empcod).filter(Boolean)).size;
    const impactedEmps = new Set(impactedRows.map((r) => r.empcod).filter(Boolean)).size;
    const rate = uniqueEmps > 0 ? (impactedEmps / uniqueEmps) * 100 : 0;
    const avgMin = impactedRows.length > 0 ? Math.round(impactedMinutes / impactedRows.length) : 0;
    return {
      rate: rate.toFixed(1),
      totalRetard: toHHMM(impactedMinutes),
      avgMin,
      impactedEmps,
      uniqueEmps,
    };
  }, [filteredRows]);

  // ── Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginated = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ── Handlers
  const handleSearch = () => {
    if (!hasEffectiveEmployees) return;
    setSearchTriggered(true);
    setCurrentPage(1);
    setTimeout(() => refetch(), 0);
  };

  const handlePrintReport = async () => {
    if (!soccod || !hasEffectiveEmployees) return;
    try {
      const params = new URLSearchParams();
      effectiveEmpcods.forEach((c) => params.append('empcods', c));
      const response = await apiInstance.get(
        `/Presences/get-etat-retard-report/${soccod}/${dateDebut}/${dateFin}/${selectedRegime || 'T'}`,
        { params, responseType: 'blob' },
      );
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `etat-retard-${dateDebut}_${dateFin}.pdf`);
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Rapport erreur:', err);
    }
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    autoTable(doc, {
      head: [[
        t('etats.retard.report.employee'),
        t('etats.retard.report.date'),
        t('etats.retard.report.schedule'),
        t('etats.retard.report.punch'),
        t('etats.retard.report.late'),
        t('etats.retard.report.status'),
      ]],
      body: filteredRows.map((row) => {
        const planned = `${row.entree1 || DASH} - ${row.sortie2 || DASH}`;
        const pointage = row.entree1 || DASH;
        const justified = Boolean(row.motif && row.motif.trim() && row.motif !== DASH);
        const status = justified ? t('etats.retard.justified') : t('etats.retard.notJustified');
        return [
          `${row.emplib || DASH} (${row.empcod || DASH})`,
          fmtDate(row.predat),
          planned,
          pointage,
          (row as any).totalRetard || '00:00',
          status,
        ];
      }),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 64, 161] },
      margin: { top: 18 },
    });
    doc.save(`suivi-retards-${annee}.pdf`);
  };

  const openDrawer = (row: RetardRow) => { setSelectedRow(row); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setTimeout(() => setSelectedRow(null), 300); };

  return (
    <div className="ea-page">
      {/* ── Header ── */}
      <div className="ea-header">
        <div className="ea-header-left">
          <div>
            <h2 className="ea-title">{t('etats.retard.title')}</h2>
            <p className="ea-subtitle">{t('etats.retard.subtitle')}</p>
          </div>
          <div className="ea-header-divider" />
          <div className="ea-year-select">
            <CalendarTodayIcon sx={{ fontSize: 15, color: '#94a3b8' }} />
            <select
              value={annee}
              onChange={(e) => setAnnee(e.target.value)}
              style={{
                background: 'transparent', border: 'none',
                fontSize: 13, fontWeight: 700, color: '#334155',
                outline: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {['2027', '2026', '2025', '2024', '2023'].map((y) => (
                <option key={y} value={y}>{t('etats.absence.yearLabel', { year: y })}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="ea-filter-section">
        <div className="ea-filter-row">
          {filiale && Object.keys(filiale).length > 0 && (
            <div className="ea-filter-field">
              <label className="ea-filter-label">{t('etats.filter.branch')}</label>
              <select className="ea-filter-select" value={selectedFiliale} onChange={(e) => setSelectedFiliale(e.target.value)}>
                <option value="">{t('etats.filter.all')}</option>
                {Object.entries(filiale).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
          )}
          {services && Object.keys(services).length > 0 && (
            <div className="ea-filter-field">
              <label className="ea-filter-label">{t('etats.filter.service')}</label>
              <select className="ea-filter-select" value={selectedService} onChange={(e) => setSelectedService(e.target.value)} disabled={isServiceLocked}>
                <option value="">{isServiceLocked ? t('etats.filter.myService') : t('etats.filter.allService')}</option>
                {Object.entries(services).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
          )}
          <div className="ea-filter-field">
            <label className="ea-filter-label">{t('etats.filter.regime')}</label>
            <select className="ea-filter-select" value={selectedRegime} onChange={(e) => setSelectedRegime(e.target.value)}>
              <option value="T">{t('etats.filter.regimeAll')}</option>
              {Object.entries(regimeOptions).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </select>
          </div>
          <div className="ea-filter-field-narrow">
            <label className="ea-filter-label">{t('etats.filter.dateStart')}</label>
            <input type="date" className="ea-filter-input" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
          </div>
          <div className="ea-filter-field-narrow">
            <label className="ea-filter-label">{t('etats.filter.dateEnd')}</label>
            <input type="date" className="ea-filter-input" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
          </div>
          <div className="ea-filter-field" style={{ minWidth: 220, maxWidth: 260, flexGrow: 0 }}>
            <label className="ea-filter-label">{t('etats.filter.employees')}</label>
            <EmployeeMultiSelectDropdown
              options={Object.entries((emplibs || {}) as Record<string, string>).map(([code, label]) => ({ code, label: String(label) }))}
              value={selectedEmpCodes}
              onChange={handleEmployeeSelection}
              minWidth={220}
            />
          </div>
          <div className="ea-filter-field-narrow" style={{ minWidth: 200, flex: 1, maxWidth: 320 }}>
            <label className="ea-filter-label">{t('etats.retard.search')}</label>
            <input
              type="text"
              className="ea-filter-input"
              placeholder={t('etats.retard.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="ea-search-btn" onClick={handleSearch} disabled={!hasEffectiveEmployees || isLoading}>
            {isLoading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon sx={{ fontSize: 15 }} />}
            {t('etats.filter.filterBtn')}
          </button>
        </div>

        {/* Ligne 2 : options retard + champ auxiliaire retmin */}
        <div className="ea-filter-row" style={{ marginTop: 12, alignItems: 'center' }}>
          <div className="ea-filter-field-narrow">
            <label className="ea-filter-label">{t('etats.filter.minDelay')}</label>
            <input type="number" className="ea-filter-input" value={retmin} onChange={(e) => setRetmin(Number(e.target.value || 0))} />
          </div>
          <div style={{ display: 'inline-flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginLeft: 4 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#334155' }}>
              <input type="checkbox" checked={compterAvance} onChange={(e) => setCompterAvance(e.target.checked)} /> {t('etats.filter.countAdvance')}
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#334155' }}>
              <input type="checkbox" checked={retmat} onChange={(e) => setRetmat(e.target.checked)} /> {t('etats.filter.morningLate')}
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#334155' }}>
              <input type="checkbox" checked={retapres} onChange={(e) => setRetapres(e.target.checked)} /> {t('etats.filter.afternoonLate')}
            </label>
          </div>
        </div>

        <div className="ea-status-msg" style={{ marginLeft: 4 }}>
          <span className={hasEffectiveEmployees ? 'ea-status-msg-ok' : 'ea-status-msg-warn'}>
            {hasEffectiveEmployees
              ? t('etats.absence.selectedLabel', { label: effectiveEmployeesLabel, count: effectiveEmpcods.length })
              : t('etats.filter.noEffectiveEmps')}
          </span>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="ea-summary-grid">
        <div className="ea-summary-card ea-card-border-red">
          <div className="ea-summary-card-top">
            <span className="ea-summary-label">{t('etats.retard.kpiGlobalRate')}</span>
            <div className="ea-summary-icon ea-icon-bg-red"><TrendingUpIcon sx={{ fontSize: 19 }} /></div>
          </div>
          <div className="ea-summary-value">
            <AnimatedNumber value={kpis.rate} as="span" />
            <span className="ea-summary-unit">%</span>
          </div>
          <div className="ea-summary-footer">{t('etats.retard.summary.rateFooter')}</div>
        </div>

        <div className="ea-summary-card ea-card-border-blue">
          <div className="ea-summary-card-top">
            <span className="ea-summary-label">{t('etats.retard.kpiTotalDuration')}</span>
            <div className="ea-summary-icon ea-icon-bg-blue"><TimerIcon sx={{ fontSize: 19 }} /></div>
          </div>
          <div className="ea-summary-value">
            {/* kpis.totalRetard est typiquement formatté "HH:mm" — AnimatedNumber
                fait fallback gracieux sur la chaîne complète (pas d'animation
                possible sur un format temporel non-décimal). */}
            <AnimatedNumber value={kpis.totalRetard} as="span" />
          </div>
          <div className="ea-summary-footer">{t('etats.retard.summary.totalFooter')}</div>
        </div>

        <div className="ea-summary-card ea-card-border-amber">
          <div className="ea-summary-card-top">
            <span className="ea-summary-label">{t('etats.retard.kpiAvgByPunch')}</span>
            <div className="ea-summary-icon ea-icon-bg-orange"><HourglassEmptyIcon sx={{ fontSize: 19 }} /></div>
          </div>
          <div className="ea-summary-value">
            <AnimatedNumber value={kpis.avgMin} as="span" />
            <span className="ea-summary-unit">min</span>
          </div>
          <div className="ea-summary-footer">{t('etats.retard.summary.avgFooter')}</div>
        </div>

        <div className="ea-summary-card ea-card-border-green">
          <div className="ea-summary-card-top">
            <span className="ea-summary-label">{t('etats.retard.kpiImpacted')}</span>
            <div className="ea-summary-icon ea-icon-bg-green"><GroupIcon sx={{ fontSize: 19 }} /></div>
          </div>
          <div className="ea-summary-value">
            <AnimatedNumber value={kpis.impactedEmps} as="span" />
            <span className="ea-summary-unit">/ {kpis.uniqueEmps}</span>
          </div>
          <div className="ea-summary-footer">{t('etats.retard.summary.impactedFooter')}</div>
        </div>
      </div>

      {/* ── Table Section ── */}
      <div className="ea-table-section">
        <div className="ea-table-header">
          <div>
            <div className="ea-table-title"><CheckCircleOutlineIcon /> {t('etats.retard.tableTitle')}</div>
            <div className="ea-table-subtitle">
              {t('etats.retard.tableSubtitle', { start: fmtDate(dateDebut), end: fmtDate(dateFin) })}
            </div>
          </div>
          <div className="ea-table-actions">
            <button className="ea-export-btn" onClick={handleExportPdf} disabled={!filteredRows.length}>
              <DownloadIcon sx={{ fontSize: 13 }} /> {t('etats.retard.exportPdf')}
            </button>
            <button className="ea-export-btn" onClick={handlePrintReport} disabled={!hasEffectiveEmployees}>
              <PrintIcon sx={{ fontSize: 13 }} /> {t('etats.filter.printBtn')}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="ea-loading"><CircularProgress size={38} /></div>
        ) : (
          <>
            <div className="ea-table-wrap">
              <table className="ea-table">
                <thead>
                  <tr>
                    <th>{t('etats.retard.headers.employee')}</th>
                    <th>{t('etats.retard.headers.date')}</th>
                    <th>{t('etats.retard.headers.schedule')}</th>
                    <th>{t('etats.retard.headers.punch')}</th>
                    <th className="ea-th-right">{t('etats.retard.headers.lateDuration')}</th>
                    <th>{t('etats.retard.headers.status')}</th>
                    <th style={{ textAlign: 'right' }}>{t('etats.absence.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="ea-no-data">
                        {searchTriggered ? t('etats.retard.noData') : t('etats.absence.table.clickSearch')}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((row, idx) => {
                      const absoluteIndex = (currentPage - 1) * pageSize + idx;
                      const planned = `${row.entree1 || DASH} - ${row.sortie2 || DASH}`;
                      const pointage = row.entree1 || DASH;
                      const justified = Boolean(row.motif && row.motif.trim() && row.motif !== DASH);
                      const totalRet = (row as any).totalRetard || '00:00';
                      return (
                        <tr key={`${row.empcod}-${row.predat}-${absoluteIndex}`}>
                          <td>
                            <div className="ea-td-name">
                              <div className="ea-td-avatar">{getInitials(row.emplib || row.empcod || '?')}</div>
                              <span className="ea-td-name-text">{row.emplib || row.empcod || '—'}</span>
                            </div>
                          </td>
                          <td className="ea-td-date">{fmtDate(row.predat)}</td>
                          <td className="ea-td-text">{planned}</td>
                          <td className="ea-td-text" style={{ color: '#b91c1c', fontWeight: 700 }}>{pointage}</td>
                          <td className="ea-td-right">
                            <span className={`ea-abs-badge ${toMinutes(totalRet) > 0 ? 'ea-abs-badge-red' : 'ea-abs-badge-gray'}`}>
                              {totalRet}
                            </span>
                          </td>
                          <td>
                            <span className={`ea-abs-badge ${justified ? 'ea-abs-badge-green' : 'ea-abs-badge-gray'}`}>
                              {justified ? t('etats.retard.justified') : t('etats.retard.notJustified')}
                            </span>
                          </td>
                          <td className="ea-actions">
                            <button className="ea-action-btn" onClick={() => openDrawer(row)} title={t('etats.retard.detailsBtn')}>
                              <VisibilityIcon sx={{ fontSize: 13 }} />
                              <span className="ea-action-label">{t('etats.retard.detailsBtn')}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredRows.length > 0 && (
              <div className="ea-table-footer">
                <span className="ea-table-footer-info">
                  {t('etats.absence.table.pagination', {
                    start: Math.min((currentPage - 1) * pageSize + 1, filteredRows.length),
                    end: Math.min(currentPage * pageSize, filteredRows.length),
                    total: filteredRows.length,
                  })}
                </span>
                <div className="ea-pagination">
                  <button className="ea-page-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeftIcon sx={{ fontSize: 13 }} />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                    <button key={i} className={`ea-page-btn ${currentPage === i + 1 ? 'ea-page-btn-active' : ''}`} onClick={() => setCurrentPage(i + 1)}>
                      {i + 1}
                    </button>
                  ))}
                  <button className="ea-page-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                    <ChevronRightIcon sx={{ fontSize: 13 }} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Drawer ── */}
      {drawerOpen && <div className="ea-overlay ea-overlay-visible" onClick={closeDrawer} />}
      <div className={`ea-drawer ${drawerOpen ? 'ea-drawer-open' : ''}`}>
        <div className="ea-drawer-header">
          <div>
            <h3 className="ea-drawer-title">{t('etats.retard.detailsTitle')}</h3>
            <p className="ea-drawer-subtitle">{fmtDateLong(selectedRow?.predat)}</p>
          </div>
          <button className="ea-drawer-close" onClick={closeDrawer}><CloseIcon sx={{ fontSize: 16 }} /></button>
        </div>

        {selectedRow && (
          <div className="ea-drawer-body">
            <div className="ea-drawer-section">
              <div className="ea-drawer-identity">
                <div className="ea-drawer-avatar">{getInitials(selectedRow.emplib || selectedRow.empcod || '?')}</div>
                <div>
                  <div className="ea-drawer-name">{selectedRow.emplib || '—'}</div>
                  <span className="ea-drawer-matricule">
                    {t('etats.absence.drawer.matriculeLabel', { value: selectedRow.empmat || selectedRow.empcod || '—' })}
                  </span>
                </div>
              </div>
              <div className="ea-drawer-grid">
                <div className="ea-drawer-field">
                  <div className="ea-drawer-field-label">{t('etats.retard.id')}</div>
                  <div className="ea-drawer-field-value">{selectedRow.empcod || '—'}</div>
                </div>
                <div className="ea-drawer-field">
                  <div className="ea-drawer-field-label">{t('etats.absence.drawer.regime')}</div>
                  <div className="ea-drawer-field-value">{selectedRow.empreg || '—'}</div>
                </div>
              </div>
            </div>

            <div className="ea-drawer-section">
              <h5 className="ea-drawer-section-title">
                <span className="ea-drawer-bar ea-drawer-bar-blue" />
                {t('etats.retard.punchesRecorded')}
              </h5>
              <div className="ea-drawer-row">
                <span className="ea-drawer-row-label">{t('etats.retard.entryMorning')}</span>
                <span className="ea-drawer-row-value">{selectedRow.entree1 || '—'}</span>
              </div>
              <div className="ea-drawer-row">
                <span className="ea-drawer-row-label">{t('etats.retard.lateMorning')}</span>
                <span className="ea-drawer-row-value" style={{ color: '#b91c1c', fontWeight: 700 }}>{selectedRow.preretmateup || '00:00'}</span>
              </div>
              <div className="ea-drawer-row">
                <span className="ea-drawer-row-label">{t('etats.retard.entryAfternoon')}</span>
                <span className="ea-drawer-row-value">{selectedRow.entree2 || '—'}</span>
              </div>
              <div className="ea-drawer-row">
                <span className="ea-drawer-row-label">{t('etats.retard.lateAfternoon')}</span>
                <span className="ea-drawer-row-value" style={{ color: '#b91c1c', fontWeight: 700 }}>{selectedRow.preretameup || '00:00'}</span>
              </div>
              <div className="ea-drawer-row ea-drawer-row-highlight">
                <span className="ea-drawer-row-value" style={{ fontWeight: 700, color: '#b91c1c' }}>
                  {t('etats.retard.total')}
                </span>
                <span className="ea-drawer-row-value" style={{ fontWeight: 900, color: '#b91c1c' }}>
                  {(selectedRow as any).totalRetard || '00:00'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EtatRetard;
