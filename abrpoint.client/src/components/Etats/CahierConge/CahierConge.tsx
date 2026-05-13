import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import { useEmployeeFilter } from '../../../hooks/employeHooks/useEmployeeFilter';
import apiInstance from '../../API/apiInstance';
import CahierCongeService from '../../../services/CongeService/CahierCongeService';
import type CahierConge from '../../../models/CahierConge';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import SearchIcon from '@mui/icons-material/Search';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import PaymentsIcon from '@mui/icons-material/Payments';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import FilterListIcon from '@mui/icons-material/FilterList';
import DownloadIcon from '@mui/icons-material/FileDownload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import GroupIcon from '@mui/icons-material/Group';
import './CahierConge.css';
function CahierCongePage() {
  const { t } = useTranslation();
  const { soccod, hasPermission } = useAuth();

  const regimeOptions: Record<string, string> = {
    '': t('cahierConge.filter.regimeAll'),
    M: t('cahierConge.filter.regimeMonthly'),
    H: t('cahierConge.filter.regimeHourly'),
  };

  if (!hasPermission('Rapports et Statistiques', 'consult')) {
    return <AccessDenied message={t('cahierConge.noConsultRight')} />;
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

  // Local filter state
  const [dateDebut, setDateDebut] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateFin, setDateFin] = useState(() => new Date().toISOString().slice(0, 10));
  const [annee, setAnnee] = useState(new Date().getFullYear().toString());
  const [searchTriggered, setSearchTriggered] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Drawer
  const [selectedRow, setSelectedRow] = useState<CahierConge | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Build query params for data fetching
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    effectiveEmpcods?.forEach((code) => params.append('empcods', code));
    return params.toString();
  }, [effectiveEmpcods]);

  const formattedDebut = dateDebut + 'T00:00:00';
  const formattedFin = dateFin + 'T00:00:00';

  const {
    data: cahierDataRaw,
    isLoading,
    refetch,
  } = useQuery<CahierConge[]>({
    queryKey: ['cahier-conge', soccod, dateDebut, dateFin, queryParams],
    queryFn: () =>
      CahierCongeService.getAllWithParams(
        `get-cahier-conge/${soccod}/${formattedDebut}/${formattedFin}?${queryParams}`
      ),
    enabled: !!soccod && searchTriggered && !!queryParams,
  });
  const cahierData: CahierConge[] = cahierDataRaw ?? [];

  // Load initial dates from parametres API
  useEffect(() => {
    if (!soccod) return;
    apiInstance
      .get(`/Parametres/deb-mois/${soccod}`)
      .then((res) => {
        const { joudeb, joufin, moisdeb, moisfin } = res.data;
        const currentYear = new Date().getFullYear();
        let currentMonth = new Date().getMonth() + 1;
        let startMonth = moisdeb === 'P' ? currentMonth - 1 : currentMonth;
        let endMonth = moisfin === 'P' ? currentMonth - 1 : currentMonth;
        let startYear = startMonth === 0 ? currentYear - 1 : currentYear;
        let endYear = endMonth === 0 ? currentYear - 1 : currentYear;
        startMonth = startMonth === 0 ? 12 : startMonth;
        endMonth = endMonth === 0 ? 12 : endMonth;
        const fmtM = (m: number) => String(m).padStart(2, '0');
        setAnnee(currentYear.toString());
        setDateDebut(`${startYear}-${fmtM(startMonth)}-${joudeb}`);
        setDateFin(`${endYear}-${fmtM(endMonth)}-${joufin}`);
      })
      .catch((err) => console.error('Error loading params:', err));
  }, [soccod]);

  // Sync year with dates
  useEffect(() => {
    if (!annee) return;
    const sp = dateDebut.split('-');
    const ep = dateFin.split('-');
    if (sp.length === 3) setDateDebut(`${annee}-${sp[1]}-${sp[2]}`);
    if (ep.length === 3) setDateFin(`${annee}-${ep[1]}-${ep[2]}`);
  }, [annee]);

  // Search handler
  const handleSearch = () => {
    if (!hasEffectiveEmployees) return;
    setSearchTriggered(true);
    setCurrentPage(1);
    setTimeout(() => refetch(), 0);
  };

  // Print report
  const handlePrintReport = async () => {
    try {
      if (!soccod || !hasEffectiveEmployees) return;
      const response = await apiInstance.get(
        `/Conges/get-cahier-de-conge-report/${soccod}/${dateDebut}/${dateFin}`,
        {
          responseType: 'blob',
          params: { empcods: effectiveEmpcods.join(',') },
        }
      );
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'cahier-de-conge.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Erreur generation rapport:', error);
    }
  };

  // Helpers
  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  const formatDate = (d: any) => {
    if (!d) return '';
    const date = new Date(d);
    return !isNaN(date.getTime()) ? date.toLocaleDateString('fr-FR') : '';
  };

  const round4 = (num: number) => Math.round(num * 10000) / 10000;

  // Export Excel with all details using xlsx
  const handleExportExcel = () => {
    if (cahierData.length === 0) return;

    // Title rows
    const titleRow = [t('cahierConge.excel.title', { start: formatDate(dateDebut), end: formatDate(dateFin) })];
    const headerRow = [
      t('cahierConge.excel.headers.matricule'),
      t('cahierConge.excel.headers.name'),
      t('cahierConge.excel.headers.birthDate'),
      t('cahierConge.excel.headers.hireDate'),
      t('cahierConge.excel.headers.regime'),
      t('cahierConge.excel.headers.salaryDaily'),
      t('cahierConge.excel.headers.periodSum'),
      t('cahierConge.excel.headers.periodTemporis'),
      t('cahierConge.excel.headers.initialBalance'),
      t('cahierConge.excel.headers.leaveDue'),
      t('cahierConge.excel.headers.leaveDueIndemnity'),
      t('cahierConge.excel.headers.seniorityDays'),
      t('cahierConge.excel.headers.seniorityAmount'),
      t('cahierConge.excel.headers.youngWorkerLeave'),
      t('cahierConge.excel.headers.youngWorkerLeaveAmount'),
      t('cahierConge.excel.headers.youngWorkerDays'),
      t('cahierConge.excel.headers.youngWorkerDaysAmount'),
      t('cahierConge.excel.headers.totalDuePresence'),
      t('cahierConge.excel.headers.leaveIndemnity'),
      t('cahierConge.excel.headers.departureDate'),
      t('cahierConge.excel.headers.departureHour'),
      t('cahierConge.excel.headers.returnDate'),
      t('cahierConge.excel.headers.returnHour'),
    ];

    const dataRows = cahierData.map((d) => [
      d.empmat,
      d.emplib,
      formatDate(d.empdnais),
      formatDate(d.empemb),
      d.empreg || '',
      d.saljou != null ? Number(d.saljou) : '',
      d.somper != null ? Number(d.somper) : '',
      d.pretemps || '',
      d.soldini != null ? Number(d.soldini) : '',
      d.congedu != null ? Number(d.congedu) : '',
      d.indemdu != null ? Number(d.indemdu) : '',
      d.jouanc != null ? Number(d.jouanc) : '',
      d.montanc != null ? Number(d.montanc) : '',
      d.conjeutrv != null ? Number(d.conjeutrv) : '',
      d.montjeutrv != null ? Number(d.montjeutrv) : '',
      d.jourjeutrv != null ? Number(d.jourjeutrv) : '',
      d.montjourjeutrv != null ? Number(d.montjourjeutrv) : '',
      d.totdupres != null ? Number(d.totdupres) : '',
      d.indemcong != null ? Number(d.indemcong) : '',
      d.datdep ? formatDate(d.datdep) : '',
      d.depam || '',
      d.datret ? formatDate(d.datret) : '',
      d.retam || '',
    ]);

    // Totals row
    const totalsRow = [
      '',
      t('cahierConge.excel.totalLabel'),
      '',
      '',
      '',
      '',
      '',
      '',
      cahierData.reduce((s, i) => s + Number(i.soldini || 0), 0).toFixed(2),
      cahierData.reduce((s, i) => s + Number(i.congedu || 0), 0).toFixed(2),
      cahierData.reduce((s, i) => s + Number(i.indemdu || 0), 0).toFixed(2),
      cahierData.reduce((s, i) => s + Number(i.jouanc || 0), 0).toFixed(2),
      cahierData.reduce((s, i) => s + Number(i.montanc || 0), 0).toFixed(2),
      cahierData.reduce((s, i) => s + Number(i.conjeutrv || 0), 0).toFixed(2),
      cahierData.reduce((s, i) => s + Number(i.montjeutrv || 0), 0).toFixed(2),
      cahierData.reduce((s, i) => s + Number(i.jourjeutrv || 0), 0).toFixed(2),
      cahierData.reduce((s, i) => s + Number(i.montjourjeutrv || 0), 0).toFixed(2),
      cahierData.reduce((s, i) => s + Number(i.totdupres || 0), 0).toFixed(2),
      cahierData.reduce((s, i) => s + Number(i.indemcong || 0), 0).toFixed(2),
      '',
      '',
      '',
      '',
    ];

    const allRows = [titleRow, [], headerRow, ...dataRows, [], totalsRow];
    const worksheet = XLSX.utils.aoa_to_sheet(allRows);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 },  // Matricule
      { wch: 25 },  // Nom
      { wch: 14 },  // Date Naissance
      { wch: 14 },  // Date Embauche
      { wch: 10 },  // Régime
      { wch: 16 },  // Sal. Journalier
      { wch: 14 },  // Somme Période
      { wch: 14 },  // Période Temporis
      { wch: 16 },  // Solde Initial
      { wch: 14 },  // Congé dû
      { wch: 18 },  // Indemnité dû
      { wch: 14 },  // Jours Ancienneté
      { wch: 18 },  // Montant Ancienneté
      { wch: 18 },  // Congé Jeune Trav.
      { wch: 20 },  // Montant Congé Jeune Trav.
      { wch: 16 },  // Jours Jeune Trav.
      { wch: 20 },  // Montant Jours Jeune Trav.
      { wch: 18 },  // Total dû Présence
      { wch: 16 },  // Indemnité Congé
      { wch: 14 },  // Date Départ
      { wch: 10 },  // Heure Dép.
      { wch: 14 },  // Date Retour
      { wch: 10 },  // Heure Ret.
    ];

    // Merge title row across all columns
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 22 } }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, t('cahierConge.excel.sheetName'));

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `cahier-conges-${annee}.xlsx`);
  };

  // Computed totals
  const totalSoldini = useMemo(
    () => cahierData.reduce((s, i) => s + Number(i.soldini || 0), 0),
    [cahierData]
  );
  const totalCongedu = useMemo(
    () => cahierData.reduce((s, i) => s + Number(i.congedu || 0), 0),
    [cahierData]
  );
  const totalTotdupres = useMemo(
    () => cahierData.reduce((s, i) => s + Number(i.totdupres || 0), 0),
    [cahierData]
  );
  const totalIndemcong = useMemo(
    () => cahierData.reduce((s, i) => s + Number(i.indemcong || 0), 0),
    [cahierData]
  );

  // Pagination
  const totalPages = Math.ceil(cahierData.length / pageSize);
  const paginatedData = cahierData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Open detail drawer
  const openDrawer = (row: CahierConge) => {
    setSelectedRow(row);
    setDrawerOpen(true);
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setSelectedRow(null), 300);
  };

  return (
    <div className="cc-page">
      {/* Header */}
      <div className="cc-header">
        <div className="cc-header-left">
          <div>
            <h2 className="cc-title">{t('cahierConge.title')}</h2>
            <p className="cc-subtitle">{t('cahierConge.subtitle')}</p>
          </div>
          <div className="cc-header-divider" />
          <div className="cc-year-select">
            <CalendarTodayIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
            <select
              value={annee}
              onChange={(e) => setAnnee(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: 13,
                fontWeight: 700,
                color: '#334155',
                outline: 'none',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              <option value="2026">{t('cahierConge.yearLabel', { year: 2026 })}</option>
              <option value="2025">{t('cahierConge.yearLabel', { year: 2025 })}</option>
              <option value="2024">{t('cahierConge.yearLabel', { year: 2024 })}</option>
              <option value="2023">{t('cahierConge.yearLabel', { year: 2023 })}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter section - inline like EtatDroitConge */}
      <div className="cc-filter-section">
        <div className="cc-filter-row">
          {filiale && Object.keys(filiale).length > 0 && (
            <div className="cc-filter-field">
              <label className="cc-filter-label">{t('cahierConge.filter.filiale')}</label>
              <select
                className="cc-filter-select"
                value={selectedFiliale}
                onChange={(e) => setSelectedFiliale(e.target.value)}
              >
                <option value="">{t('cahierConge.filter.filialeAll')}</option>
                {Object.entries(filiale).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          )}
          {services && Object.keys(services).length > 0 && (
            <div className="cc-filter-field">
              <label className="cc-filter-label">{t('cahierConge.filter.service')}</label>
              <select
                className="cc-filter-select"
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                disabled={isServiceLocked}
              >
                <option value="">{isServiceLocked ? t('cahierConge.filter.myService') : t('cahierConge.filter.allServices')}</option>
                {Object.entries(services).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          )}
          <div className="cc-filter-field">
            <label className="cc-filter-label">{t('cahierConge.filter.regime')}</label>
            <select
              className="cc-filter-select"
              value={selectedRegime}
              onChange={(e) => setSelectedRegime(e.target.value)}
            >
              {Object.entries(regimeOptions).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
         <div className="cc-filter-field-narrow">
            <label className="cc-filter-label">{t('cahierConge.filter.dateStart')}</label>
            <input
              type="date"
              className="cc-filter-input"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
          </div>
          <div className="cc-filter-field-narrow">
            <label className="cc-filter-label">{t('cahierConge.filter.dateEnd')}</label>
            <input
              type="date"
              className="cc-filter-input"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
            />
          </div>
          <div className="cc-filter-field" style={{ minWidth: 250, flexGrow: 1 }}>
            <label className="cc-filter-label">{t('cahierConge.filter.employees')}</label>
            <Autocomplete
                multiple
                limitTags={2}
                size="small"
                options={accessibleEmployees}
                getOptionLabel={(option) => `${option.empcod} - ${option.emplib}`}
                value={accessibleEmployees.filter(e => selectedEmpCodes.includes(e.empcod))}
                onChange={(_, newValue) => {
                  handleEmployeeSelection(newValue.map(e => e.empcod));
                }}
                renderInput={(params) => (
                  <TextField {...params} placeholder={t('cahierConge.filter.employeesPlaceholder')} />
                )}
                sx={{
                  bgcolor: '#fff',
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-root': { borderRadius: '8px', padding: '1px 8px' }
                }}
              />
          </div>
          <button className="cc-search-btn" onClick={handleSearch} disabled={!hasEffectiveEmployees || isLoading}>
            {isLoading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon sx={{ fontSize: 16 }} />}
            {t('cahierConge.filter.search')}
          </button>
        </div>
        <div className="cc-status-msg" style={{ marginLeft: 4 }}>
          <span className={hasEffectiveEmployees ? 'cc-status-msg-ok' : 'cc-status-msg-warn'}>
            {hasEffectiveEmployees
              ? t('cahierConge.filter.selectedLabel', { label: effectiveEmployeesLabel, count: effectiveEmpcods.length })
              : t('cahierConge.filter.noEmpFilter')}
          </span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="cc-summary-grid">
        <div className="cc-summary-card cc-card-border-blue">
          <div className="cc-summary-card-top">
            <span className="cc-summary-label">{t('cahierConge.summary.totalEmployees')}</span>
            <div className="cc-summary-icon cc-icon-bg-blue">
              <GroupIcon sx={{ fontSize: 20 }} />
            </div>
          </div>
          <div className="cc-summary-value">
            {cahierData.length}
          </div>
          <div className="cc-summary-footer">{t('cahierConge.summary.filteredData')}</div>
        </div>

        <div className="cc-summary-card cc-card-border-blue">
          <div className="cc-summary-card-top">
            <span className="cc-summary-label">{t('cahierConge.summary.initialBalance')}</span>
            <div className="cc-summary-icon cc-icon-bg-blue">
              <AccountBalanceWalletIcon sx={{ fontSize: 20 }} />
            </div>
          </div>
          <div className="cc-summary-value">
            {totalSoldini.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
            <span className="cc-summary-unit">{t('cahierConge.summary.daysShort')}</span>
          </div>
          <div className="cc-summary-footer">{t('cahierConge.summary.cumulative')}</div>
        </div>

        <div className="cc-summary-card cc-card-border-amber">
          <div className="cc-summary-card-top">
            <span className="cc-summary-label">{t('cahierConge.summary.leaveDue')}</span>
            <div className="cc-summary-icon cc-icon-bg-orange">
              <PendingActionsIcon sx={{ fontSize: 20 }} />
            </div>
          </div>
          <div className="cc-summary-value">
            {totalCongedu.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
            <span className="cc-summary-unit">{t('cahierConge.summary.daysShort')}</span>
          </div>
          <div className="cc-summary-footer">{t('cahierConge.summary.currentPeriod')}</div>
        </div>

        <div className="cc-summary-card cc-card-border-green">
          <div className="cc-summary-card-top">
            <span className="cc-summary-label">{t('cahierConge.summary.totalDuePresence')}</span>
            <div className="cc-summary-icon cc-icon-bg-green">
              <PaymentsIcon sx={{ fontSize: 20 }} />
            </div>
          </div>
          <div className="cc-summary-value">
            {totalTotdupres.toLocaleString('fr-FR', { minimumFractionDigits: 0 })}
            <span className="cc-summary-unit">{t('cahierConge.summary.currency')}</span>
          </div>
          <div className="cc-summary-footer">
            {t('cahierConge.summary.indemnity', { value: totalIndemcong.toLocaleString('fr-FR', { minimumFractionDigits: 0 }) })}
          </div>
        </div>
      </div>

      {/* Table section */}
      <div className="cc-table-section">
        <div className="cc-table-header">
          <div>
            <div className="cc-table-title">
              <FactCheckIcon />
              {t('cahierConge.table.title')}
            </div>
            <div className="cc-table-subtitle">
              {t('cahierConge.table.subtitle', { start: formatDate(dateDebut), end: formatDate(dateFin) })}
            </div>
          </div>
          <div className="cc-table-actions">
            <button className="cc-export-btn" onClick={handleExportExcel}>
              <DownloadIcon sx={{ fontSize: 14 }} />
              {t('cahierConge.table.exportExcel')}
            </button>
            <button className="cc-export-btn" onClick={handlePrintReport} disabled={!hasEffectiveEmployees}>
              <PrintIcon sx={{ fontSize: 14 }} />
              {t('cahierConge.table.printPdf')}
            </button>
            <button className="cc-filter-toggle" title={t('cahierConge.table.filterTooltip')}>
              <FilterListIcon sx={{ fontSize: 16 }} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="cc-loading">
            <CircularProgress size={40} />
          </div>
        ) : (
          <>
            <div className="cc-table-wrap">
              <table className="cc-table">
                <thead>
                  <tr>
                    <th>{t('cahierConge.table.headers.matricule')}</th>
                    <th>{t('cahierConge.table.headers.collaborator')}</th>
                    <th>{t('cahierConge.table.headers.period')}</th>
                    <th className="cc-th-right cc-th-primary">{t('cahierConge.table.headers.nbDays')}</th>
                    <th style={{ textAlign: 'right' }}>{t('cahierConge.table.headers.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="cc-no-data">
                        {searchTriggered
                          ? t('cahierConge.table.noData')
                          : t('cahierConge.table.clickSearch')}
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((item, idx) => {
                      const globalIdx = (currentPage - 1) * pageSize + idx;
                      return (
                        <tr key={globalIdx}>
                          <td className="cc-td-matricule">{item.empmat}</td>
                          <td>
                            <div className="cc-td-name">
                              <div className="cc-td-avatar">{getInitials(item.emplib)}</div>
                              <span className="cc-td-name-text">{item.emplib}</span>
                            </div>
                          </td>
                          <td className="cc-td-text">
                            {formatDate(dateDebut)} → {formatDate(dateFin)}
                          </td>
                          <td className="cc-td-right cc-td-primary cc-td-bold">
                            {item.congedu != null ? Number(item.congedu).toFixed(2) : '—'}
                          </td>
                          <td className="cc-actions">
                            <button className="cc-action-btn" onClick={() => openDrawer(item)} title={t('cahierConge.table.details')}>
                              <VisibilityIcon />
                              <span className="cc-action-label">{t('cahierConge.table.details')}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {cahierData.length > 0 && (
              <div className="cc-table-footer">
                <span className="cc-table-footer-info">
                  {t('cahierConge.table.pagination', {
                    start: Math.min((currentPage - 1) * pageSize + 1, cahierData.length),
                    end: Math.min(currentPage * pageSize, cahierData.length),
                    total: cahierData.length,
                  })}
                </span>
                <div className="cc-pagination">
                  <button
                    className="cc-page-btn"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeftIcon sx={{ fontSize: 14 }} />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                    <button
                      key={i}
                      className={`cc-page-btn ${currentPage === i + 1 ? 'cc-page-btn-active' : ''}`}
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    className="cc-page-btn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRightIcon sx={{ fontSize: 14 }} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Overlay */}
      {drawerOpen && <div className="cc-overlay cc-overlay-visible" onClick={closeDrawer} />}

      {/* Details Drawer */}
      <div className={`cc-drawer ${drawerOpen ? 'cc-drawer-open' : ''}`}>
        <div className="cc-drawer-header">
          <div>
            <h3 className="cc-drawer-title">{t('cahierConge.drawer.title')}</h3>
            <p className="cc-drawer-subtitle">{t('cahierConge.drawer.subtitle')}</p>
          </div>
          <button className="cc-drawer-close" onClick={closeDrawer}>
            <CloseIcon />
          </button>
        </div>

        {selectedRow && (
          <>
            <div className="cc-drawer-body">
              {/* Identity */}
              <div className="cc-drawer-section">
                <div className="cc-drawer-identity">
                  <div className="cc-drawer-avatar">{getInitials(selectedRow.emplib)}</div>
                  <div>
                    <div className="cc-drawer-name">{selectedRow.emplib}</div>
                    <span className="cc-drawer-matricule">{t('cahierConge.drawer.matriculeLabel', { value: selectedRow.empmat })}</span>
                  </div>
                </div>
                <div className="cc-drawer-grid">
                  <div className="cc-drawer-field">
                    <div className="cc-drawer-field-label">{t('cahierConge.drawer.regime')}</div>
                    <div className="cc-drawer-field-value">
                      {selectedRow.empreg || '—'} ({selectedRow.empreg === 'M' ? t('cahierConge.drawer.regimeMonthly') : t('cahierConge.drawer.regimeHourly')})
                    </div>
                  </div>
                  <div className="cc-drawer-field">
                    <div className="cc-drawer-field-label">{t('cahierConge.drawer.salaryDaily')}</div>
                    <div className="cc-drawer-field-value">
                      {selectedRow.saljou != null ? round4(selectedRow.saljou).toFixed(4) + ' ' + t('cahierConge.drawer.currency') : '—'}
                    </div>
                  </div>
                  <div className="cc-drawer-field">
                    <div className="cc-drawer-field-label">{t('cahierConge.drawer.birthDate')}</div>
                    <div className="cc-drawer-field-value">{formatDate(selectedRow.empdnais) || '—'}</div>
                  </div>
                  <div className="cc-drawer-field">
                    <div className="cc-drawer-field-label">{t('cahierConge.drawer.hireDate')}</div>
                    <div className="cc-drawer-field-value">{formatDate(selectedRow.empemb) || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Period calculations */}
              <div className="cc-drawer-section">
                <h5 className="cc-drawer-section-title">
                  <span className="cc-drawer-bar cc-drawer-bar-blue" />
                  {t('cahierConge.drawer.calculationsTitle')}
                </h5>
                <div className="cc-drawer-row">
                  <span className="cc-drawer-row-label">{t('cahierConge.drawer.initialBalance')}</span>
                  <span className="cc-drawer-row-value">
                    {selectedRow.soldini != null ? Number(selectedRow.soldini).toFixed(2) : '—'} {t('cahierConge.drawer.days')}
                  </span>
                </div>
                <div className="cc-drawer-row">
                  <span className="cc-drawer-row-label">{t('cahierConge.drawer.leaveDueDays')}</span>
                  <span className="cc-drawer-row-value cc-drawer-row-value-red">
                    {selectedRow.congedu != null ? Number(selectedRow.congedu).toFixed(2) : '—'} {t('cahierConge.drawer.days')}
                  </span>
                </div>
                <div className="cc-drawer-row cc-drawer-row-highlight">
                  <span className="cc-drawer-row-value" style={{ fontWeight: 700, color: '#1e40af' }}>
                    {t('cahierConge.drawer.leaveDueIndemnity')}
                  </span>
                  <span className="cc-drawer-row-value" style={{ fontWeight: 900, color: '#1e40af' }}>
                    {selectedRow.indemdu != null ? Number(selectedRow.indemdu).toFixed(2) : '—'} {t('cahierConge.drawer.currency')}
                  </span>
                </div>
              </div>

              {/* Ancienneté */}
              <div className="cc-drawer-section">
                <h5 className="cc-drawer-section-title">
                  <span className="cc-drawer-bar cc-drawer-bar-orange" />
                  {t('cahierConge.drawer.seniorityTitle')}
                </h5>
                <div className="cc-drawer-row">
                  <span className="cc-drawer-row-label">{t('cahierConge.drawer.seniorityDays')}</span>
                  <span className="cc-drawer-row-value">
                    {selectedRow.jouanc != null ? Number(selectedRow.jouanc).toFixed(2) : '—'} {t('cahierConge.drawer.days')}
                  </span>
                </div>
                <div className="cc-drawer-row">
                  <span className="cc-drawer-row-label">{t('cahierConge.drawer.seniorityAmount')}</span>
                  <span className="cc-drawer-row-value">
                    {selectedRow.montanc != null ? Number(selectedRow.montanc).toFixed(2) : '—'} {t('cahierConge.drawer.currency')}
                  </span>
                </div>
              </div>

              {/* Jeune travailleur */}
              <div className="cc-drawer-section">
                <h5 className="cc-drawer-section-title">
                  <span className="cc-drawer-bar cc-drawer-bar-green" />
                  {t('cahierConge.drawer.youngWorkerTitle')}
                </h5>
                <div className="cc-drawer-row">
                  <span className="cc-drawer-row-label">{t('cahierConge.drawer.youngWorkerLeave')}</span>
                  <span className="cc-drawer-row-value">
                    {selectedRow.conjeutrv != null ? Number(selectedRow.conjeutrv).toFixed(2) : '—'} {t('cahierConge.drawer.days')}
                  </span>
                </div>
                <div className="cc-drawer-row">
                  <span className="cc-drawer-row-label">{t('cahierConge.drawer.youngWorkerLeaveAmount')}</span>
                  <span className="cc-drawer-row-value">
                    {selectedRow.montjeutrv != null ? Number(selectedRow.montjeutrv).toFixed(2) : '—'} {t('cahierConge.drawer.currency')}
                  </span>
                </div>
                <div className="cc-drawer-row">
                  <span className="cc-drawer-row-label">{t('cahierConge.drawer.youngWorkerDays')}</span>
                  <span className="cc-drawer-row-value">
                    {selectedRow.jourjeutrv != null ? Number(selectedRow.jourjeutrv).toFixed(2) : '—'} {t('cahierConge.drawer.days')}
                  </span>
                </div>
                <div className="cc-drawer-row">
                  <span className="cc-drawer-row-label">{t('cahierConge.drawer.youngWorkerDaysAmount')}</span>
                  <span className="cc-drawer-row-value">
                    {selectedRow.montjourjeutrv != null ? Number(selectedRow.montjourjeutrv).toFixed(2) : '—'} {t('cahierConge.drawer.currency')}
                  </span>
                </div>
              </div>

              {/* Totaux */}
              <div className="cc-drawer-section">
                <h5 className="cc-drawer-section-title">
                  <span className="cc-drawer-bar cc-drawer-bar-blue" />
                  {t('cahierConge.drawer.totalsTitle')}
                </h5>
                <div className="cc-drawer-row cc-drawer-row-highlight">
                  <span className="cc-drawer-row-value" style={{ fontWeight: 700, color: '#1e40af' }}>
                    {t('cahierConge.drawer.totalDuePresence')}
                  </span>
                  <span className="cc-drawer-row-value" style={{ fontWeight: 900, color: '#1e40af' }}>
                    {selectedRow.totdupres != null ? Number(selectedRow.totdupres).toFixed(2) : '—'} {t('cahierConge.drawer.currency')}
                  </span>
                </div>
                <div className="cc-drawer-row cc-drawer-row-highlight">
                  <span className="cc-drawer-row-value" style={{ fontWeight: 700, color: '#059669' }}>
                    {t('cahierConge.drawer.leaveIndemnity')}
                  </span>
                  <span className="cc-drawer-row-value" style={{ fontWeight: 900, color: '#059669' }}>
                    {selectedRow.indemcong != null ? Number(selectedRow.indemcong).toFixed(2) : '—'} {t('cahierConge.drawer.currency')}
                  </span>
                </div>
              </div>

              {/* Departure / Return */}
              {(selectedRow.datdep || selectedRow.datret) && (
                <div className="cc-drawer-section">
                  <h5 className="cc-drawer-section-title">
                    <span className="cc-drawer-bar cc-drawer-bar-orange" />
                    {t('cahierConge.drawer.departureReturnTitle')}
                  </h5>
                  {selectedRow.datdep && (
                    <div className="cc-drawer-row">
                      <span className="cc-drawer-row-label">{t('cahierConge.drawer.departureDate')}</span>
                      <span className="cc-drawer-row-value">
                        {formatDate(selectedRow.datdep)}
                        {selectedRow.depam ? ` ${selectedRow.depam}` : ''}
                      </span>
                    </div>
                  )}
                  {selectedRow.datret && (
                    <div className="cc-drawer-row">
                      <span className="cc-drawer-row-label">{t('cahierConge.drawer.returnDate')}</span>
                      <span className="cc-drawer-row-value">
                        {formatDate(selectedRow.datret)}
                        {selectedRow.retam ? ` ${selectedRow.retam}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Period info */}
              <div className="cc-drawer-section">
                <h5 className="cc-drawer-section-title">
                  <span className="cc-drawer-bar cc-drawer-bar-blue" />
                  {t('cahierConge.drawer.periodTitle')}
                </h5>
                <div className="cc-drawer-row">
                  <span className="cc-drawer-row-label">{t('cahierConge.drawer.periodSum')}</span>
                  <span className="cc-drawer-row-value">
                    {selectedRow.somper != null ? Number(selectedRow.somper).toFixed(2) : '—'}
                  </span>
                </div>
                <div className="cc-drawer-row">
                  <span className="cc-drawer-row-label">{t('cahierConge.drawer.periodTemporis')}</span>
                  <span className="cc-drawer-row-value">{selectedRow.pretemps || '—'}</span>
                </div>
              </div>
            </div>

            <div className="cc-drawer-footer">
              <button className="cc-export-btn" onClick={handleExportExcel} style={{ width: '100%', justifyContent: 'center' }}>
                <DownloadIcon sx={{ fontSize: 16 }} />
                {t('cahierConge.drawer.exportSheet')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CahierCongeWrapper() {
  return (
    <CahierCongePage />
  );
}
