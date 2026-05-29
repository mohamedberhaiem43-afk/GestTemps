import { useEffect, useMemo, useState } from 'react';
import { CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';

// Icons
import SearchIcon from '@mui/icons-material/Search';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DownloadIcon from '@mui/icons-material/FileUpload';
import PrintIcon from '@mui/icons-material/Print';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import GroupIcon from '@mui/icons-material/Group';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';

import apiInstance from '../../API/apiInstance';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import EchContrat from '../../../models/EcheanceContrat';
import ContratReportService from '../../../services/ContratService/ContratReportService';
import RenewContractDialog from '../../gestionEmploye/GestionContrats/RenewContractDialog';
import { Contrat } from '../../../models/Contrat';

import '../EtatAbsence/Etatabsence.css';
// Heuristique d'urgence : nombre de jours restants → couleur de badge.
const urgencyClass = (daysLeft: number) => {
  if (daysLeft <= 0) return 'ea-abs-badge-red';
  if (daysLeft <= 7) return 'ea-abs-badge-red';
  if (daysLeft <= 30) return 'ea-abs-badge-amber';
  return 'ea-abs-badge-green';
};

const getInitials = (name: string | null | undefined) => {
  if (!name) return '??';
  const parts = String(name).trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
};

const fmt = (d: any) => {
  if (!d) return '—';
  const v = new Date(d);
  return Number.isNaN(v.getTime()) ? '—' : v.toLocaleDateString('fr-FR');
};

const toIso = (d: Date) => dayjs(d).format('YYYY-MM-DD');

function EcheanceContratInner() {
  const { t } = useTranslation();
  const { soccod, uticod, hasPermission } = useAuth();

  if (!hasPermission('Rapports et Statistiques', 'consult')) {
    return <AccessDenied message={t('echeanceContrat.noConsultRight')} />;
  }

  // Période par défaut : aujourd'hui → fin du mois courant.
  const today = useMemo(() => dayjs().startOf('day'), []);
  const [echdeb, setEchdeb] = useState<string>(toIso(today.toDate()));
  const [echfin, setEchfin] = useState<string>(toIso(today.endOf('month').toDate()));
  const [annee, setAnnee] = useState(today.year().toString());

  const [contrats, setContrats] = useState<EchContrat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [renewTarget, setRenewTarget] = useState<Contrat | null>(null);

  // Synchronise l'année avec les bornes de date — utile quand l'utilisateur change l'année.
  useEffect(() => {
    if (!annee) return;
    const sp = echdeb.split('-'); const ep = echfin.split('-');
    if (sp.length === 3) setEchdeb(`${annee}-${sp[1]}-${sp[2]}`);
    if (ep.length === 3) setEchfin(`${annee}-${ep[1]}-${ep[2]}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annee]);

  const handleSearch = async () => {
    if (!soccod || !uticod) return;
    setIsLoading(true);
    setError(null);
    setSearchTriggered(true);
    try {
      const response = await apiInstance.get(`/Contrats/get-echeance/${soccod}/${echdeb}/${echfin}/${uticod}`);
      setContrats(response.data || []);
      setCurrentPage(1);
    } catch (e: any) {
      const msg = e?.response?.status === 403
        ? t('echeanceContrat.errors.forbidden')
        : t('echeanceContrat.errors.fetchError');
      setError(msg);
      setContrats([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintReport = async () => {
    if (!soccod) return;
    try {
      const pdfBlob = await ContratReportService.getReport(`get-echeance-contrat-report/${soccod}/${echdeb}/${echfin}`);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `EcheanceContrat_${echdeb}_${echfin}.pdf`);
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.status === 403 ? t('echeanceContrat.errors.reportForbidden') : t('echeanceContrat.errors.reportError'));
    }
  };

  const handleExportExcel = () => {
    if (!contrats.length) return;
    const title = [t('echeanceContrat.excel.title', { start: fmt(echdeb), end: fmt(echfin) })];
    const headers = [
      t('echeanceContrat.excel.headers.matricule'),
      t('echeanceContrat.excel.headers.name'),
      t('echeanceContrat.excel.headers.contractNo'),
      t('echeanceContrat.excel.headers.contractDate'),
      t('echeanceContrat.excel.headers.startDate'),
      t('echeanceContrat.excel.headers.endDate'),
      t('echeanceContrat.excel.headers.daysLeft'),
    ];
    const rows = contrats.map((c) => {
      const days = c.empsort ? Math.ceil((new Date(c.empsort).getTime() - Date.now()) / 86400000) : 0;
      return [c.empmat || '', c.emplib || '', c.concod || '', fmt(c.condat), fmt(c.empemb), fmt(c.empsort), days];
    });
    const ws = XLSX.utils.aoa_to_sheet([title, [], headers, ...rows]);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
    ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('echeanceContrat.excel.sheetName'));
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `echeance-contrats-${annee}.xlsx`);
  };

  // KPIs
  const stats = useMemo(() => {
    const total = contrats.length;
    const employes = new Set(contrats.map(c => c.empmat || c.empcod)).size;
    let urgents = 0; let echus = 0;
    contrats.forEach((c) => {
      if (!c.empsort) return;
      const days = Math.ceil((new Date(c.empsort).getTime() - Date.now()) / 86400000);
      if (days < 0) echus++;
      else if (days <= 7) urgents++;
    });
    return { total, employes, urgents, echus };
  }, [contrats]);

  const totalPages = Math.max(1, Math.ceil(contrats.length / pageSize));
  const paginated = contrats.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleRenew = (c: EchContrat) => {
    // EchContrat est compatible Contrat pour les champs essentiels utilisés par le dialog
    // (empcod, emplib, concod, contype, empsort).
    setRenewTarget(c as unknown as Contrat);
  };

  return (
    <div className="ea-page">
      {/* ── Header ── */}
      <div className="ea-header">
        <div className="ea-header-left">
          <div>
            <h2 className="ea-title">{t('echeanceContrat.title')}</h2>
            <p className="ea-subtitle">{t('echeanceContrat.subtitle')}</p>
          </div>
          <div className="ea-header-divider" />
          <div className="ea-year-select">
            <CalendarTodayIcon sx={{ fontSize: 15, color: '#94a3b8' }} />
            <select
              value={annee} onChange={(e) => setAnnee(e.target.value)}
              style={{ background: 'transparent', border: 'none', fontSize: 13, fontWeight: 700, color: '#334155', outline: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
            >
              {['2027', '2026', '2025', '2024'].map((y) => <option key={y} value={y}>{t('echeanceContrat.yearLabel', { year: y })}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="ea-filter-section">
        <div className="ea-filter-row">
          <div className="ea-filter-field-narrow">
            <label className="ea-filter-label">{t('echeanceContrat.filter.echStart')}</label>
            <input type="date" className="ea-filter-input" value={echdeb} onChange={(e) => setEchdeb(e.target.value)} />
          </div>
          <div className="ea-filter-field-narrow">
            <label className="ea-filter-label">{t('echeanceContrat.filter.echEnd')}</label>
            <input type="date" className="ea-filter-input" value={echfin} onChange={(e) => setEchfin(e.target.value)} />
          </div>
          <button className="ea-search-btn" onClick={handleSearch} disabled={isLoading}>
            {isLoading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon sx={{ fontSize: 15 }} />}
            {t('echeanceContrat.filter.search')}
          </button>
        </div>
        {error && (
          <div className="ea-status-msg" style={{ marginLeft: 4 }}>
            <span className="ea-status-msg-warn">{error}</span>
          </div>
        )}
      </div>

      {/* ── Summary Cards ── */}
      <div className="ea-summary-grid">
        <div className="ea-summary-card ea-card-border-blue">
          <div className="ea-summary-card-top">
            <span className="ea-summary-label">{t('echeanceContrat.summary.totalCards')}</span>
            <div className="ea-summary-icon ea-icon-bg-blue"><EventBusyIcon sx={{ fontSize: 19 }} /></div>
          </div>
          <div className="ea-summary-value">{stats.total}<span className="ea-summary-unit">{t('echeanceContrat.summary.totalUnit')}</span></div>
          <div className="ea-summary-footer">{t('echeanceContrat.summary.totalFooter')}</div>
        </div>

        <div className="ea-summary-card ea-card-border-green">
          <div className="ea-summary-card-top">
            <span className="ea-summary-label">{t('echeanceContrat.summary.employees')}</span>
            <div className="ea-summary-icon ea-icon-bg-green"><GroupIcon sx={{ fontSize: 19 }} /></div>
          </div>
          <div className="ea-summary-value">{stats.employes}</div>
          <div className="ea-summary-footer">{t('echeanceContrat.summary.employeesFooter')}</div>
        </div>

        <div className="ea-summary-card ea-card-border-amber">
          <div className="ea-summary-card-top">
            <span className="ea-summary-label">{t('echeanceContrat.summary.urgent')}</span>
            <div className="ea-summary-icon ea-icon-bg-orange"><HourglassEmptyIcon sx={{ fontSize: 19 }} /></div>
          </div>
          <div className="ea-summary-value">{stats.urgents}</div>
          <div className="ea-summary-footer">{t('echeanceContrat.summary.urgentFooter')}</div>
        </div>

        <div className="ea-summary-card ea-card-border-red">
          <div className="ea-summary-card-top">
            <span className="ea-summary-label">{t('echeanceContrat.summary.expired')}</span>
            <div className="ea-summary-icon ea-icon-bg-red"><AssignmentLateIcon sx={{ fontSize: 19 }} /></div>
          </div>
          <div className="ea-summary-value">{stats.echus}</div>
          <div className="ea-summary-footer">{t('echeanceContrat.summary.expiredFooter')}</div>
        </div>
      </div>

      {/* ── Table Section ── */}
      <div className="ea-table-section">
        <div className="ea-table-header">
          <div>
            <div className="ea-table-title"><CheckCircleOutlineIcon /> {t('echeanceContrat.table.title')}</div>
            <div className="ea-table-subtitle">{t('echeanceContrat.table.subtitle', { start: fmt(echdeb), end: fmt(echfin) })}</div>
          </div>
          <div className="ea-table-actions">
            <button className="ea-export-btn" onClick={handleExportExcel} disabled={!contrats.length}>
              <DownloadIcon sx={{ fontSize: 13 }} /> {t('echeanceContrat.table.exportExcel')}
            </button>
            <button className="ea-export-btn" onClick={handlePrintReport}>
              <PrintIcon sx={{ fontSize: 13 }} /> {t('echeanceContrat.table.printPdf')}
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
                    <th>{t('echeanceContrat.table.headers.matricule')}</th>
                    <th>{t('echeanceContrat.table.headers.collaborator')}</th>
                    <th>{t('echeanceContrat.table.headers.contractNo')}</th>
                    <th>{t('echeanceContrat.table.headers.contractDate')}</th>
                    <th>{t('echeanceContrat.table.headers.startDate')}</th>
                    <th>{t('echeanceContrat.table.headers.endDate')}</th>
                    <th className="ea-th-right">{t('echeanceContrat.table.headers.daysLeft')}</th>
                    <th style={{ textAlign: 'right' }}>{t('echeanceContrat.table.headers.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="ea-no-data">
                        {searchTriggered ? t('echeanceContrat.table.noData') : t('echeanceContrat.table.clickSearch')}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((c, i) => {
                      const days = c.empsort ? Math.ceil((new Date(c.empsort).getTime() - Date.now()) / 86400000) : 0;
                      return (
                        <tr key={`${c.empcod}-${c.concod}-${i}`}>
                          <td className="ea-td-matricule">{c.empmat || '—'}</td>
                          <td>
                            <div className="ea-td-name">
                              <div className="ea-td-avatar">{getInitials(c.emplib)}</div>
                              <span className="ea-td-name-text">{c.emplib || '—'}</span>
                            </div>
                          </td>
                          <td className="ea-td-text" style={{ fontFamily: 'monospace' }}>{c.concod || '—'}</td>
                          <td className="ea-td-date">{fmt(c.condat)}</td>
                          <td className="ea-td-date">{fmt(c.empemb)}</td>
                          <td className="ea-td-date" style={{ fontWeight: 700, color: days < 0 ? '#b91c1c' : days <= 7 ? '#b45309' : '#0f5132' }}>
                            {fmt(c.empsort)}
                          </td>
                          <td className="ea-td-right">
                            <span className={`ea-abs-badge ${urgencyClass(days)}`}>
                              {days < 0 ? t('echeanceContrat.table.expiredBadge', { days: Math.abs(days) }) : t('echeanceContrat.table.daysShort', { days })}
                            </span>
                          </td>
                          <td className="ea-actions">
                            <button className="ea-action-btn" onClick={() => handleRenew(c)} title={t('echeanceContrat.table.renewTooltip')}>
                              <RefreshIcon sx={{ fontSize: 13 }} />
                              <span className="ea-action-label">{t('echeanceContrat.table.renew')}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {contrats.length > 0 && (
              <div className="ea-table-footer">
                <span className="ea-table-footer-info">
                  {t('echeanceContrat.table.pagination', {
                    start: Math.min((currentPage - 1) * pageSize + 1, contrats.length),
                    end: Math.min(currentPage * pageSize, contrats.length),
                    total: contrats.length,
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

      {/* Dialog renouvellement */}
      <RenewContractDialog
        open={!!renewTarget}
        source={renewTarget}
        onClose={() => setRenewTarget(null)}
        onSuccess={() => { setRenewTarget(null); handleSearch(); }}
      />
    </div>
  );
}

export default function EcheanceContrat() {
  return (
    <EcheanceContratInner />
  );
}
