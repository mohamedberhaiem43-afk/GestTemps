import { useEffect, useMemo, useState } from 'react';
import { CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
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
import NightsStayIcon from '@mui/icons-material/NightsStay';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import EmployeeMultiSelectDropdown from '../../helper/EmployeeMultiSelectDropdown';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import { useEmployeeFilter } from '../../../hooks/employeHooks/useEmployeeFilter';
import useGetEmployeesLibs from '../../../hooks/employeHooks/useGetEmployeesLibs';
import useGetEtatPresence from '../../../hooks/presenceHooks/useGetEtatPresence';
import apiInstance from '../../API/apiInstance';
import EtatPresenceModel from '../../../models/EtatPresece';

import '../EtatAbsence/Etatabsence.css';

const DASH = '—';

const hasTimeValue = (value?: string | null): boolean => {
  if (!value) return false;
  const cleaned = value.trim();
  return cleaned !== '' && cleaned !== '00:00' && cleaned !== DASH && cleaned !== '-';
};

const toMinutes = (value?: string | null): number => {
  if (!hasTimeValue(value)) return 0;
  const match = (value ?? '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
};

const toHHMM = (minutes: number): string => {
  const safe = Math.max(0, minutes);
  const h = Math.floor(safe / 60).toString().padStart(2, '0');
  const m = Math.floor(safe % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

const asBool = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.toLowerCase();
    return v === 'true' || v === '1' || v === 'oui';
  }
  return false;
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

const readRetard = (row: EtatPresenceModel): string => {
  const total = toMinutes(row.preretmateup) + toMinutes(row.preretameup);
  return total > 0 ? toHHMM(total) : row.totalRetard || '00:00';
};

const regimeOptions: Record<string, string> = { M: 'Mensuelle', H: 'Horaire' };

function EtatPresence() {
  const { t } = useTranslation();
  const { soccod, hasPermission } = useAuth();

  if (!hasPermission('Rapports et Statistiques', 'consult')) {
    return <AccessDenied message={t('etats.presence.noConsultRight')} />;
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

  useEffect(() => { setSelectedRegime('T'); }, [setSelectedRegime]);

  const { data: emplibs = {} } = useGetEmployeesLibs(selectedFiliale, selectedService, undefined, selectedRegime);

  // Dates
  const [dateDebut, setDateDebut] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateFin, setDateFin] = useState(() => new Date().toISOString().slice(0, 10));
  const [annee, setAnnee] = useState(new Date().getFullYear().toString());

  // UI
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [selectedRow, setSelectedRow] = useState<EtatPresenceModel | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Bornes par défaut depuis paramètres société
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
        const pad = (n: number | string) => String(n).padStart(2, '0');
        // joudeb/joufin viennent du backend en string non paddé (« 1 » plutôt
        // que « 01 »). Sans padding ici, on produisait des chaînes type
        // « 2026-04-1 » que `new Date(...)` parse comme Invalid Date sur
        // certains navigateurs → toISOString() → RangeError → crash page.
        setAnnee(year.toString());
        setDateDebut(`${sy}-${pad(sm)}-${pad(joudeb)}`);
        setDateFin(`${ey}-${pad(em)}-${pad(joufin)}`);
      })
      .catch((err) => console.error('Params error:', err));
  }, [soccod]);

  useEffect(() => {
    if (!annee) return;
    const sp = dateDebut.split('-'); const ep = dateFin.split('-');
    if (sp.length === 3) setDateDebut(`${annee}-${sp[1]}-${sp[2]}`);
    if (ep.length === 3) setDateFin(`${annee}-${ep[1]}-${ep[2]}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annee]);

  const { data: rawData = [], isLoading, refetch } = useGetEtatPresence(
    new Date(dateDebut),
    new Date(dateFin),
    hasEffectiveEmployees ? effectiveEmpcods : [],
    selectedRegime || 'T',
  );

  const rows: EtatPresenceModel[] = useMemo(() => (rawData as EtatPresenceModel[]) || [], [rawData]);

  // ── Filtre recherche
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const text = `${row.emplib ?? ''} ${row.empcod ?? ''} ${row.empmat ?? ''} ${row.motif ?? ''} ${fmtDate(row.predat)}`.toLowerCase();
      return text.includes(q);
    });
  }, [rows, search]);

  // ── KPIs
  const kpis = useMemo(() => {
    const lateRows = filteredRows.filter((r) => toMinutes(readRetard(r)) > 0);
    const lateMinutes = lateRows.reduce((acc, r) => acc + toMinutes(readRetard(r)), 0);
    const nightMinutes = filteredRows.reduce((acc, r) => acc + toMinutes(r.tothnuit), 0);
    const totalEmps = new Set(filteredRows.map((r) => r.empcod).filter(Boolean)).size;
    const impactedEmps = new Set(lateRows.map((r) => r.empcod).filter(Boolean)).size;
    const rate = totalEmps > 0 ? (impactedEmps / totalEmps) * 100 : 0;
    return {
      lateRate: rate.toFixed(1),
      totalLate: toHHMM(lateMinutes),
      avgLate: lateRows.length > 0 ? Math.round(lateMinutes / lateRows.length) : 0,
      totalNight: toHHMM(nightMinutes),
      totalEmps,
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

  // Garde de validité ISO (yyyy-MM-dd) ET de la date elle-même (un vrai jour
  // calendaire, pas "2026-04-31" ni "2026-02-30"). Évite d'émettre une requête
  // qui finirait en 500 côté backend FastReport.
  const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
  const isValidIsoDate = (s: string) => {
    if (!ISO_DATE_REGEX.test(s)) return false;
    const d = new Date(s);
    return !Number.isNaN(d.getTime());
  };

  const handlePrintReport = async () => {
    if (!soccod || !hasEffectiveEmployees) return;
    if (!isValidIsoDate(dateDebut) || !isValidIsoDate(dateFin)) {
      console.warn('Rapport non lancé : bornes de période invalides', { dateDebut, dateFin });
      return;
    }
    try {
      const params = new URLSearchParams();
      effectiveEmpcods.forEach((c) => params.append('empcods', c));
      const response = await apiInstance.get(
        `/Presences/get-etat-presence-report/${soccod}/${dateDebut}/${dateFin}/${selectedRegime || 'T'}`,
        { params, responseType: 'blob' },
      );
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `etat-presence-${dateDebut}_${dateFin}.pdf`);
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Rapport erreur:', err);
    }
  };

  const handleExportExcel = () => {
    if (!filteredRows.length) return;
    const title = [`${t('etats.presence.title')} — ${fmtDate(dateDebut)} → ${fmtDate(dateFin)}`];
    const headers = [
      t('etats.presence.headers.employee'),
      t('etats.absence.table.matricule'),
      t('etats.presence.headers.date'),
      t('etats.presence.entryMorning'),
      t('etats.presence.exitMorning'),
      t('etats.presence.entryAfternoon'),
      t('etats.presence.exitAfternoon'),
      t('etats.presence.lateMorning'),
      t('etats.presence.lateAfternoon'),
      t('etats.presence.totalLate'),
      t('etats.presence.nightHour'),
      t('etats.presence.regimeLabel'),
      t('etats.presence.motif'),
    ];
    const data = filteredRows.map((row) => [
      row.emplib || '', row.empmat || '', fmtDate(row.predat),
      row.entree1 || '', row.sortie1 || '', row.entree2 || '', row.sortie2 || '',
      row.preretmateup || '', row.preretameup || '',
      readRetard(row), row.tothnuit || '',
      row.empreg || '', row.motif || '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([title, [], headers, ...data]);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 12 } }];
    ws['!cols'] = Array(13).fill({ wch: 14 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Presence');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `etat-presence-${annee}.xlsx`);
  };

  const openDrawer = (row: EtatPresenceModel) => { setSelectedRow(row); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setTimeout(() => setSelectedRow(null), 300); };

  return (
    <div className="ea-page">
      {/* ── Header ── */}
      <div className="ea-header">
        <div className="ea-header-left">
          <div>
            <h2 className="ea-title">{t('etats.presence.title')}</h2>
            <p className="ea-subtitle">{t('etats.presence.subtitle')}</p>
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
            <label className="ea-filter-label">{t('etats.presence.search')}</label>
            <input
              type="text"
              className="ea-filter-input"
              placeholder={t('etats.presence.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="ea-search-btn" onClick={handleSearch} disabled={!hasEffectiveEmployees || isLoading}>
            {isLoading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon sx={{ fontSize: 15 }} />}
            {t('etats.filter.filterBtn')}
          </button>
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
            <span className="ea-summary-label">{t('etats.presence.kpiLateRate')}</span>
            <div className="ea-summary-icon ea-icon-bg-red"><TrendingUpIcon sx={{ fontSize: 19 }} /></div>
          </div>
          <div className="ea-summary-value">
            <AnimatedNumber value={kpis.lateRate} as="span" />
            <span className="ea-summary-unit">%</span>
          </div>
          <div className="ea-summary-footer">{t('etats.presence.summary.lateRateFooter')}</div>
        </div>

        <div className="ea-summary-card ea-card-border-blue">
          <div className="ea-summary-card-top">
            <span className="ea-summary-label">{t('etats.presence.kpiTotalLate')}</span>
            <div className="ea-summary-icon ea-icon-bg-blue"><TimerIcon sx={{ fontSize: 19 }} /></div>
          </div>
          <div className="ea-summary-value">
            <AnimatedNumber value={kpis.totalLate} as="span" />
          </div>
          <div className="ea-summary-footer">{t('etats.presence.summary.totalLateFooter')}</div>
        </div>

        <div className="ea-summary-card ea-card-border-amber">
          <div className="ea-summary-card-top">
            <span className="ea-summary-label">{t('etats.presence.kpiAvgLate')}</span>
            <div className="ea-summary-icon ea-icon-bg-orange"><GroupIcon sx={{ fontSize: 19 }} /></div>
          </div>
          <div className="ea-summary-value">
            <AnimatedNumber value={kpis.avgLate} as="span" />
            <span className="ea-summary-unit">min</span>
          </div>
          <div className="ea-summary-footer">
            {t('etats.presence.summary.avgFooter', { count: kpis.totalEmps })}
          </div>
        </div>

        <div className="ea-summary-card ea-card-border-purple">
          <div className="ea-summary-card-top">
            <span className="ea-summary-label">{t('etats.presence.kpiTotalNight')}</span>
            <div className="ea-summary-icon ea-icon-bg-purple"><NightsStayIcon sx={{ fontSize: 19 }} /></div>
          </div>
          <div className="ea-summary-value">
            <AnimatedNumber value={kpis.totalNight} as="span" />
          </div>
          <div className="ea-summary-footer">{t('etats.presence.summary.nightFooter')}</div>
        </div>
      </div>

      {/* ── Table Section ── */}
      <div className="ea-table-section">
        <div className="ea-table-header">
          <div>
            <div className="ea-table-title"><CheckCircleOutlineIcon /> {t('etats.presence.tableTitle')}</div>
            <div className="ea-table-subtitle">
              {t('etats.presence.tableSubtitle', { start: fmtDate(dateDebut), end: fmtDate(dateFin) })}
            </div>
          </div>
          <div className="ea-table-actions">
            <button className="ea-export-btn" onClick={handleExportExcel} disabled={!filteredRows.length}>
              <DownloadIcon sx={{ fontSize: 13 }} /> {t('etats.absence.table.exportExcel')}
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
                    <th>{t('etats.presence.headers.employee')}</th>
                    <th>{t('etats.presence.headers.date')}</th>
                    <th>{t('etats.presence.headers.schedule')}</th>
                    <th>{t('etats.presence.headers.punch')}</th>
                    <th className="ea-th-right">{t('etats.presence.headers.lateDuration')}</th>
                    <th>{t('etats.presence.headers.status')}</th>
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
                      const retard = readRetard(row);
                      const statusKind: 'leave' | 'breastfeeding' | 'normal' =
                        asBool(row.hasConge) ? 'leave' : (asBool(row.allaitement) ? 'breastfeeding' : 'normal');
                      const statusLabel = statusKind === 'leave'
                        ? t('etats.presence.statusLeave')
                        : statusKind === 'breastfeeding'
                          ? t('etats.presence.statusBreastfeeding')
                          : t('etats.presence.statusNormal');
                      const statusClass = statusKind === 'leave'
                        ? 'ea-abs-badge-gray'
                        : statusKind === 'breastfeeding'
                          ? 'ea-abs-badge-green'
                          : 'ea-abs-badge-blue';
                      return (
                        <tr key={`${row.empcod}-${row.predat}-${absoluteIndex}`}>
                          <td>
                            <div className="ea-td-name">
                              <div className="ea-td-avatar">{getInitials(row.emplib || row.empcod || '?')}</div>
                              <div>
                                <span className="ea-td-name-text">{row.emplib || row.empcod || '—'}</span>
                                <div style={{ fontSize: 11, color: '#64748b' }}>#{row.empmat || row.empcod}</div>
                              </div>
                            </div>
                          </td>
                          <td className="ea-td-date">{fmtDate(row.predat)}</td>
                          <td className="ea-td-text">{planned}</td>
                          <td className="ea-td-text" style={{ color: '#b91c1c', fontWeight: 700 }}>{pointage}</td>
                          <td className="ea-td-right">
                            <span className={`ea-abs-badge ${toMinutes(retard) > 0 ? 'ea-abs-badge-red' : 'ea-abs-badge-gray'}`}>
                              {retard}
                            </span>
                          </td>
                          <td>
                            <span className={`ea-abs-badge ${statusClass}`}>{statusLabel}</span>
                          </td>
                          <td className="ea-actions">
                            <button className="ea-action-btn" onClick={() => openDrawer(row)} title={t('etats.presence.detailsTitle')}>
                              <VisibilityIcon sx={{ fontSize: 13 }} />
                              <span className="ea-action-label">{t('etats.absence.table.details')}</span>
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
            <h3 className="ea-drawer-title">{t('etats.presence.detailsTitle')}</h3>
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
                  <div className="ea-drawer-field-label">{t('etats.presence.id')}</div>
                  <div className="ea-drawer-field-value">{selectedRow.empcod || '—'}</div>
                </div>
                <div className="ea-drawer-field">
                  <div className="ea-drawer-field-label">{t('etats.presence.regimeLabel')}</div>
                  <div className="ea-drawer-field-value">{selectedRow.empreg || '—'}</div>
                </div>
              </div>
              {selectedRow.motif && (
                <div style={{ marginTop: 10 }}>
                  <div className="ea-drawer-field">
                    <div className="ea-drawer-field-label">{t('etats.presence.motif')}</div>
                    <div className="ea-drawer-field-value" style={{ fontWeight: 500 }}>{selectedRow.motif}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="ea-drawer-section">
              <h5 className="ea-drawer-section-title">
                <span className="ea-drawer-bar ea-drawer-bar-blue" />
                {t('etats.presence.punchesRecorded')}
              </h5>
              <div className="ea-drawer-row">
                <span className="ea-drawer-row-label">{t('etats.presence.entryMorning')}</span>
                <span className="ea-drawer-row-value">{selectedRow.entree1 || '—'}</span>
              </div>
              <div className="ea-drawer-row">
                <span className="ea-drawer-row-label">{t('etats.presence.exitMorning')}</span>
                <span className="ea-drawer-row-value">{selectedRow.sortie1 || '—'}</span>
              </div>
              <div className="ea-drawer-row">
                <span className="ea-drawer-row-label">{t('etats.presence.entryAfternoon')}</span>
                <span className="ea-drawer-row-value">{selectedRow.entree2 || '—'}</span>
              </div>
              <div className="ea-drawer-row">
                <span className="ea-drawer-row-label">{t('etats.presence.exitAfternoon')}</span>
                <span className="ea-drawer-row-value">{selectedRow.sortie2 || '—'}</span>
              </div>
              <div className="ea-drawer-row ea-drawer-row-highlight">
                <span className="ea-drawer-row-value" style={{ fontWeight: 700, color: '#b91c1c' }}>
                  {t('etats.presence.totalLate')}
                </span>
                <span className="ea-drawer-row-value" style={{ fontWeight: 900, color: '#b91c1c' }}>
                  {readRetard(selectedRow)}
                </span>
              </div>
            </div>

            <div className="ea-drawer-section">
              <h5 className="ea-drawer-section-title">
                <span className="ea-drawer-bar ea-drawer-bar-purple" />
                {t('etats.presence.dailyDetail')}
              </h5>
              <div className="ea-drawer-row">
                <span className="ea-drawer-row-label">{t('etats.presence.totalHours')}</span>
                <span className="ea-drawer-row-value">{selectedRow.totalHeure || '—'}</span>
              </div>
              <div className="ea-drawer-row">
                <span className="ea-drawer-row-label">{t('etats.presence.lateMorning')}</span>
                <span className="ea-drawer-row-value">{selectedRow.preretmateup || '—'}</span>
              </div>
              <div className="ea-drawer-row">
                <span className="ea-drawer-row-label">{t('etats.presence.lateAfternoon')}</span>
                <span className="ea-drawer-row-value">{selectedRow.preretameup || '—'}</span>
              </div>
              <div className="ea-drawer-row">
                <span className="ea-drawer-row-label">{t('etats.presence.nightHour')}</span>
                <span className="ea-drawer-row-value" style={{ color: '#6b21a8', fontWeight: 700 }}>
                  {selectedRow.tothnuit || '—'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EtatPresence;
