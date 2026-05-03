import { useMemo, useState, useEffect } from 'react';
import { Box, Typography, Paper, Button, CircularProgress, Chip,
  Autocomplete, TextField } from '@mui/material';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import DownloadIcon from '@mui/icons-material/Download';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EventIcon from '@mui/icons-material/Event';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useTranslation, Trans } from 'react-i18next';
import { useAuth } from '../../../helper/AuthProvider';
import useGetSoldeByEmp from '../../../../hooks/soldeCongeHooks/useGetSoldeByEmp';
import useGetDemConges from '../../../../hooks/congeHooks/useGetDemConges';
import useGetAllAbsences from '../../../../hooks/absenceHooks/useGetAllAbsence';
import useGetEmployee from '../../../../hooks/employeHooks/useGetEmployee';
import { Conge } from '../../../../models/Conge';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import './SoldeCongeModern.css';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return '—'; }
};

type SoldeStatusKey = 'accepted' | 'refused' | 'pending';
const getStatus = (c: Conge): SoldeStatusKey => {
  const n = c.etat?.trim().toLowerCase() ?? '';
  if (n.includes('refus') || c.conrefus === '1') return 'refused';
  if (n.includes('accept')) return 'accepted';
  return 'pending';
};


// ── Balance Card ──────────────────────────────────────────────────────────────
interface BalanceCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  balance: number;
  acquired: number;
  taken: number;
  barColor: string;
  emptyMsg?: string;
}

function BalanceCard({ icon, iconBg, label, balance, acquired, taken, barColor, emptyMsg }: BalanceCardProps) {
  const { t } = useTranslation();
  const pct = acquired > 0 ? Math.min(100, (balance / acquired) * 100) : 0;
  return (
    <Paper className="scm-balance-card">
      <Box className="scm-card-top">
        <Box className="scm-card-icon" style={{ backgroundColor: iconBg }}>{icon}</Box>
        <Typography className="scm-card-label">{label}</Typography>
      </Box>
      <Box className="scm-card-value">
        <Typography className="scm-card-number">{balance.toFixed(1)}</Typography>
        <Typography className="scm-card-unit">{t('conge.soldeConge.card.days')}</Typography>
      </Box>
      {emptyMsg && balance === 0 ? (
        <Typography className="scm-card-empty">{emptyMsg}</Typography>
      ) : (
        <Box className="scm-card-stats">
          <Box className="scm-card-stat-row">
            <Typography className="scm-stat-label">{t('conge.soldeConge.card.acquired')}</Typography>
            <Typography className="scm-stat-value">{acquired.toFixed(1)}</Typography>
          </Box>
          <Box className="scm-progress-bar">
            <Box className="scm-progress-fill" style={{ width: `${pct}%`, backgroundColor: barColor }} />
          </Box>
          <Box className="scm-card-stat-row">
            <Typography className="scm-stat-label">{t('conge.soldeConge.card.takenPlaced')}</Typography>
            <Typography className="scm-stat-value scm-stat-taken">{taken.toFixed(1)}</Typography>
          </Box>
        </Box>
      )}
    </Paper>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function SoldeCongeModernInner() {
  const { t } = useTranslation();
  const { uticod, isAdmin, isManager } = useAuth();
  const ownEmpId = uticod || '';

  // Pour admin/manager : possibilité de consulter le solde d'un autre employé.
  // Pour les managers, useGetEmployee filtre déjà la liste sur le service du connecté.
  const canPickEmployee = isAdmin || isManager;

  // Pour l'admin : on ne consulte JAMAIS son propre solde (l'admin n'est pas un employé
  // métier au sens "congés"). On force donc l'admin à passer par la liste déroulante.
  // Pour le manager : par défaut on montre son propre solde (il reste un employé), avec
  // possibilité de basculer vers ceux de son service.
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const empId = isAdmin
    ? (selectedEmpId || '')
    : ((canPickEmployee && selectedEmpId) ? selectedEmpId : ownEmpId);

  // True si la page doit afficher l'invite "sélectionnez un employé" au lieu des données.
  const adminMustPickFirst = isAdmin && !selectedEmpId;

  const { data: empMap } = useGetEmployee();
  const employeeOptions = useMemo(() => {
    if (!canPickEmployee || !empMap || typeof empMap !== 'object') return [] as Array<{ code: string; lib: string }>;
    return Object.entries(empMap as Record<string, string>).map(([code, lib]) => ({ code, lib }));
  }, [empMap, canPickEmployee]);
  const allowedEmpcodes = useMemo(() => new Set(employeeOptions.map((o) => o.code)), [employeeOptions]);

  // Le hook ne fire la requête que si empId est non vide (cf. enabled: !!empcod). Pour l'admin
  // sans sélection, empId === '' donc aucun appel /Soldes/by-emp n'est fait — exactement le
  // comportement demandé.
  const { data: solde, isLoading: loadingSolde } = useGetSoldeByEmp(empId);
  const { data: conges = [], isLoading: loadingConges } = useGetDemConges();

  // Filter to selected employee's leave requests (admin/manager peut sélectionner ; sinon = soi).
  // Pour l'admin sans sélection (empId=''), aucun congé n'est affiché.
  const myConges: Conge[] = useMemo(() =>
    empId ? conges.filter((c: Conge) => c.empcod === empId) : [],
    [conges, empId]
  );

  // Si on change d'employé, réinitialiser visuellement n'est pas nécessaire — les useMemo se
  // recalculent. On affiche juste un libellé d'en-tête contextuel.
  const selectedLabel = useMemo(() => {
    if (!canPickEmployee || !selectedEmpId) return null;
    const opt = employeeOptions.find(o => o.code === selectedEmpId);
    return opt ? `${opt.lib} (${opt.code})` : selectedEmpId;
  }, [canPickEmployee, selectedEmpId, employeeOptions]);

  // Suppress unused warning
  useEffect(() => { /* noop */ }, [selectedLabel]);

  // Safety net: for managers, prevent consulting balances outside their service.
  useEffect(() => {
    if (!isManager || !selectedEmpId) return;
    if (!allowedEmpcodes.has(selectedEmpId)) {
      setSelectedEmpId('');
    }
  }, [isManager, selectedEmpId, allowedEmpcodes]);

  const accepted = myConges.filter((c) => getStatus(c) === 'accepted');
  const refused  = myConges.filter((c) => getStatus(c) === 'refused');
  const pending  = myConges.filter((c) => getStatus(c) === 'pending');

  const { data: allAbsences = [] } = useGetAllAbsences();

  const absencesMap = useMemo(() => {
    const map: Record<string, any> = {};
    allAbsences.forEach((a: any) => {
      map[a.abscod] = a;
    });
    return map;
  }, [allAbsences]);

  // Derive balance values from solde
  const totalBalance  = solde?.conge    ?? 0;
  const totalAcquired = solde?.empconge ?? 0;
  
  // Categorize taken leaves
  const takenStats = useMemo(() => {
    const stats = { paye: 0, csf: 0, css: 0 };
    
    accepted.forEach((c) => {
      const abs = absencesMap[c.abscod];
      const days = c.connbjour ?? 0;
      
      if (abs) {
        if (abs.abscng === '0') stats.paye += days;
        else if (abs.abscng === '1') stats.csf += days;       // Congé Spéciale Familiale
        else if (abs.abscng === '5') stats.css += days;       // Congé Sans Solde
        else if (abs.abspayer === 'O') stats.paye += days;    // Fallback to paid flag
      } else {
        // Fallback for codes if map not ready
        if (c.abscod?.toLowerCase().includes('csf')) stats.csf += days;
        else if (c.abscod?.toLowerCase().includes('css')) stats.css += days;
        else stats.paye += days;
      }
    });
    return stats;
  }, [accepted, absencesMap]);

  const totalTaken = takenStats.paye;

  const currentYear = new Date().getFullYear();
  const refPeriod = `01 Juin ${currentYear - 1} - 31 Mai ${currentYear}`;

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Mon Solde de Congés', 14, 20);
    doc.setFontSize(10);
    doc.text(`Employé: ${empId}  |  Période: ${refPeriod}`, 14, 30);

    autoTable(doc, {
      startY: 40,
      head: [['N° Ordre', 'Type', 'Date départ', 'Date retour', 'Nb. jours', 'Statut']],
      body: myConges.map((c) => [
        c.concod,
        c.abscod,
        fmtDate(c.condep),
        fmtDate(c.conret),
        c.connbjour,
        getStatus(c),
      ]),
    });
    doc.save(`solde-conges-${empId}.pdf`);
  };

  // Pour l'admin sans sélection : pas de loader (rien à charger), pas d'écran vide brut —
  // on saute directement au render qui montrera l'invite "Sélectionnez un employé".
  if (!adminMustPickFirst && (loadingSolde || loadingConges)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={48} />
      </Box>
    );
  }

  return (
    <Box className="scm-container">
      {/* Page title */}
      <Box className="scm-header">
        <Box>
          <Typography className="scm-title">
            {isAdmin
              ? (selectedEmpId ? t('conge.soldeConge.titleNamed', { name: selectedLabel }) : t('conge.soldeConge.titleEmployees'))
              : (canPickEmployee && selectedEmpId ? t('conge.soldeConge.titleNamed', { name: selectedLabel }) : t('conge.soldeConge.titleMine'))}
          </Typography>
          <Box className="scm-period">
            <EventIcon sx={{ fontSize: 16 }} />
            <Typography className="scm-period-text">{t('conge.soldeConge.refPeriod', { period: refPeriod })}</Typography>
          </Box>
          {canPickEmployee && (
            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Autocomplete
                size="small"
                options={employeeOptions}
                getOptionLabel={(o) => `${o.lib} (${o.code})`}
                isOptionEqualToValue={(a, b) => a.code === b.code}
                value={employeeOptions.find(o => o.code === selectedEmpId) || null}
                onChange={(_, val) => setSelectedEmpId(val?.code || '')}
                sx={{ minWidth: 320 }}
                renderInput={(params) => (
                  <TextField {...params} placeholder={isAdmin ? t('conge.soldeConge.selectEmployee') : t('conge.soldeConge.selectMyService')} />
                )}
              />
              {/* Le bouton "Voir mon propre solde" est masqué pour l'admin : un admin ne consulte
                  que des soldes employés, jamais le sien. */}
              {selectedEmpId && !isAdmin && (
                <Button size="small" onClick={() => setSelectedEmpId('')} sx={{ textTransform: 'none' }}>
                  {t('conge.soldeConge.viewMine')}
                </Button>
              )}
            </Box>
          )}
        </Box>
        {/* KPI "Projection fin d'année" retiré : le calcul reposait sur des estimations
            (2.08 j/mois fallback, totalAcquired YTD divisé par 12) qui ne reflètent pas
            la politique RH réelle de chaque société. Pour le rétablir, il faudrait
            l'entitlement annuel exact + la formule d'acquisition tenant côté backend. */}
      </Box>

      {/* Admin sans sélection : invite explicite, on n'affiche pas le reste du dashboard. */}
      {adminMustPickFirst && (
        <Paper sx={{ p: 4, textAlign: 'center', mt: 3, border: '1px dashed #cbd5e1', background: '#f8fafc', boxShadow: 'none' }}>
          <EventIcon sx={{ fontSize: 40, color: '#94a3b8', mb: 1 }} />
          <Typography sx={{ fontWeight: 700, fontSize: '15px', color: '#334155', mb: 0.5 }}>
            {t('conge.soldeConge.selectFirstTitle')}
          </Typography>
          <Typography sx={{ fontSize: '13px', color: '#64748b' }}>
            {t('conge.soldeConge.selectFirstSub')}
          </Typography>
        </Paper>
      )}

      {/* Tout le reste de la page n'a de sens qu'avec un employé ciblé. */}
      {!adminMustPickFirst && (
        <>

      {/* Balance cards */}
      <Box className="scm-cards-grid">
        <BalanceCard
          icon={<BeachAccessIcon sx={{ color: '#0040a1' }} />}
          iconBg="rgba(0,64,161,0.1)"
          label={t('conge.soldeConge.card.paidLeave')}
          balance={totalBalance}
          acquired={totalAcquired}
          taken={totalTaken}
          barColor="#0040a1"
        />
        <BalanceCard
          icon={<FamilyRestroomIcon sx={{ color: '#005136' }} />}
          iconBg="rgba(0,81,54,0.12)"
          label={t('conge.soldeConge.card.specialFamily')}
          balance={takenStats.csf}
          acquired={takenStats.csf}
          taken={takenStats.csf}
          barColor="#005136"
          emptyMsg={t('conge.soldeConge.card.noFamilyLeave')}
        />
        <BalanceCard
          icon={<MoneyOffIcon sx={{ color: '#ba1a1a' }} />}
          iconBg="rgba(186,26,26,0.1)"
          label={t('conge.soldeConge.card.unpaidLeave')}
          balance={takenStats.css}
          acquired={takenStats.css}
          taken={takenStats.css}
          barColor="#ba1a1a"
          emptyMsg={t('conge.soldeConge.card.noUnpaidLeave')}
        />
      </Box>

      {/* Main content */}
      <Box className="scm-main">
        {/* History table */}
        <Paper className="scm-table-card">
          <Box className="scm-table-header">
            <Typography className="scm-table-title">{t('conge.soldeConge.table.title')}</Typography>
            <Button
              startIcon={<DownloadIcon />}
              onClick={handleExportPDF}
              className="scm-export-btn"
            >
              {t('conge.soldeConge.table.exportPdf')}
            </Button>
          </Box>
          <Box className="scm-table-wrap">
            <table className="scm-table">
              <thead>
                <tr>
                  <th>{t('conge.soldeConge.table.date')}</th>
                  <th>{t('conge.soldeConge.table.description')}</th>
                  <th>{t('conge.soldeConge.table.type')}</th>
                  <th className="scm-th-right">{t('conge.soldeConge.table.movement')}</th>
                  <th className="scm-th-right">{t('conge.soldeConge.table.status')}</th>
                </tr>
              </thead>
              <tbody>
                {myConges.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="scm-empty-row">{t('conge.soldeConge.table.noMovements')}</td>
                  </tr>
                ) : (
                  myConges.map((c) => {
                    const status = getStatus(c);
                    const isPos = status === 'accepted';
                    return (
                      <tr key={c.concod} className="scm-tr">
                        <td className="scm-td-date">{fmtDate(c.condep)}</td>
                        <td>
                          <Typography className="scm-td-title">{t('conge.soldeConge.table.leaveTaken')}</Typography>
                          <Typography className="scm-td-sub">{c.abscod} — {fmtDate(c.condep)} → {fmtDate(c.conret)}</Typography>
                        </td>
                        <td>
                          <Chip
                            label={c.abscod || 'N/A'}
                            size="small"
                            className="scm-type-chip"
                          />
                        </td>
                        <td className="scm-td-right">
                          <Typography className={`scm-movement ${isPos ? 'scm-movement-neg' : 'scm-movement-pending'}`}>
                            -{c.connbjour} {t('conge.soldeConge.table.daysShort')}
                          </Typography>
                        </td>
                        <td className="scm-td-right">
                          <Box className="scm-status-cell">
                            {status === 'accepted' && <CheckCircleIcon sx={{ fontSize: 14, color: '#166534' }} />}
                            {status === 'refused' && <CancelIcon sx={{ fontSize: 14, color: '#991b1b' }} />}
                            {status === 'pending' && <HourglassEmptyIcon sx={{ fontSize: 14, color: '#854d0e' }} />}
                            <Typography className={`scm-status-text scm-status-${status === 'accepted' ? 'ok' : status === 'refused' ? 'ko' : 'wait'}`}>
                              {t(`conge.soldeConge.table.status${status.charAt(0).toUpperCase() + status.slice(1)}`)}
                            </Typography>
                          </Box>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Box>
        </Paper>

        {/* Sidebar */}
        <Box className="scm-sidebar">
          {/* Consumption chart */}
          <Paper className="scm-chart-card">
            <Box className="scm-chart-header">
              <Typography className="scm-chart-title">{t('conge.soldeConge.chart.title')}</Typography>
              <Chip label={String(currentYear)} size="small" className="scm-year-chip" />
            </Box>
            <Box className="scm-chart-bars">
              {Array.from({ length: 7 }, (_, i) => {
                const heights = [40, 65, 85, 30, 55, 45, 20];
                return (
                  <Box key={i} className="scm-bar-wrap">
                    <Box className="scm-bar" style={{ height: `${heights[i]}%` }} />
                  </Box>
                );
              })}
            </Box>
            <Box className="scm-chart-labels">
              <Typography className="scm-chart-label">{t('conge.soldeConge.chart.labelStart')}</Typography>
              <Typography className="scm-chart-label">{t('conge.soldeConge.chart.labelEnd')}</Typography>
            </Box>
            <Typography className="scm-chart-note">
              <Trans
                i18nKey="conge.soldeConge.chart.note"
                count={accepted.length}
                values={{ count: accepted.length }}
                components={{ 0: <strong style={{ color: '#0040a1' }} /> }}
              />
            </Typography>
          </Paper>

          {/* Quick stats */}
          <Box className="scm-quick-stats">
            <Paper className="scm-stat-item">
              <CheckCircleIcon sx={{ color: '#166534', fontSize: 20 }} />
              <Typography className="scm-stat-num scm-stat-green">{accepted.length}</Typography>
              <Typography className="scm-stat-lbl">{t('conge.soldeConge.quickStats.validated')}</Typography>
            </Paper>
            <Paper className="scm-stat-item">
              <CancelIcon sx={{ color: '#991b1b', fontSize: 20 }} />
              <Typography className="scm-stat-num scm-stat-red">{refused.length}</Typography>
              <Typography className="scm-stat-lbl">{t('conge.soldeConge.quickStats.refused')}</Typography>
            </Paper>
            <Paper className="scm-stat-item">
              <HourglassEmptyIcon sx={{ color: '#854d0e', fontSize: 20 }} />
              <Typography className="scm-stat-num scm-stat-yellow">{pending.length}</Typography>
              <Typography className="scm-stat-lbl">{t('conge.soldeConge.quickStats.pending')}</Typography>
            </Paper>
          </Box>

          {/* Info card */}
          <Paper className="scm-info-card">
            <Box className="scm-info-header">
              <AutoAwesomeIcon sx={{ color: '#93c5fd', fontSize: 20 }} />
              <Typography className="scm-info-title">{t('conge.soldeConge.info.rolloverTitle')}</Typography>
            </Box>
            <Typography className="scm-info-text">
              {t('conge.soldeConge.info.rolloverText')}
            </Typography>
          </Paper>
        </Box>
      </Box>
      </>
      )}
    </Box>
  );
}

const SoldeCongeModern = () => {
  const qc = new QueryClient();
  return (
    <QueryClientProvider client={qc}>
      <SoldeCongeModernInner />
    </QueryClientProvider>
  );
};

export default SoldeCongeModern;
