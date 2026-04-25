import { useState, useMemo } from 'react';
import {
  Box, Typography, CircularProgress, Alert, Avatar, Chip, Button,
  Select, MenuItem, FormControl, Dialog, DialogTitle, DialogContent, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import ScheduleIcon from '@mui/icons-material/Schedule';
import MoreTimeIcon from '@mui/icons-material/MoreTime';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import FilterListIcon from '@mui/icons-material/FilterList';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import dayjs from 'dayjs';
import { useAuth } from '../helper/AuthProvider';
import useGetDashboardData from '../../hooks/dashboardHooks/useGetDashboardData';
import useGetEvolution from '../../hooks/dashboardHooks/useGetEvolution';
import useGetPointagesInvalides from '../../hooks/dashboardHooks/useGetPointagesInvalides';
import useGetDirectionLibs from '../../hooks/directionHooks/useGetDirectionLibs';
import useGetExpiringContracts from '../../hooks/contractHooks/useGetExpiringContracts';
import { DashboardRequest } from '../../models/DashboardModels';
import { CongeProvider } from '../helper/CongeContext';
import DashboardCongeList from './DashboardCongeList';
import EvolutionChart from './Bars/EvolutionChart';
import './DashboardModern.css';
import EmployeeDashboard from './EmployeeDashboard';
import useGetPendingDemCongesByPeriode from '../../hooks/congeHooks/useGetPendingDemConge';

const AVATAR_COLORS = ['#0040a1', '#047857', '#b45309', '#6d28d9', '#065f46'];

function KpiCard({ icon, label, value, trend, trendLabel, trendPositive, iconBg, iconColor }: {
  icon: React.ReactNode; label: string; value: string | number;
  trend?: number; trendLabel?: string; trendPositive?: boolean;
  iconBg: string; iconColor: string;
}) {
  const isGood = trendPositive ? (trend ?? 0) >= 0 : (trend ?? 0) <= 0;
  return (
    <Box className="db-kpi-card">
      <Box className="db-kpi-top">
        <Box className="db-kpi-icon" style={{ backgroundColor: iconBg, color: iconColor }}>{icon}</Box>
        {trend !== undefined ? (
          <Box className={`db-kpi-badge ${isGood ? 'db-badge-good' : 'db-badge-bad'}`}>
            {isGood ? <TrendingUpIcon sx={{ fontSize: 12 }} /> : <TrendingDownIcon sx={{ fontSize: 12 }} />}
            {Math.abs(trend).toFixed(1)}%
          </Box>
        ) : trendLabel ? (
          <Typography className="db-kpi-badge-neutral">{trendLabel}</Typography>
        ) : null}
      </Box>
      <Typography className="db-kpi-label">{label}</Typography>
      <Typography className="db-kpi-value">{value}</Typography>
    </Box>
  );
}

export default function DashboardModern() {
  const { utiadm, isManager } = useAuth();
  const isAdmin = utiadm === '1';

  if (!isAdmin && !isManager) return <EmployeeDashboard />;

  return <DashboardModernAdmin />;
}

function DashboardModernAdmin() {
  const { soccod } = useAuth();
  const [filterDateRange, setFilterDateRange] = useState<'today' | 'week' | 'month'>('today');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [openCongeDialog, setOpenCongeDialog] = useState(false);
  const [openPointageDialog, setOpenPointageDialog] = useState(false);
  const [openContractDialog, setOpenContractDialog] = useState(false);

  const { data: expiringContracts = [] } = useGetExpiringContracts(soccod);
  const { data: directionsResponse } = useGetDirectionLibs();
  const directionLibs = useMemo(() => {
    if (!directionsResponse || typeof directionsResponse !== 'object') return [];
    return Object.entries(directionsResponse).map(([code, label]) => ({ dircod: code, dirlib: label }));
  }, [directionsResponse]);

  const dateRange = useMemo(() => {
    const now = dayjs();
    switch (filterDateRange) {
      case 'today': return { dateDebut: now.startOf('day').toISOString(), dateFin: now.endOf('day').toISOString() };
      case 'week': return { dateDebut: now.startOf('week').add(1, 'day').toISOString(), dateFin: now.endOf('week').add(1, 'day').toISOString() };
      case 'month': return { dateDebut: now.startOf('month').toISOString(), dateFin: now.endOf('month').toISOString() };
    }
  }, [filterDateRange]);

  const dashboardRequest: DashboardRequest | null = useMemo(() => {
    if (!soccod || !dateRange) return null;
    return { soccod, dateDebut: dateRange.dateDebut, dateFin: dateRange.dateFin, dateRange: filterDateRange, departement: filterDepartment === 'all' ? null : filterDepartment, empcods: [] };
  }, [soccod, filterDepartment, dateRange, filterDateRange]);

  const { data: dashboardData, isLoading, error } = useGetDashboardData(dashboardRequest);
  const { data: evolutionData, isLoading: loadingEvolution } = useGetEvolution(dashboardRequest);

  const formattedDebut = useMemo(() => dateRange ? dayjs(dateRange.dateDebut).format('YYYY-MM-DD') : '', [dateRange]);
  const formattedFin = useMemo(() => dateRange ? dayjs(dateRange.dateFin).format('YYYY-MM-DD') : '', [dateRange]);

  const { data: demandesData, isLoading: loadingDemandes } = useGetPendingDemCongesByPeriode(formattedDebut, formattedFin, true);
  const { data: pointagesData, isLoading: loadingPointages, error: errorPointages } = useGetPointagesInvalides(dashboardRequest, openPointageDialog);

  const today = dayjs().format('DD MMMM YYYY');

  if (isLoading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <CircularProgress size={48} sx={{ color: '#0040a1' }} />
    </Box>
  );

  if (error) return (
    <Box sx={{ p: 3 }}><Alert severity="error">Erreur lors du chargement du tableau de bord</Alert></Box>
  );

  const presenceRate = dashboardData ? ((dashboardData.effectifPresent / Math.max(dashboardData.effectifTotal || 1, 1)) * 100).toFixed(1) : '--';
  const absenceRate = dashboardData ? (100 - parseFloat(presenceRate as string)).toFixed(1) : '--';

  return (
    <Box className="db-container">
      {/* Welcome header */}
      <Box className="db-welcome">
        <Box>
          <Typography className="db-title">Vue d'ensemble</Typography>
          <Typography className="db-subtitle">Mise à jour aujourd'hui, le {today}</Typography>
        </Box>
        <Button startIcon={<FileDownloadIcon />} className="db-export-btn">
          Exporter le rapport
        </Button>
      </Box>

      {/* Filter bar */}
      <Box className="db-filter-bar">
        <Box className="db-filter-item">
          <Box className="db-filter-icon-wrap">
            <FilterListIcon sx={{ fontSize: 18, color: '#0040a1' }} />
          </Box>
          <FormControl size="small" variant="standard" sx={{ minWidth: 160 }}>
            <Select value={filterDateRange} onChange={e => setFilterDateRange(e.target.value as any)} disableUnderline sx={{ fontSize: '13px', fontWeight: 600 }}>
              <MenuItem value="today">Aujourd'hui</MenuItem>
              <MenuItem value="week">Cette semaine</MenuItem>
              <MenuItem value="month">Ce mois</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box className="db-filter-item">
          <Box className="db-filter-icon-wrap">
            <Box sx={{ width: 18, height: 18, color: '#0040a1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏢</Box>
          </Box>
          <FormControl size="small" variant="standard" sx={{ minWidth: 180 }}>
            <Select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)} disableUnderline sx={{ fontSize: '13px', fontWeight: 600 }}>
              <MenuItem value="all">Tous les Départements</MenuItem>
              {directionLibs.map((d: any) => <MenuItem key={d.dircod} value={d.dircod}>{d.dirlib}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <Button className="db-filter-apply-btn" startIcon={<FilterListIcon />}>
          Appliquer les filtres
        </Button>
      </Box>

      {/* KPI Row */}
      <Box className="db-kpi-grid">
        <KpiCard
          icon={<HowToRegIcon sx={{ fontSize: 20 }} />}
          label="Taux de Présence"
          value={`${presenceRate}%`}
          trend={dashboardData?.pourcentagePresence}
          trendPositive
          iconBg="rgba(0,64,161,0.1)" iconColor="#0040a1"
        />
        <KpiCard
          icon={<PersonOffIcon sx={{ fontSize: 20 }} />}
          label="Taux d'Absentéisme"
          value={`${absenceRate}%`}
          trend={dashboardData?.evolutionAbsences}
          trendPositive={false}
          iconBg="rgba(186,26,26,0.1)" iconColor="#ba1a1a"
        />
        <KpiCard
          icon={<ScheduleIcon sx={{ fontSize: 20 }} />}
          label="Ponctualité"
          value={dashboardData ? `${(100 - (dashboardData.nombreRetards / Math.max(dashboardData.effectifPresent, 1)) * 100).toFixed(1)}%` : '--'}
          trendLabel="Moyenne"
          iconBg="rgba(81,95,116,0.1)" iconColor="#515f74"
        />
        <KpiCard
          icon={<MoreTimeIcon sx={{ fontSize: 20 }} />}
          label="Heures Supp. Cumulées"
          value={dashboardData ? `${dashboardData.heuresTravaillees.toFixed(0)} hrs` : '--'}
          trendLabel="Ce mois"
          iconBg="rgba(0,81,54,0.1)" iconColor="#005136"
        />
      </Box>

      {/* Bento grid */}
      <Box className="db-bento-top">
        {/* Total employees */}
        <Box className="db-bento-employees">
          <Typography className="db-bento-label">Total Employés</Typography>
          <Box className="db-bento-emp-value">
            <Typography className="db-bento-big-num">{dashboardData?.effectifTotal ?? '--'}</Typography>
            {dashboardData && <Box className="db-bento-trend-badge"><TrendingUpIcon sx={{ fontSize: 14 }} /> +12%</Box>}
          </Box>
          <Box className="db-bento-avatars">
            {[...Array(3)].map((_, i) => (
              <Avatar key={i} sx={{ width: 40, height: 40, border: '3px solid white', background: AVATAR_COLORS[i], fontSize: '13px', fontWeight: 700, ml: i > 0 ? -1.5 : 0 }}>
                {String.fromCharCode(65 + i)}
              </Avatar>
            ))}
            <Avatar sx={{ width: 40, height: 40, border: '3px solid white', background: '#d5e3fc', color: '#0040a1', fontSize: '11px', fontWeight: 700, ml: -1.5 }}>
              +{Math.max(0, (dashboardData?.effectifTotal ?? 0) - 3)}
            </Avatar>
          </Box>
        </Box>

        {/* Congés en cours */}
        <Box className="db-bento-conges" onClick={() => setOpenCongeDialog(true)} sx={{ cursor: 'pointer' }}>
          <Box className="db-bento-conges-top">
            <Typography className="db-bento-label">Congés en cours</Typography>
            <Box className="db-bento-icon-wrap-green"><EventAvailableIcon sx={{ fontSize: 20 }} /></Box>
          </Box>
          <Typography className="db-bento-medium-num">{demandesData?.length ?? dashboardData?.totalDemandesEnAttente ?? '--'}</Typography>
          <Typography className="db-bento-sub">Demandes en attente d'approbation</Typography>
          <Box className="db-bento-progress">
            <Box className="db-bento-progress-fill" style={{ width: '75%' }} />
          </Box>
        </Box>

        {/* Alertes contrat */}
        <Box className="db-bento-alerts" onClick={() => setOpenContractDialog(true)} sx={{ cursor: 'pointer' }}>
          <Box className="db-bento-alerts-top">
            <Typography className="db-bento-label-error">Alertes Contrat</Typography>
            <Box className="db-bento-icon-wrap-error"><PriorityHighIcon sx={{ fontSize: 20 }} /></Box>
          </Box>
          <Typography className="db-bento-medium-num">{expiringContracts.length || dashboardData?.pointagesIncomplets || 0}</Typography>
          <Typography className="db-bento-sub-error">
            Contrats échus ce mois →
          </Typography>
        </Box>
      </Box>

      {/* Charts + Absences */}
      <Box className="db-charts-row">
        {/* Evolution chart */}
        <Box className="db-chart-card">
          <Box className="db-chart-header">
            <Box>
              <Typography className="db-chart-title">Tendances de recrutement</Typography>
              <Typography className="db-chart-sub">Évolution mensuelle {dayjs().year()}</Typography>
            </Box>
            <Box className="db-chart-legend">
              <Box className="db-legend-item"><Box className="db-legend-dot" style={{ background: '#0040a1' }} /><Typography className="db-legend-label">Entrées</Typography></Box>
              <Box className="db-legend-item"><Box className="db-legend-dot" style={{ background: '#515f74' }} /><Typography className="db-legend-label">Départs</Typography></Box>
            </Box>
          </Box>
          <EvolutionChart data={Array.isArray(evolutionData) ? evolutionData : []} isLoading={loadingEvolution} />
        </Box>

        {/* Recent absences */}
        <Box className="db-absences-card">
          <Box className="db-absences-header">
            <Typography className="db-chart-title">Absences récentes</Typography>
          </Box>
          <Box className="db-absences-list">
            {dashboardData && dashboardData.totalAbsences > 0 ? (
              <Box className="db-absence-item">
                <Avatar sx={{ width: 40, height: 40, background: '#0040a1', fontSize: '13px', fontWeight: 700 }}>A</Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography className="db-absence-name">Absences du jour</Typography>
                  <Typography className="db-absence-type">Total: {dashboardData.totalAbsences}</Typography>
                </Box>
                <Chip label="Actif" size="small" sx={{ background: 'rgba(0,81,54,0.1)', color: '#005136', fontWeight: 700, fontSize: '10px' }} />
              </Box>
            ) : (
              <Typography sx={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', py: 3 }}>
                Aucune absence enregistrée
              </Typography>
            )}
            {dashboardData && dashboardData.nombreRetards > 0 && (
              <Box className="db-absence-item">
                <Avatar sx={{ width: 40, height: 40, background: '#ba1a1a', fontSize: '13px', fontWeight: 700 }}>R</Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography className="db-absence-name">Retards du jour</Typography>
                  <Typography className="db-absence-type">Total: {dashboardData.nombreRetards}</Typography>
                </Box>
                <Chip label="Actif" size="small" sx={{ background: 'rgba(186,26,26,0.1)', color: '#ba1a1a', fontWeight: 700, fontSize: '10px' }} />
              </Box>
            )}
          </Box>
          <Button className="db-see-all-btn" fullWidth>Voir tout le calendrier</Button>
        </Box>
      </Box>

      {/* Bottom row */}
      <Box className="db-bottom-row">
        {/* AI promo card */}
        <Box className="db-ai-card">
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography className="db-ai-title">Optimisez vos revues de<br />performance trimestrielles.</Typography>
            <Typography className="db-ai-sub">Notre nouvel outil d'IA génère des rapports de synthèse basés sur les retours d'équipe pour vous faire gagner 4h par manager.</Typography>
            <Button className="db-ai-btn" startIcon={<AutoAwesomeIcon />}>Découvrir Ledger AI</Button>
          </Box>
          <AutoAwesomeIcon sx={{ position: 'absolute', right: -20, bottom: -20, fontSize: 160, opacity: 0.08, color: 'white' }} />
        </Box>

        {/* Contract renewals */}
        <Box className="db-renewals-card">
          <Typography className="db-chart-title" sx={{ mb: 2 }}>Prochains renouvellements de contrat</Typography>
          {dashboardData?.pointagesIncomplets ? (
            <Box className="db-renewal-item db-renewal-urgent">
              <Box>
                <Typography className="db-renewal-name">Pointages incomplets</Typography>
                <Typography className="db-renewal-type">Vérification requise</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography className="db-renewal-days-error">{dashboardData.pointagesIncomplets} cas</Typography>
                <Typography className="db-renewal-action">Renouveler</Typography>
              </Box>
            </Box>
          ) : null}
          {(demandesData?.length || dashboardData?.totalDemandesEnAttente) ? (
            <Box className="db-renewal-item db-renewal-normal">
              <Box>
                <Typography className="db-renewal-name">Demandes en attente</Typography>
                <Typography className="db-renewal-type">Validation requise</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography className="db-renewal-days-primary">{demandesData?.length ?? dashboardData?.totalDemandesEnAttente} demandes</Typography>
                <Typography className="db-renewal-action">Valider</Typography>
              </Box>
            </Box>
          ) : (
            <Typography sx={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', py: 3 }}>
              Aucun renouvellement imminent
            </Typography>
          )}
        </Box>
      </Box>

      {/* Dialogs */}
      {/* Conge Dialog - Redesigned */}
      <Dialog open={openCongeDialog} onClose={() => setOpenCongeDialog(false)} maxWidth="md" fullWidth 
        PaperProps={{ sx: { borderRadius: '16px', overflow: 'hidden' } }}>
        <Box sx={{ background: 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)', px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <EventAvailableIcon sx={{ color: 'white', fontSize: 24 }} />
            <Box>
              <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '16px', fontFamily: 'Manrope, sans-serif' }}>Demandes de Congé en Attente</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>{demandesData?.length || 0} demande(s) trouvée(s)</Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setOpenCongeDialog(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <DialogContent sx={{ p: 0 }}>
          <CongeProvider><DashboardCongeList data={demandesData || []} isLoading={loadingDemandes} /></CongeProvider>
        </DialogContent>
      </Dialog>

      {/* Contract Expiry Dialog */}
      <Dialog open={openContractDialog} onClose={() => setOpenContractDialog(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: '16px', overflow: 'hidden' } }}>
        <Box sx={{ background: 'linear-gradient(135deg, #ba1a1a 0%, #dc2626 100%)', px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <PriorityHighIcon sx={{ color: 'white', fontSize: 24 }} />
            <Box>
              <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '16px', fontFamily: 'Manrope, sans-serif' }}>Contrats Échus ce Mois</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>{expiringContracts.length} contrat(s) arrivent à expiration</Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setOpenContractDialog(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <DialogContent sx={{ p: 2 }}>
          {!expiringContracts.length ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography sx={{ color: '#059669', fontWeight: 700, fontSize: '14px' }}>✅ Aucun contrat n'expire ce mois</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: '10px', mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ background: '#fef2f2' }}>
                    {['Matricule', 'Employé', 'Type', 'Date Embauche', 'Date Échéance', 'Jours Restants'].map(h => (
                      <TableCell key={h} sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#991b1b' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {expiringContracts.map((c: any, i: number) => {
                    const daysLeft = c.empsort ? Math.ceil((new Date(c.empsort).getTime() - Date.now()) / 86400000) : 0;
                    return (
                      <TableRow key={i} sx={{ background: i % 2 === 0 ? '#fff' : '#fef2f2' }}>
                        <TableCell sx={{ fontWeight: 600 }}>{c.empcod || '-'}</TableCell>
                        <TableCell>{c.emplib || '-'}</TableCell>
                        <TableCell><Chip label={c.contype || 'CDD'} size="small" sx={{ background: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: '10px' }} /></TableCell>
                        <TableCell>{c.empemb ? dayjs(c.empemb).format('DD/MM/YYYY') : '-'}</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#ba1a1a' }}>{c.empsort ? dayjs(c.empsort).format('DD/MM/YYYY') : '-'}</TableCell>
                        <TableCell>
                          <Chip 
                            label={`${daysLeft}j`} 
                            size="small" 
                            sx={{ 
                              background: daysLeft <= 7 ? '#fee2e2' : daysLeft <= 15 ? '#fef3c7' : '#dcfce7', 
                              color: daysLeft <= 7 ? '#991b1b' : daysLeft <= 15 ? '#92400e' : '#166534', 
                              fontWeight: 700, fontSize: '10px' 
                            }} 
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openPointageDialog} onClose={() => setOpenPointageDialog(false)} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}
        sx={{
          '& .MuiDialog-container': { alignItems: 'center' },
          '& .MuiDialog-paper': {
            margin: { xs: 0, sm: '32px' },
            width: { xs: '30%', sm: 'auto' },
            maxWidth: { xs: '50%', sm: '500px' },
          },
        }}>
        <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>Pointages non complètes</DialogTitle>
        <DialogContent>
          {loadingPointages ? <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
            : errorPointages ? <Alert severity="error">Erreur lors de la récupération.</Alert>
              : !pointagesData?.length ? <Alert severity="info">Aucun pointage non complet trouvé.</Alert>
                : (
                  <TableContainer component={Paper} sx={{ mt: 1, borderRadius: '10px' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ background: '#f8fafc' }}>
                          {['Matricule', 'Nom', 'Département', 'Date', 'Arrivée', 'Départ', 'Commentaire'].map(h => (
                            <TableCell key={h} sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pointagesData.map((row: any, i: number) => (
                          <TableRow key={i} sx={{ background: row.entreeManquante ? '#fff3e0' : '#ffebee' }}>
                            <TableCell>{row.empcod || '-'}</TableCell>
                            <TableCell>{row.emplib || '-'}</TableCell>
                            <TableCell>{row.departement || '-'}</TableCell>
                            <TableCell>{row.predat ? dayjs(row.predat).format('DD/MM/YYYY') : '-'}</TableCell>
                            <TableCell>{row.preentmatup || '-'}</TableCell>
                            <TableCell>{row.presortamidiup || row.presortmatup || '-'}</TableCell>
                            <TableCell><Typography variant="caption" sx={{ color: '#d32f2f', fontWeight: 500 }}>{row.motif || '-'}</Typography></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
