import {
  Box,
  CircularProgress,
  Typography,
} from "@mui/material";
import { DroitConge } from "../../../models/DroitConge";
import { useMemo, useState } from "react";
import useGetEmployeesLibs from "../../../hooks/employeHooks/useGetEmployeesLibs";
import dayjs from "dayjs";
import DroitCongeService from "../../../services/CongeService/DroitCongeService";
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/FileDownload';
import FilterListIcon from '@mui/icons-material/FilterList';
import GroupIcon from '@mui/icons-material/Group';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import BarChartIcon from '@mui/icons-material/BarChart';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useAuth } from "../../helper/AuthProvider";
import AccessDenied from "../../helper/AccessDenied";
import './EtatDroitConge.css';

function EtatDroitConge() {
  const { isManager, sercod: managerSercod, hasPermission } = useAuth();
  const isManagerScoped = Boolean(isManager && managerSercod);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!hasPermission('Paie et Rémunération', 'consult')) {
    return <AccessDenied message="Vous n'avez pas le droit de consulter les droits de congés." />;
  }
  const [selectedEmpcods, setSelectedEmpcods] = useState<string[]>([]);
  const { data: employeesLibs = {} } = useGetEmployeesLibs(undefined, isManagerScoped ? managerSercod ?? '' : undefined);

  // Initialize dates to current month
  const [datedebut, setDatedebut] = useState(() => dayjs().startOf('month').format('YYYY-MM-DD'));
  const [datefin, setDatefin] = useState(() => dayjs().endOf('month').format('YYYY-MM-DD'));

  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);

  const empKeys = useMemo(() => Object.keys(employeesLibs as Record<string, string>), [employeesLibs]);

  // effectiveEmpcods: selected or ALL employees (not empty!)
  const effectiveEmpcods = useMemo(() => {
    if (selectedEmpcods.length > 0) return selectedEmpcods;
    // For both manager-scoped and non-scoped: use ALL available employees
    return empKeys;
  }, [selectedEmpcods, empKeys]);

  const queryString = useMemo(() => {
    const qp = new URLSearchParams();
    effectiveEmpcods.forEach((code: string) => qp.append("empcods", code));
    return qp.toString();
  }, [effectiveEmpcods]);
  const [droitConges, setDroitConges] = useState<DroitConge[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Computed totals
  const totalEmployees = droitConges.length;
  const totalRights = droitConges.reduce((sum, item) => sum + Number(item.soldeinit || 0), 0);
  const totalReceived = droitConges.reduce((sum, item) => sum + Number(item.nbcongerecu || 0), 0);
  const totalRemaining = droitConges.reduce((sum, item) => sum + Number(item.droitrestant || 0), 0);
  const totalAbsences = droitConges.reduce((sum, item) => sum + Number(item.nbabsences || 0), 0);
  const avgRights = totalEmployees > 0 ? (totalRights / totalEmployees) : 0;
  const consumptionPct = totalRights > 0 ? ((totalRights - totalRemaining) / totalRights * 100) : 0;

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await DroitCongeService.getAllWithParams(
        `get-droit-de-conge/${sessionStorage.getItem("soccod")}/${datedebut}/${datefin}?${queryString}`
      );
      setDroitConges(res);
      setCurrentPage(1);
      setErrorMsg(null);
    } catch (error: any) {
      if (error.response?.status === 403) {
        setErrorMsg("Vous n'avez pas la permission d'effectuer cette action.");
      } else {
        setErrorMsg("Une erreur est survenue. Veuillez réessayer.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Get initials from name
  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  // Tab definitions
  const tabDefinitions = [
    { label: 'SYNTHÈSE DES DROITS', description: 'Vue globale par employé' },
    { label: 'CONGÉS REÇUS PAR MOIS', description: 'Répartition mensuelle des congés' },
    { label: 'ABSENCES PAR MOIS', description: 'Suivi détaillé des absences' },
  ];

  // Pagination logic
  const totalPages = Math.ceil(droitConges.length / pageSize);
  const paginatedData = droitConges.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Export CSV
  const handleExport = () => {
    if (droitConges.length === 0) return;
    const headers = ['Matricule', 'Nom', 'Régime', 'Année', 'Droit Congé', 'Congé Reçu', 'Total Droit', 'Consommé', 'Solde Restant'];
    const rows = droitConges.map(d => [
      d.empmat, d.emplib, d.empreg, d.annee,
      d.soldeinit, d.nbcongerecu, d.droitrestant,
      d.nbabsences, (Number(d.droitrestant || 0) - Number(d.nbabsences || 0))
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'droits-conges.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box className="edc-container">
      {/* Header with tabs */}
      <Box className="edc-header">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Typography className="edc-title">Droits de Congés</Typography>
          <Box sx={{ width: '1px', height: '24px', background: '#e2e8f0' }} />
          <Box className="edc-tabs">
            {tabDefinitions.map((tab, idx) => (
              <button
                key={tab.label}
                className={`edc-tab ${activeTab === idx ? 'edc-tab-active' : ''}`}
                onClick={() => setActiveTab(idx)}
              >
                {tab.label}
              </button>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Error message */}
      {errorMsg && (
        <Box className="edc-error">
          <ErrorOutlineIcon sx={{ fontSize: 18 }} />
          {errorMsg}
        </Box>
      )}

      {/* Filter Section */}
      <Box className="edc-filter-section">
        <Box className="edc-filter-row">
          <Box className="edc-filter-field" style={{ position: 'relative' }}>
            <label className="edc-filter-label">Collaborateur / Département</label>
            <Box
              onClick={() => !isManagerScoped && setShowEmpDropdown(v => !v)}
              className="edc-filter-input"
              style={{ cursor: isManagerScoped ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 38, userSelect: 'none' }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedEmpcods.length === 0
                  ? (isManagerScoped ? 'Mon service' : 'Tous les employés')
                  : selectedEmpcods.length === 1
                    ? String((employeesLibs as Record<string, string>)[selectedEmpcods[0]] || selectedEmpcods[0])
                    : `${selectedEmpcods.length} collaborateurs sélectionnés`}
              </span>
              {!isManagerScoped && <span style={{ fontSize: 10, color: '#94a3b8' }}>▼</span>}
            </Box>
            {showEmpDropdown && !isManagerScoped && (
              <Box style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1200,
                backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 260, overflowY: 'auto', marginTop: 4,
              }}>
                <Box
                  onClick={() => { setSelectedEmpcods([]); setShowEmpDropdown(false); }}
                  style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', fontWeight: 600, fontSize: 13, color: selectedEmpcods.length === 0 ? '#0040a1' : '#334155' }}
                >
                  <input type="checkbox" readOnly checked={selectedEmpcods.length === 0} style={{ accentColor: '#0040a1' }} />
                  Tous les employés
                </Box>
                {Object.entries(employeesLibs as Record<string, string>).map(([code, name]) => (
                  <Box
                    key={code}
                    onClick={() => {
                      setSelectedEmpcods(prev =>
                        prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
                      );
                    }}
                    style={{ padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: selectedEmpcods.includes(code) ? '#0040a1' : '#334155', backgroundColor: selectedEmpcods.includes(code) ? '#f0f5ff' : 'transparent' }}
                  >
                    <input type="checkbox" readOnly checked={selectedEmpcods.includes(code)} style={{ accentColor: '#0040a1' }} />
                    {String(name)}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
          <Box className="edc-filter-field-narrow">
            <label className="edc-filter-label">Date Début</label>
            <input
              type="date"
              className="edc-filter-input"
              value={datedebut}
              onChange={(e) => setDatedebut(e.target.value)}
            />
          </Box>
          <Box className="edc-filter-field-narrow">
            <label className="edc-filter-label">Date Fin</label>
            <input
              type="date"
              className="edc-filter-input"
              value={datefin}
              onChange={(e) => setDatefin(e.target.value)}
            />
          </Box>
          <button className="edc-search-btn" onClick={handleSearch} disabled={loading}>
            <SearchIcon sx={{ fontSize: 16 }} />
            RECHERCHE
          </button>
        </Box>
      </Box>

      {/* Summary Bento Grid */}
      <Box className="edc-summary-grid">
        <Box className="edc-summary-card">
          <Box className="edc-summary-card-top">
            <span className="edc-summary-label">Total Collaborateurs</span>
            <Box className="edc-summary-icon edc-icon-bg-primary">
              <GroupIcon sx={{ fontSize: 20 }} />
            </Box>
          </Box>
          <Box className="edc-summary-value">
            {totalEmployees.toLocaleString('fr-FR')}
          </Box>
          <Box className="edc-summary-footer edc-summary-footer-highlight">
            Données filtrées
          </Box>
        </Box>

        <Box className="edc-summary-card edc-card-border-blue">
          <Box className="edc-summary-card-top">
            <span className="edc-summary-label">Total Droits Acquis</span>
            <Box className="edc-summary-icon edc-icon-bg-blue">
              <AccountBalanceWalletIcon sx={{ fontSize: 20 }} />
            </Box>
          </Box>
          <Box className="edc-summary-value">
            {totalRights.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
            <span className="edc-summary-unit">Jrs</span>
          </Box>
          <Box className="edc-summary-footer">
            Moyenne: {avgRights.toFixed(1)} jrs / pers.
          </Box>
        </Box>

        <Box className="edc-summary-card edc-card-border-amber">
          <Box className="edc-summary-card-top">
            <span className="edc-summary-label">Total Pris</span>
            <Box className="edc-summary-icon edc-icon-bg-amber">
              <EventAvailableIcon sx={{ fontSize: 20 }} />
            </Box>
          </Box>
          <Box className="edc-summary-value">
            {totalAbsences.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
            <span className="edc-summary-unit">Jrs</span>
          </Box>
          <Box className="edc-summary-footer" style={{ color: '#d97706' }}>
            {consumptionPct.toFixed(0)}% de consommation
          </Box>
        </Box>

        <Box className="edc-summary-card edc-summary-card-accent">
          <Box className="edc-summary-card-top">
            <span className="edc-summary-label">Soldes Globaux</span>
            <Box className="edc-summary-icon">
              <BarChartIcon sx={{ fontSize: 20 }} />
            </Box>
          </Box>
          <Box className="edc-summary-value">
            {totalRemaining.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
            <span className="edc-summary-unit">Jrs</span>
          </Box>
          <Box className="edc-summary-footer">
            Congés reçus: {totalReceived.toFixed(2)}
          </Box>
        </Box>
      </Box>

      {/* Loading */}
      {loading && (
        <Box className="edc-loading">
          <CircularProgress size={40} />
        </Box>
      )}

      {/* Data Ledger Table - Tab 0: Synthèse des droits */}
      {!loading && activeTab === 0 && (
        <Box className="edc-table-section">
          <Box className="edc-table-header">
            <Box>
              <Typography className="edc-table-title">Détails des Entitlements</Typography>
              <Typography className="edc-table-subtitle">
                Affichage des données consolidées pour l'exercice en cours
              </Typography>
            </Box>
            <Box className="edc-table-actions">
              <button className="edc-export-btn" onClick={handleExport}>
                <DownloadIcon sx={{ fontSize: 14 }} />
                EXPORTER LA SÉLECTION
              </button>
              <button className="edc-filter-toggle">
                <FilterListIcon sx={{ fontSize: 16 }} />
              </button>
            </Box>
          </Box>
          <Box className="edc-table-wrap">
            <table className="edc-table">
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Nom et Prénom</th>
                  <th>Régime</th>
                  <th>Année</th>
                  <th className="edc-th-right">Droit Congé</th>
                  <th className="edc-th-right">Congé reçu</th>
                  <th className="edc-th-right edc-th-primary">Total Droit</th>
                  <th className="edc-th-right">Consommé</th>
                  <th className="edc-th-right">Solde Restant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      Aucune donnée. Cliquez sur RECHERCHE pour charger les droits de congés.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item, idx) => {
                    const consumed = Number(item.nbabsences || 0);
                    const remaining = Number(item.droitrestant || 0) - consumed;
                    const isPending = remaining > 0 && consumed === 0;
                    return (
                      <tr key={idx}>
                        <td className="edc-td-matricule">{item.empmat}</td>
                        <td>
                          <Box className="edc-td-name-cell">
                            <Box className="edc-td-avatar">{getInitials(item.emplib)}</Box>
                            <span className="edc-td-name">{item.emplib}</span>
                          </Box>
                        </td>
                        <td className="edc-td-text">{item.empreg}</td>
                        <td className="edc-td-text">{item.annee}</td>
                        <td className="edc-td-right">{Number(item.soldeinit || 0).toFixed(2)}</td>
                        <td className="edc-td-right">{Number(item.nbcongerecu || 0).toFixed(2)}</td>
                        <td className="edc-td-right edc-td-primary">{Number(item.droitrestant || 0).toFixed(2)}</td>
                        <td className="edc-td-right edc-td-amber">{consumed.toFixed(2)}</td>
                        <td className="edc-td-right edc-td-bold">{remaining.toFixed(2)}</td>
                        <td>
                          <span className={`edc-status-badge ${isPending ? 'edc-status-pending' : 'edc-status-valid'}`}>
                            {isPending ? 'En Attente' : 'Validé'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Box>
          <Box className="edc-pagination">
            <span className="edc-pagination-info">
              Affichage de {Math.min((currentPage - 1) * pageSize + 1, droitConges.length)} à {Math.min(currentPage * pageSize, droitConges.length)} sur {droitConges.length} collaborateurs
            </span>
            <Box className="edc-pagination-controls">
              <button
                className="edc-page-btn edc-page-btn-nav"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeftIcon sx={{ fontSize: 14 }} />
              </button>
              {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => (
                <button
                  key={i}
                  className={`edc-page-btn ${currentPage === i + 1 ? 'edc-page-btn-active' : ''}`}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              {totalPages > 3 && <span style={{ color: '#94a3b8', fontSize: '12px' }}>...</span>}
              <button
                className="edc-page-btn edc-page-btn-nav"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                <ChevronRightIcon sx={{ fontSize: 14 }} />
              </button>
            </Box>
          </Box>
        </Box>
      )}

      {/* Tab 1: Congés reçus par mois - using raw table for month columns */}
      {!loading && activeTab === 1 && (
        <Box className="edc-table-section">
          <Box className="edc-table-header">
            <Box>
              <Typography className="edc-table-title">Congés Reçus par Mois</Typography>
              <Typography className="edc-table-subtitle">
                Répartition mensuelle des congés reçus
              </Typography>
            </Box>
            <Box className="edc-table-actions">
              <button className="edc-export-btn" onClick={handleExport}>
                <DownloadIcon sx={{ fontSize: 14 }} />
                EXPORTER LA SÉLECTION
              </button>
            </Box>
          </Box>
          <Box className="edc-table-wrap">
            <table className="edc-table">
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Nom et Prénom</th>
                  <th>Régime</th>
                  <th>Année</th>
                  {Object.keys(droitConges?.[0]?.nbcongerecuparmois || {}).map((month) => (
                    <th key={month} className="edc-th-right">
                      {month.charAt(0).toUpperCase() + month.slice(1)}
                    </th>
                  ))}
                  <th className="edc-th-right edc-th-primary">Total Congés Reçus</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={20} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      Aucune donnée. Cliquez sur RECHERCHE pour charger.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item, idx) => (
                    <tr key={idx}>
                      <td className="edc-td-matricule">{item.empmat}</td>
                      <td>
                        <Box className="edc-td-name-cell">
                          <Box className="edc-td-avatar">{getInitials(item.emplib)}</Box>
                          <span className="edc-td-name">{item.emplib}</span>
                        </Box>
                      </td>
                      <td className="edc-td-text">{item.empreg}</td>
                      <td className="edc-td-text">{item.annee}</td>
                      {Object.entries(item.nbcongerecuparmois || {}).map(([month, val]) => (
                        <td key={month} className="edc-td-right">{Number(val).toFixed(2)}</td>
                      ))}
                      <td className="edc-td-right edc-td-primary">{Number(item.nbcongerecu || 0).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Box>
          <Box className="edc-pagination">
            <span className="edc-pagination-info">
              Affichage de {Math.min((currentPage - 1) * pageSize + 1, droitConges.length)} à {Math.min(currentPage * pageSize, droitConges.length)} sur {droitConges.length}
            </span>
            <Box className="edc-pagination-controls">
              <button className="edc-page-btn edc-page-btn-nav" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
                <ChevronLeftIcon sx={{ fontSize: 14 }} />
              </button>
              {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => (
                <button key={i} className={`edc-page-btn ${currentPage === i + 1 ? 'edc-page-btn-active' : ''}`} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
              ))}
              <button className="edc-page-btn edc-page-btn-nav" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
                <ChevronRightIcon sx={{ fontSize: 14 }} />
              </button>
            </Box>
          </Box>
        </Box>
      )}

      {/* Tab 2: Absences par mois */}
      {!loading && activeTab === 2 && (
        <Box className="edc-table-section">
          <Box className="edc-table-header">
            <Box>
              <Typography className="edc-table-title">Absences par Mois</Typography>
              <Typography className="edc-table-subtitle">
                Suivi détaillé des absences mensuelles
              </Typography>
            </Box>
            <Box className="edc-table-actions">
              <button className="edc-export-btn" onClick={handleExport}>
                <DownloadIcon sx={{ fontSize: 14 }} />
                EXPORTER LA SÉLECTION
              </button>
            </Box>
          </Box>
          <Box className="edc-table-wrap">
            <table className="edc-table">
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Nom et Prénom</th>
                  <th>Régime</th>
                  <th>Année</th>
                  {Object.keys(droitConges?.[0]?.nbabsenceparmois || {}).map((month) => (
                    <th key={month} className="edc-th-right">
                      {month.charAt(0).toUpperCase() + month.slice(1)}
                    </th>
                  ))}
                  <th className="edc-th-right edc-th-primary">Total Absences</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={20} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      Aucune donnée. Cliquez sur RECHERCHE pour charger.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item, idx) => (
                    <tr key={idx}>
                      <td className="edc-td-matricule">{item.empmat}</td>
                      <td>
                        <Box className="edc-td-name-cell">
                          <Box className="edc-td-avatar">{getInitials(item.emplib)}</Box>
                          <span className="edc-td-name">{item.emplib}</span>
                        </Box>
                      </td>
                      <td className="edc-td-text">{item.empreg}</td>
                      <td className="edc-td-text">{item.annee}</td>
                      {Object.entries(item.nbabsenceparmois || {}).map(([month, val]) => (
                        <td key={month} className="edc-td-right edc-td-amber">{Number(val).toFixed(2)}</td>
                      ))}
                      <td className="edc-td-right edc-td-primary">{Number(item.nbabsences || 0).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Box>
          <Box className="edc-pagination">
            <span className="edc-pagination-info">
              Affichage de {Math.min((currentPage - 1) * pageSize + 1, droitConges.length)} à {Math.min(currentPage * pageSize, droitConges.length)} sur {droitConges.length}
            </span>
            <Box className="edc-pagination-controls">
              <button className="edc-page-btn edc-page-btn-nav" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
                <ChevronLeftIcon sx={{ fontSize: 14 }} />
              </button>
              {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => (
                <button key={i} className={`edc-page-btn ${currentPage === i + 1 ? 'edc-page-btn-active' : ''}`} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
              ))}
              <button className="edc-page-btn edc-page-btn-nav" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
                <ChevronRightIcon sx={{ fontSize: 14 }} />
              </button>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default EtatDroitConge;
