import { useEffect, useMemo, useState } from 'react';
import { CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import EmployeeMultiSelectDropdown from '../../helper/EmployeeMultiSelectDropdown';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import { useEmployeeFilter } from '../../../hooks/employeHooks/useEmployeeFilter';
import apiInstance from '../../API/apiInstance';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Icons
import SearchIcon from '@mui/icons-material/Search';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import FilterListIcon from '@mui/icons-material/FilterList';
import DownloadIcon from '@mui/icons-material/FileDownload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import GroupIcon from '@mui/icons-material/Group';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import type EtatAbsenceModel from '../../../models/EtatAbsence';
import useGetEtatAbsence from '../../../hooks/absenceHooks/useGetEtatAbsence';
import { useAbsenceContext, AbsParamsProvider } from '../../helper/AbsParamsContext';
import { AnimatedNumber } from '../../shared/AnimatedNumber';

import './Etatabsence.css';
const regimeOptions: Record<string, string> = {
  '': 'Tous',
  M: 'Mensuelle',
  H: 'Horaire',
};

// Map absence codes to display colors
const getAbsBadgeClass = (abscod: string | null | undefined): string => {
  if (!abscod) return 'ea-abs-badge-gray';
  const code = abscod.toUpperCase();
  if (['CNP', 'CP'].includes(code)) return 'ea-abs-badge-blue';
  if (['MT', 'ML', 'AM'].includes(code)) return 'ea-abs-badge-amber';
  if (['ANJ', 'ANP'].includes(code)) return 'ea-abs-badge-red';
  if (['FM', 'MS'].includes(code)) return 'ea-abs-badge-purple';
  if (['AT', 'ACC'].includes(code)) return 'ea-abs-badge-green';
  return 'ea-abs-badge-gray';
};
const parseRetardMinutes = (val: string | number | null | undefined) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const parts = val.split(':');
  if (parts.length < 2) return 0;
  const [h, m] = parts;
  return parseInt(h) * 60 + parseInt(m);
};
// ─────────────────────────────────────────────
function EtatAbsence() {
  const { t } = useTranslation();
  const { soccod, hasPermission } = useAuth();

  if (!hasPermission('Rapports et Statistiques', 'consult')) {
    return <AccessDenied message={t('etats.absence.noConsultRight')} />;
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
    accessibleEmployees,
    selectedEmpCodes,
  } = useEmployeeFilter();

  const { absParams } = useAbsenceContext();

  // Dates
  const [dateDebut, setDateDebut] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateFin, setDateFin] = useState(() => new Date().toISOString().slice(0, 10));
  const [annee, setAnnee] = useState(new Date().getFullYear().toString());
  const [searchTriggered, setSearchTriggered] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Drawer
  const [selectedRow, setSelectedRow] = useState<EtatAbsenceModel | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Load default dates from backend
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
        let sy = sm === 0 ? year - 1 : year;
        let ey = em === 0 ? year - 1 : year;
        sm = sm === 0 ? 12 : sm;
        em = em === 0 ? 12 : em;
        const pad = (n: number) => String(n).padStart(2, '0');
        setAnnee(year.toString());
        setDateDebut(`${sy}-${pad(sm)}-${joudeb}`);
        setDateFin(`${ey}-${pad(em)}-${joufin}`);
      })
      .catch((err) => console.error('Params error:', err));
  }, [soccod]);

  // ── Sync year with dates
  useEffect(() => {
    if (!annee) return;
    const sp = dateDebut.split('-');
    const ep = dateFin.split('-');
    if (sp.length === 3) setDateDebut(`${annee}-${sp[1]}-${sp[2]}`);
    if (ep.length === 3) setDateFin(`${annee}-${ep[1]}-${ep[2]}`);
  }, [annee]);

  // ── Data fetching
  const { data: absenceData = [], isLoading, refetch } = useGetEtatAbsence(
    new Date(dateDebut),
    new Date(dateFin),
    effectiveEmpcods,
    absParams.absaut,
    absParams.absret,
    absParams.presNonOpt,
    absParams.sansPointageInvalide,
    absParams.radioValue,
  );

  // ── Handlers
  const handleSearch = () => {
    if (!hasEffectiveEmployees) return;
    setSearchTriggered(true);
    setCurrentPage(1);
    setTimeout(() => refetch(), 0);
  };

  const handlePrintReport = async () => {
    try {
      if (!soccod || !hasEffectiveEmployees) return;
      const response = await apiInstance.get(
        `/Absences/get-etat-absences-report/${soccod}/${dateDebut}/${dateFin}`,
        {
          responseType: 'blob',
          params: { empcods: effectiveEmpcods.join(',') },
        }
      );
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'etat-absences.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Rapport erreur:', err);
    }
  };

  const handleExportExcel = () => {
    if (!absenceData.length) return;

    const title = [`État des Absences — ${formatDate(dateDebut)} au ${formatDate(dateFin)}`];
    const headers = [
      'Code', 'Matricule', 'Nom et Prénom', 'Régime', 'Date',
      'Code Abs', 'Motif', 'Congé Payé', 'Acc. Travail', 'C.S.F',
      'Abs. Just.', 'Formation+Mission', 'Arret Technique', 'Abs. Maladie',
      'Abs. Non Just.', 'MAP', 'Aut. S. Payé', 'Aut. S. Non Payé',
      'Congé Sans Solde', 'Abs.jour+Retard', 'Absence',
    ];

    const rows = absenceData.map((d) => [
      d.empcod, d.empmat, d.emplib, d.empreg,
      d.date ? new Date(d.date).toLocaleDateString('fr-FR') : '',
      d.abscod, d.motif,
      d.congepaye, d.acctrav, d.csf, d.absjust, d.fm,
      d.arrtech, d.absmal, d.absnj, d.map,
      d.autsp, d.autsnp, d.css, d.absjourretard, d.absence,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([title, [], headers, ...rows]);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 20 } }];
    ws['!cols'] = Array(21).fill({ wch: 14 });
    ws['!cols'][2] = { wch: 26 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Etat Absences');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    saveAs(blob, `etat-absences-${annee}.xlsx`);
  };

  // ── Helpers
  const getInitials = (name: string | null | undefined) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase()
      : parts[0].substring(0, 2).toUpperCase();
  };

  const formatDate = (d: any) => {
    if (!d) return '';
    const date = new Date(d);
    return !isNaN(date.getTime()) ? date.toLocaleDateString('fr-FR') : '';
  };

  // ── Filtrer les retards < 2h sans absence réelle
  const filteredData = useMemo(
    () => absenceData.filter((r) => {
      const hasRealAbsence = Number(r.absence || 0) > 0
        || Number(r.absjust || 0) > 0
        || Number(r.absnj || 0) > 0
        || Number(r.congepaye || 0) > 0
        || Number(r.acctrav || 0) > 0
        || Number(r.csf || 0) > 0
        || Number(r.absmal || 0) > 0
        || Number(r.fm || 0) > 0
        || Number(r.arrtech || 0) > 0
        || Number(r.map || 0) > 0
        || Number(r.autsp || 0) > 0
        || Number(r.autsnp || 0) > 0
        || Number(r.css || 0) > 0;
      // Exclure seulement si retard < 2h ET aucune vraie absence
      const retardMinutes = parseRetardMinutes(r.absjourretard || '0:00');
      return hasRealAbsence || retardMinutes > 120;
    }),
    [absenceData]
  );

  // ── Computed stats
  const totalEmployes = useMemo(
    () => new Set(filteredData.map((r) => r.empmat)).size,
    [filteredData]
  );

  const totalAbsJustifiees = useMemo(
    () => filteredData.reduce((s, r) => s + Number(r.absjust || 0), 0),
    [filteredData]
  );

  const totalAbsNonJustifiees = useMemo(
    () => filteredData.reduce((s, r) => s + Number(r.absnj || 0), 0),
    [filteredData]
  );

  const totalJoursAbsence = useMemo(
    () => filteredData.reduce((s, r) => s + Number(r.absence || 0), 0),
    [filteredData]
  );

  // ── Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ── Drawer
  const openDrawer = (row: EtatAbsenceModel) => { setSelectedRow(row); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setTimeout(() => setSelectedRow(null), 300); };

  // ──────────────────────────────────────────
  return (
    <div className="ea-page">

      {/* ── Header ── */}
      <div className="ea-header">
        <div className="ea-header-left">
          <div>
            <h2 className="ea-title">{t('etats.absence.title')}</h2>
            <p className="ea-subtitle">{t('etats.absence.subtitle')}</p>
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
              {['2026', '2025', '2024', '2023'].map((y) => (
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
              <select
                className="ea-filter-select"
                value={selectedFiliale}
                onChange={(e) => setSelectedFiliale(e.target.value)}
              >
                <option value="">{t('etats.filter.all')}</option>
                {Object.entries(filiale).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          )}
          {services && Object.keys(services).length > 0 && (
            <div className="ea-filter-field">
              <label className="ea-filter-label">{t('etats.filter.service')}</label>
              <select
                className="ea-filter-select"
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                disabled={isServiceLocked}
              >
                <option value="">{isServiceLocked ? t('etats.filter.myService') : t('etats.filter.allService')}</option>
                {Object.entries(services).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          )}
          <div className="ea-filter-field">
            <label className="ea-filter-label">{t('etats.absence.regime')}</label>
            <select
              className="ea-filter-select"
              value={selectedRegime}
              onChange={(e) => setSelectedRegime(e.target.value)}
            >
              {Object.entries(regimeOptions).map(([k, v]) => (
                <option key={k} value={k}>{k === '' ? t('etats.filter.regimeAll') : v}</option>
              ))}
            </select>
          </div>
          <div className="ea-filter-field-narrow">
            <label className="ea-filter-label">{t('etats.absence.dateStart')}</label>
            <input
              type="date"
              className="ea-filter-input"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
          </div>
          <div className="ea-filter-field-narrow">
            <label className="ea-filter-label">{t('etats.absence.dateEnd')}</label>
            <input
              type="date"
              className="ea-filter-input"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
            />
          </div>
          <div className="ea-filter-field" style={{ minWidth: 250, flexGrow: 1 }}>
            <label className="ea-filter-label">{t('etats.absence.employees')}</label>
            <EmployeeMultiSelectDropdown
              options={accessibleEmployees.map(e => ({ code: e.empcod, label: `${e.empcod} - ${e.emplib}` }))}
              value={selectedEmpCodes}
              onChange={handleEmployeeSelection}
              minWidth={250}
            />
          </div>
          <button className="ea-search-btn" onClick={handleSearch} disabled={!hasEffectiveEmployees || isLoading}>
            {isLoading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon sx={{ fontSize: 15 }} />}
            {t('etats.absence.search')}
          </button>
        </div>
        <div className="ea-status-msg" style={{ marginLeft: 4 }}>
          <span className={hasEffectiveEmployees ? 'ea-status-msg-ok' : 'ea-status-msg-warn'}>
            {hasEffectiveEmployees
              ? t('etats.absence.selectedLabel', { label: effectiveEmployeesLabel, count: effectiveEmpcods.length })
              : t('etats.absence.noEmpFilter')}
          </span>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="ea-summary-grid">
        <div className="ea-summary-card ea-card-border-blue">
          <div className="ea-summary-card-top">
            <span className="ea-summary-label">{t('etats.absence.summary.employees')}</span>
            <div className="ea-summary-icon ea-icon-bg-blue">
              <GroupIcon sx={{ fontSize: 19 }} />
            </div>
          </div>
          {/* AnimatedNumber : compteur count-up easeOutCubic au montage et à chaque
              changement (nouveau filtre, nouvelle période). */}
          <AnimatedNumber value={totalEmployes} as="span" className="ea-summary-value" />
          <div className="ea-summary-footer">{t('etats.absence.summary.employeesFooter')}</div>
        </div>

        <div className="ea-summary-card ea-card-border-red">
          <div className="ea-summary-card-top">
            <span className="ea-summary-label">{t('etats.absence.summary.totalAbs')}</span>
            <div className="ea-summary-icon ea-icon-bg-red">
              <EventBusyIcon sx={{ fontSize: 19 }} />
            </div>
          </div>
          <div className="ea-summary-value">
            <AnimatedNumber value={absenceData.length} as="span" />
            <span className="ea-summary-unit">{t('etats.absence.summary.rows')}</span>
          </div>
          <div className="ea-summary-footer">{t('etats.absence.summary.rowsFooter')}</div>
        </div>

        <div className="ea-summary-card ea-card-border-amber">
          <div className="ea-summary-card-top">
            <span className="ea-summary-label">{t('etats.absence.summary.absNonJust')}</span>
            <div className="ea-summary-icon ea-icon-bg-orange">
              <AssignmentLateIcon sx={{ fontSize: 19 }} />
            </div>
          </div>
          <div className="ea-summary-value">
            <AnimatedNumber
              value={totalAbsNonJustifiees}
              as="span"
              formatValue={(n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            />
            <span className="ea-summary-unit">{t('etats.absence.summary.days')}</span>
          </div>
          <div className="ea-summary-footer">
            {t('etats.absence.summary.justifiedFooter', { value: totalAbsJustifiees.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) })}
          </div>
        </div>

        <div className="ea-summary-card ea-card-border-green">
          <div className="ea-summary-card-top">
            <span className="ea-summary-label">{t('etats.absence.summary.totalDays')}</span>
            <div className="ea-summary-icon ea-icon-bg-green">
              <HourglassEmptyIcon sx={{ fontSize: 19 }} />
            </div>
          </div>
          <div className="ea-summary-value">
            <AnimatedNumber
              value={totalJoursAbsence}
              as="span"
              formatValue={(n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            />
            <span className="ea-summary-unit">{t('etats.absence.summary.days')}</span>
          </div>
          <div className="ea-summary-footer">{t('etats.absence.summary.cumulative')}</div>
        </div>
      </div>

      {/* ── Table Section ── */}
      <div className="ea-table-section">
        <div className="ea-table-header">
          <div>
            <div className="ea-table-title">
              <CheckCircleOutlineIcon />
              {t('etats.absence.table.title')}
            </div>
            <div className="ea-table-subtitle">
              {t('etats.absence.table.period', { start: formatDate(dateDebut), end: formatDate(dateFin) })}
            </div>
          </div>
          <div className="ea-table-actions">
            <button className="ea-export-btn" onClick={handleExportExcel} disabled={!filteredData.length}>
              <DownloadIcon sx={{ fontSize: 13 }} />
              {t('etats.absence.table.exportExcel')}
            </button>
            <button className="ea-export-btn" onClick={handlePrintReport} disabled={!hasEffectiveEmployees}>
              <PrintIcon sx={{ fontSize: 13 }} />
              {t('etats.absence.table.printPdf')}
            </button>
            <button className="ea-filter-toggle" title={t('etats.absence.table.filterBtn')}>
              <FilterListIcon sx={{ fontSize: 16 }} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="ea-loading">
            <CircularProgress size={38} />
          </div>
        ) : (
          <>
            <div className="ea-table-wrap">
              <table className="ea-table">
                <thead>
                  <tr>
                    <th>{t('etats.absence.table.matricule')}</th>
                    <th>{t('etats.absence.table.collaborator')}</th>
                    <th>{t('etats.absence.table.date')}</th>
                    <th>{t('etats.absence.table.absCode')}</th>
                    <th>{t('etats.absence.table.motif')}</th>
                    <th>{t('etats.absence.table.regime')}</th>
                    <th className="ea-th-right">{t('etats.absence.table.absNJShort')}</th>
                    <th className="ea-th-right">{t('etats.absence.table.absJustShort')}</th>
                    <th style={{ textAlign: 'right' }}>{t('etats.absence.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="ea-no-data">
                        {searchTriggered
                          ? t('etats.absence.table.noData')
                          : t('etats.absence.table.clickSearch')}
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((item, idx) => (
                      <tr key={(currentPage - 1) * pageSize + idx}>
                        <td className="ea-td-matricule">{item.empmat}</td>
                        <td>
                          <div className="ea-td-name">
                            <div className="ea-td-avatar">{getInitials(item.emplib)}</div>
                            <span className="ea-td-name-text">{item.emplib}</span>
                          </div>
                        </td>
                        <td className="ea-td-date">{formatDate(item.date)}</td>
                        <td>
                          <span className={`ea-abs-badge ${getAbsBadgeClass(item.abscod)}`}>
                            {item.abscod || '—'}
                          </span>
                        </td>
                        <td className="ea-td-text">{item.motif || '—'}</td>
                        <td className="ea-td-text">{item.empreg || '—'}</td>
                        <td className="ea-td-right ea-td-bold" style={{ color: '#b91c1c' }}>
                          {item.absnj != null ? Number(item.absnj).toFixed(2) : '—'}
                        </td>
                        <td className="ea-td-right ea-td-primary ea-td-bold">
                          {item.absjust != null ? Number(item.absjust).toFixed(2) : '—'}
                        </td>
                        <td className="ea-actions">
                          <button className="ea-action-btn" onClick={() => openDrawer(item)} title={t('etats.absence.table.details')}>
                            <VisibilityIcon sx={{ fontSize: 13 }} />
                            <span className="ea-action-label">{t('etats.absence.table.details')}</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredData.length > 0 && (
              <div className="ea-table-footer">
                <span className="ea-table-footer-info">
                  {t('etats.absence.table.pagination', {
                    start: Math.min((currentPage - 1) * pageSize + 1, filteredData.length),
                    end: Math.min(currentPage * pageSize, filteredData.length),
                    total: filteredData.length,
                  })}
                </span>
                <div className="ea-pagination">
                  <button
                    className="ea-page-btn"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeftIcon sx={{ fontSize: 13 }} />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                    <button
                      key={i}
                      className={`ea-page-btn ${currentPage === i + 1 ? 'ea-page-btn-active' : ''}`}
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    className="ea-page-btn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRightIcon sx={{ fontSize: 13 }} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Overlay ── */}
      {drawerOpen && (
        <div className="ea-overlay ea-overlay-visible" onClick={closeDrawer} />
      )}

      {/* ── Details Drawer ── */}
      <div className={`ea-drawer ${drawerOpen ? 'ea-drawer-open' : ''}`}>
        <div className="ea-drawer-header">
          <div>
            <h3 className="ea-drawer-title">{t('etats.absence.drawer.title')}</h3>
            <p className="ea-drawer-subtitle">{t('etats.absence.drawer.subtitle')}</p>
          </div>
          <button className="ea-drawer-close" onClick={closeDrawer}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </button>
        </div>

        {selectedRow && (
          <>
            <div className="ea-drawer-body">

              {/* Identity */}
              <div className="ea-drawer-section">
                <div className="ea-drawer-identity">
                  <div className="ea-drawer-avatar">{getInitials(selectedRow.emplib)}</div>
                  <div>
                    <div className="ea-drawer-name">{selectedRow.emplib}</div>
                    <span className="ea-drawer-matricule">{t('etats.absence.drawer.matriculeLabel', { value: selectedRow.empmat })}</span>
                  </div>
                </div>
                <div className="ea-drawer-grid">
                  <div className="ea-drawer-field">
                    <div className="ea-drawer-field-label">{t('etats.absence.drawer.empCode')}</div>
                    <div className="ea-drawer-field-value">{selectedRow.empcod || '—'}</div>
                  </div>
                  <div className="ea-drawer-field">
                    <div className="ea-drawer-field-label">{t('etats.absence.drawer.regime')}</div>
                    <div className="ea-drawer-field-value">{selectedRow.empreg || '—'}</div>
                  </div>
                  <div className="ea-drawer-field">
                    <div className="ea-drawer-field-label">{t('etats.absence.drawer.date')}</div>
                    <div className="ea-drawer-field-value">{formatDate(selectedRow.date) || '—'}</div>
                  </div>
                  <div className="ea-drawer-field">
                    <div className="ea-drawer-field-label">{t('etats.absence.drawer.absCode')}</div>
                    <div className="ea-drawer-field-value">
                      <span className={`ea-abs-badge ${getAbsBadgeClass(selectedRow.abscod)}`}>
                        {selectedRow.abscod || '—'}
                      </span>
                    </div>
                  </div>
                </div>
                {selectedRow.motif && (
                  <div style={{ marginTop: 10 }}>
                    <div className="ea-drawer-field">
                      <div className="ea-drawer-field-label">{t('etats.absence.drawer.motif')}</div>
                      <div className="ea-drawer-field-value" style={{ fontWeight: 500 }}>{selectedRow.motif}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Absences justifiées */}
              <div className="ea-drawer-section">
                <h5 className="ea-drawer-section-title">
                  <span className="ea-drawer-bar ea-drawer-bar-blue" />
                  {t('etats.absence.drawer.justifiedSection')}
                </h5>
                <div className="ea-drawer-row">
                  <span className="ea-drawer-row-label">{t('etats.absence.drawer.paidLeave')}</span>
                  <span className="ea-drawer-row-value">{selectedRow.congepaye ?? '—'}</span>
                </div>
                <div className="ea-drawer-row">
                  <span className="ea-drawer-row-label">{t('etats.absence.drawer.workAccident')}</span>
                  <span className="ea-drawer-row-value">{selectedRow.acctrav ?? '—'}</span>
                </div>
                <div className="ea-drawer-row">
                  <span className="ea-drawer-row-label">{t('etats.absence.drawer.csf')}</span>
                  <span className="ea-drawer-row-value">{selectedRow.csf ?? '—'}</span>
                </div>
                <div className="ea-drawer-row ea-drawer-row-highlight">
                  <span className="ea-drawer-row-value" style={{ fontWeight: 700, color: '#1d4ed8' }}>
                    {t('etats.absence.drawer.absJust')}
                  </span>
                  <span className="ea-drawer-row-value" style={{ fontWeight: 900, color: '#1d4ed8' }}>
                    {selectedRow.absjust != null ? Number(selectedRow.absjust).toFixed(2) : '—'}
                  </span>
                </div>
              </div>

              {/* Absences non justifiées */}
              <div className="ea-drawer-section">
                <h5 className="ea-drawer-section-title">
                  <span className="ea-drawer-bar ea-drawer-bar-red" />
                  {t('etats.absence.drawer.nonJustifiedSection')}
                </h5>
                <div className="ea-drawer-row">
                  <span className="ea-drawer-row-label">{t('etats.absence.drawer.absSick')}</span>
                  <span className="ea-drawer-row-value">{selectedRow.absmal ?? '—'}</span>
                </div>
                <div className="ea-drawer-row ea-drawer-row-highlight">
                  <span className="ea-drawer-row-value" style={{ fontWeight: 700, color: '#b91c1c' }}>
                    {t('etats.absence.drawer.absNJ')}
                  </span>
                  <span className="ea-drawer-row-value" style={{ fontWeight: 900, color: '#b91c1c' }}>
                    {selectedRow.absnj != null ? Number(selectedRow.absnj).toFixed(2) : '—'}
                  </span>
                </div>
              </div>

              {/* Autres absences */}
              <div className="ea-drawer-section">
                <h5 className="ea-drawer-section-title">
                  <span className="ea-drawer-bar ea-drawer-bar-orange" />
                  {t('etats.absence.drawer.otherTypesSection')}
                </h5>
                {[
                  { key: 'fm', label: t('etats.absence.drawer.formationMission'), value: selectedRow.fm },
                  { key: 'arrtech', label: t('etats.absence.drawer.techStop'), value: selectedRow.arrtech },
                  { key: 'map', label: t('etats.absence.drawer.map'), value: selectedRow.map },
                  { key: 'autsp', label: t('etats.absence.drawer.autsp'), value: selectedRow.autsp },
                  { key: 'autsnp', label: t('etats.absence.drawer.autsnp'), value: selectedRow.autsnp },
                  { key: 'css', label: t('etats.absence.drawer.css'), value: selectedRow.css },
                ].map(({ key, label, value }) => (
                  <div className="ea-drawer-row" key={key}>
                    <span className="ea-drawer-row-label">{label}</span>
                    <span className="ea-drawer-row-value">{value ?? '—'}</span>
                  </div>
                ))}
              </div>

              {/* Totaux */}
              <div className="ea-drawer-section">
                <h5 className="ea-drawer-section-title">
                  <span className="ea-drawer-bar ea-drawer-bar-purple" />
                  {t('etats.absence.drawer.totalsSection')}
                </h5>
                <div className="ea-drawer-row">
                  <span className="ea-drawer-row-label">{t('etats.absence.drawer.absDayLate')}</span>
                  <span className="ea-drawer-row-value">{selectedRow.absjourretard ?? '—'}</span>
                </div>
                <div className="ea-drawer-row ea-drawer-row-highlight">
                  <span className="ea-drawer-row-value" style={{ fontWeight: 700, color: '#6d28d9' }}>
                    {t('etats.absence.drawer.totalAbs')}
                  </span>
                  <span className="ea-drawer-row-value" style={{ fontWeight: 900, color: '#6d28d9' }}>
                    {selectedRow.absence != null ? Number(selectedRow.absence).toFixed(2) : '—'}
                  </span>
                </div>
              </div>

            </div>

            <div className="ea-drawer-footer">
              <button
                className="ea-export-btn"
                onClick={handleExportExcel}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <DownloadIcon sx={{ fontSize: 15 }} />
                {t('etats.absence.drawer.exportSheet')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
export default function EtatAbsencePageWrapper() {
  return (
    <AbsParamsProvider>
        <EtatAbsence />
      </AbsParamsProvider>
  );
}
