import { useMemo } from 'react';
import { Box, Typography, Paper, Button, CircularProgress, Chip } from '@mui/material';
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
import { useAuth } from '../../../helper/AuthProvider';
import useGetSoldeByEmp from '../../../../hooks/soldeCongeHooks/useGetSoldeByEmp';
import useGetDemConges from '../../../../hooks/congeHooks/useGetDemConges';
import useGetAllAbsences from '../../../../hooks/absenceHooks/useGetAllAbsence';
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

const getStatus = (c: Conge): 'Accepté' | 'Refusé' | 'En attente' => {
  const n = c.etat?.trim().toLowerCase() ?? '';
  if (n.includes('refus') || c.conrefus === '1') return 'Refusé';
  if (n.includes('accept')) return 'Accepté';
  return 'En attente';
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
  const pct = acquired > 0 ? Math.min(100, (balance / acquired) * 100) : 0;
  return (
    <Paper className="scm-balance-card">
      <Box className="scm-card-top">
        <Box className="scm-card-icon" style={{ backgroundColor: iconBg }}>{icon}</Box>
        <Typography className="scm-card-label">{label}</Typography>
      </Box>
      <Box className="scm-card-value">
        <Typography className="scm-card-number">{balance.toFixed(1)}</Typography>
        <Typography className="scm-card-unit">jours</Typography>
      </Box>
      {emptyMsg && balance === 0 ? (
        <Typography className="scm-card-empty">{emptyMsg}</Typography>
      ) : (
        <Box className="scm-card-stats">
          <Box className="scm-card-stat-row">
            <Typography className="scm-stat-label">Acquis</Typography>
            <Typography className="scm-stat-value">{acquired.toFixed(1)}</Typography>
          </Box>
          <Box className="scm-progress-bar">
            <Box className="scm-progress-fill" style={{ width: `${pct}%`, backgroundColor: barColor }} />
          </Box>
          <Box className="scm-card-stat-row">
            <Typography className="scm-stat-label">Pris / Posés</Typography>
            <Typography className="scm-stat-value scm-stat-taken">{taken.toFixed(1)}</Typography>
          </Box>
        </Box>
      )}
    </Paper>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function SoldeCongeModernInner() {
  const { uticod } = useAuth();
  const empId = uticod || '';

  const { data: solde, isLoading: loadingSolde } = useGetSoldeByEmp(empId);
  const { data: conges = [], isLoading: loadingConges } = useGetDemConges();

  // Filter to current employee's leave requests
  const myConges: Conge[] = useMemo(() =>
    conges.filter((c: Conge) => c.empcod === empId),
    [conges, empId]
  );

  const accepted = myConges.filter((c) => getStatus(c) === 'Accepté');
  const refused  = myConges.filter((c) => getStatus(c) === 'Refusé');
  const pending  = myConges.filter((c) => getStatus(c) === 'En attente');

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

  // Projection: current balance + estimated monthly accrual for remaining months
  const currentMonth = new Date().getMonth();
  const remainingMonths = 12 - currentMonth;
  const monthlyAccrual = totalAcquired > 0 ? totalAcquired / 12 : 2.08;
  const projection = totalBalance + monthlyAccrual * remainingMonths;

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

  if (loadingSolde || loadingConges) {
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
          <Typography className="scm-title">Mon Solde de Congés</Typography>
          <Box className="scm-period">
            <EventIcon sx={{ fontSize: 16 }} />
            <Typography className="scm-period-text">Période de référence : {refPeriod}</Typography>
          </Box>
        </Box>
        <Paper className="scm-projection-card">
          <Box className="scm-projection-icon"><AutoAwesomeIcon /></Box>
          <Box>
            <Typography className="scm-projection-label">Projection fin d'année</Typography>
            <Typography className="scm-projection-value">
              {projection.toFixed(1)} <span className="scm-projection-unit">jours estimés</span>
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* Balance cards */}
      <Box className="scm-cards-grid">
        <BalanceCard
          icon={<BeachAccessIcon sx={{ color: '#0040a1' }} />}
          iconBg="rgba(0,64,161,0.1)"
          label="Congés Payés"
          balance={totalBalance}
          acquired={totalAcquired}
          taken={totalTaken}
          barColor="#0040a1"
        />
        <BalanceCard
          icon={<FamilyRestroomIcon sx={{ color: '#005136' }} />}
          iconBg="rgba(0,81,54,0.12)"
          label="Congé Spéciale Familiale"
          balance={takenStats.csf}
          acquired={takenStats.csf}
          taken={takenStats.csf}
          barColor="#005136"
          emptyMsg="Aucun congé spéciale familiale pris cette année."
        />
        <BalanceCard
          icon={<MoneyOffIcon sx={{ color: '#ba1a1a' }} />}
          iconBg="rgba(186,26,26,0.1)"
          label="Congé Sans Solde"
          balance={takenStats.css}
          acquired={takenStats.css}
          taken={takenStats.css}
          barColor="#ba1a1a"
          emptyMsg="Aucun congé sans solde pris cette année."
        />
      </Box>

      {/* Main content */}
      <Box className="scm-main">
        {/* History table */}
        <Paper className="scm-table-card">
          <Box className="scm-table-header">
            <Typography className="scm-table-title">Historique des Mouvements</Typography>
            <Button
              startIcon={<DownloadIcon />}
              onClick={handleExportPDF}
              className="scm-export-btn"
            >
              Exporter (PDF)
            </Button>
          </Box>
          <Box className="scm-table-wrap">
            <table className="scm-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th className="scm-th-right">Mouvement</th>
                  <th className="scm-th-right">Statut</th>
                </tr>
              </thead>
              <tbody>
                {myConges.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="scm-empty-row">Aucun mouvement enregistré</td>
                  </tr>
                ) : (
                  myConges.map((c) => {
                    const status = getStatus(c);
                    const isPos = status === 'Accepté';
                    return (
                      <tr key={c.concod} className="scm-tr">
                        <td className="scm-td-date">{fmtDate(c.condep)}</td>
                        <td>
                          <Typography className="scm-td-title">Prise de Congé</Typography>
                          <Typography className="scm-td-sub">{c.abscod} — {fmtDate(c.condep)} au {fmtDate(c.conret)}</Typography>
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
                            -{c.connbjour} j
                          </Typography>
                        </td>
                        <td className="scm-td-right">
                          <Box className="scm-status-cell">
                            {status === 'Accepté' && <CheckCircleIcon sx={{ fontSize: 14, color: '#166534' }} />}
                            {status === 'Refusé' && <CancelIcon sx={{ fontSize: 14, color: '#991b1b' }} />}
                            {status === 'En attente' && <HourglassEmptyIcon sx={{ fontSize: 14, color: '#854d0e' }} />}
                            <Typography className={`scm-status-text scm-status-${status === 'Accepté' ? 'ok' : status === 'Refusé' ? 'ko' : 'wait'}`}>
                              {status}
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
              <Typography className="scm-chart-title">Consommation annuelle</Typography>
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
              <Typography className="scm-chart-label">Juin</Typography>
              <Typography className="scm-chart-label">Déc</Typography>
            </Box>
            <Typography className="scm-chart-note">
              Vous avez consommé <strong style={{ color: '#0040a1' }}>{accepted.length} demande{accepted.length !== 1 ? 's' : ''}</strong> acceptée{accepted.length !== 1 ? 's' : ''} cette année.
            </Typography>
          </Paper>

          {/* Quick stats */}
          <Box className="scm-quick-stats">
            <Paper className="scm-stat-item">
              <CheckCircleIcon sx={{ color: '#166534', fontSize: 20 }} />
              <Typography className="scm-stat-num scm-stat-green">{accepted.length}</Typography>
              <Typography className="scm-stat-lbl">Validés</Typography>
            </Paper>
            <Paper className="scm-stat-item">
              <CancelIcon sx={{ color: '#991b1b', fontSize: 20 }} />
              <Typography className="scm-stat-num scm-stat-red">{refused.length}</Typography>
              <Typography className="scm-stat-lbl">Refusés</Typography>
            </Paper>
            <Paper className="scm-stat-item">
              <HourglassEmptyIcon sx={{ color: '#854d0e', fontSize: 20 }} />
              <Typography className="scm-stat-num scm-stat-yellow">{pending.length}</Typography>
              <Typography className="scm-stat-lbl">En attente</Typography>
            </Paper>
          </Box>

          {/* Info card */}
          <Paper className="scm-info-card">
            <Box className="scm-info-header">
              <AutoAwesomeIcon sx={{ color: '#93c5fd', fontSize: 20 }} />
              <Typography className="scm-info-title">Règle de report</Typography>
            </Box>
            <Typography className="scm-info-text">
              Les congés payés non pris au 31 mai seront automatiquement transférés vers votre Compte Épargne Temps (CET), dans la limite de 10 jours.
            </Typography>
          </Paper>
        </Box>
      </Box>
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
