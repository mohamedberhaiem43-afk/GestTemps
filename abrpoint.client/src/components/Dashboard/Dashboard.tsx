import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { useState, useMemo } from 'react';
import {
  Typography,
  Card,
  CardContent,
  TextField,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Button,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { DashboardRequest } from '../../models/DashboardModels';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import GroupIcon from '@mui/icons-material/Group';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningIcon from '@mui/icons-material/Warning';
import AssignmentIcon from '@mui/icons-material/Assignment';
import useGetDashboardData from '../../hooks/dashboardHooks/useGetDashboardData';
import useGetPointagesInvalides from '../../hooks/dashboardHooks/useGetPointagesInvalides';
import dayjs from 'dayjs';
import { useAuth } from '../helper/AuthProvider';
import useGetDirectionLibs from '../../hooks/directionHooks/useGetDirectionLibs';
import useGetEvolution from '../../hooks/dashboardHooks/useGetEvolution';
import EvolutionChart from './Bars/EvolutionChart';
import useGetDemCongesByPeriode from '../../hooks/congeHooks/useGetDemCongesByPeriode';
import DashboardCongeList from './DashboardCongeList';
import { CongeProvider } from '../helper/CongeContext';
import EmployeeDashboard from './EmployeeDashboard';


interface KPIData {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  evolution?: number;
  positiveIsGood?: boolean;
  color: string;
}


export default function DashboardPage() {
  const { t } = useTranslation();
  // const [sexStat, setSexStat] = useState<formattedData[]>([]);
  const [filterDateRange, setFilterDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  // const [searchTerm, setSearchTerm] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Source de vérité RBAC : isAdmin = roleName=Administrator (ou Utiadm=1 en compat).
  const { isAdmin, isManager, roleName, viewAsEmployee } = useAuth();

  // Le tableau de bord de GESTION (KPI workforce, présence, retards…) est réservé aux profils
  // de gestion : admin, manager, ou responsable RH. Ses données sont scopées CÔTÉ SERVEUR selon
  // le rôle (admin/RH → leurs sites ; manager → ses sites + son service). Les autres profils —
  // ou un utilisateur dual-role qui a basculé sur la vue « salarié » via le sélecteur
  // d'interface — obtiennent leur espace salarié.
  const isManagementRole = isAdmin || isManager || roleName === 'ResponsableRH';
  if (viewAsEmployee || !isManagementRole) {
    return <EmployeeDashboard />;
  }

  // Admin dashboard logic continues below...

  const { data: directionsResponse } = useGetDirectionLibs();
  const directionLibs = directionsResponse || [];

  const directionLibsArray = useMemo(() => {
    if (!directionLibs || typeof directionLibs !== 'object') return [];
    return Object.entries(directionLibs).map(([code, label]) => ({
      dircod: code,
      dirlib: label
    }));
  }, [directionLibs]);

  const { soccod } = useAuth();
  const getDateRangeForRequest = useMemo(() => {
    const now = dayjs();

    switch (filterDateRange) {
      case 'today':
        return {
          dateDebut: now.startOf('day').toISOString(),
          dateFin: now.endOf('day').toISOString(),
        };

      case 'week':
        return {
          dateDebut: now.startOf('week').add(1, 'day').toISOString(), // lundi
          dateFin: now.endOf('week').add(1, 'day').toISOString(),
        };

      case 'month':
        return {
          dateDebut: now.startOf('month').toISOString(),
          dateFin: now.endOf('month').toISOString(),
        };

      case 'custom':
        return {
          dateDebut: dayjs(customStartDate).startOf('day').toISOString(),
          dateFin: dayjs(customEndDate).endOf('day').toISOString(),
        };

      default:
        return null;
    }
  }, [filterDateRange, customStartDate, customEndDate]);

  // Construire la requête dashboard
  const dashboardRequest: DashboardRequest | null = useMemo(() => {
    if (!soccod) return null;

    const range = getDateRangeForRequest;
    if (!range) return null;

    return {
      soccod,
      dateDebut: range.dateDebut,
      dateFin: range.dateFin,
      dateRange: filterDateRange,
      departement: filterDepartment === 'all' ? null : filterDepartment,
      empcods: [],
    };
  }, [soccod, filterDepartment, getDateRangeForRequest, filterDateRange]);


  // Hooks pour récupérer les données
  // const { data: empStat = [], isLoading: loadingStats } = useGetStatistics();
  const { data: dashboardData, isLoading: loadingDashboard, error: errorDashboard } = useGetDashboardData(dashboardRequest);
  const { data: evolutionData, isLoading: loadingEvolution } = useGetEvolution(dashboardRequest);
  const [openCongeDialog, setOpenCongeDialog] = useState(false);
  const [openPointageInvalidDialog, setOpenPointageInvalidDialog] = useState(false);

  const formattedDemandeDateDebut = useMemo(() => {
    if (!getDateRangeForRequest?.dateDebut) return '';
    return dayjs(getDateRangeForRequest.dateDebut).format('YYYY-MM-DD');
  }, [getDateRangeForRequest]);

  const formattedDemandeDateFin = useMemo(() => {
    if (!getDateRangeForRequest?.dateFin) return '';
    return dayjs(getDateRangeForRequest.dateFin).format('YYYY-MM-DD');
  }, [getDateRangeForRequest]);

  const { data: demandesData, isLoading: loadingDemandes } = useGetDemCongesByPeriode(
    formattedDemandeDateDebut,
    formattedDemandeDateFin,
    openCongeDialog
  );

  const { data: pointagesInvalidesData, isLoading: loadingPointagesInvalides, error: errorPointagesInvalides } = useGetPointagesInvalides(
    dashboardRequest,
    openPointageInvalidDialog
  );

  const kpiData: KPIData[] = useMemo(() => {
    if (!dashboardData) {
      return [
        { title: 'Effectif Présent', value: '--', icon: <GroupIcon sx={{ fontSize: 32 }} />, color: '#1976d2' },
        { title: 'Heures Travaillées', value: '--', icon: <AccessTimeIcon sx={{ fontSize: 32 }} />, color: '#f57c00' },
        { title: 'Retards/Absences', value: '--', icon: <WarningIcon sx={{ fontSize: 32 }} />, color: '#d32f2f' },
        { title: 'Demandes en Attente', value: '--', icon: <AssignmentIcon sx={{ fontSize: 32 }} />, color: '#388e3c' },
      ];
    }

    return [
      {
        title: 'Effectif Présent',
        value: dashboardData.effectifPresent,
        icon: <GroupIcon sx={{ fontSize: 32 }} />,
        evolution: dashboardData.pourcentagePresence,
        positiveIsGood: true,
        color: '#1976d2',
      },
      {
        title: 'Heures Travaillées',
        value: `${dashboardData.heuresTravaillees.toFixed(1)}h`,
        icon: <AccessTimeIcon sx={{ fontSize: 32 }} />,
        evolution: dashboardData.evolutionHeures,
        positiveIsGood: true,
        color: '#f57c00',
      },
      {
        title: 'Retards/Absences',
        value: dashboardData.nombreEmployesEnRetard + dashboardData.totalAbsences,
        icon: <WarningIcon sx={{ fontSize: 32 }} />,
        evolution: dashboardData.evolutionRetards + dashboardData.evolutionAbsences,
        positiveIsGood: false, // baisse = bon
        color: '#d32f2f',
      },
      {
        title: 'Demandes en Attente',
        value: dashboardData.totalDemandesEnAttente,
        icon: <AssignmentIcon sx={{ fontSize: 32 }} />,
        color: '#388e3c',
      },
    ];
  }, [dashboardData]);


  // const handleExportCsv = async () => {};

  // const getStatusColor = (status: string) => {
  //   switch (status) {
  //     case 'present':
  //       return { bg: '#e8f5e9', text: '#2e7d32' };
  //     case 'absent':
  //       return { bg: '#ffebee', text: '#c62828' };
  //     case 'conge':
  //       return { bg: '#fff3e0', text: '#ef6c00' };
  //     case 'retard':
  //       return { bg: '#fcf8e3', text: '#8a6d3b' };
  //     default:
  //       return { bg: '#f5f5f5', text: '#666' };
  //   }
  // };

  const isLoading = loadingDashboard;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (errorDashboard) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Erreur lors du chargement des données du dashboard</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: '#f5f7fa', minHeight: '100vh', width: '97vw' }} mt={-5}>
      {/* Page Title */}
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600, color: '#333' }}>
        Tableau de Bord - Gestion du Temps
      </Typography>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="date-range-label">Plage de dates</InputLabel>
          <Select
            labelId="date-range-label"
            value={filterDateRange}
            onChange={(e) => setFilterDateRange(e.target.value as any)}
            label="Plage de dates"
            size="small"
            sx={{ backgroundColor: 'white' }}
          >
            <MenuItem value="today">📅 Aujourd'hui</MenuItem>
            <MenuItem value="week">Cette semaine</MenuItem>
            <MenuItem value="month">Ce mois</MenuItem>
            {/* <MenuItem value="custom">Personnalisé</MenuItem> */}
          </Select>
        </FormControl>

        {/* Afficher les champs de date personnalisés si "custom" est sélectionné */}
        {filterDateRange === 'custom' && (
          <>
            <TextField
              label="Date de début"
              type="date"
              size="small"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ backgroundColor: 'white', minWidth: 180 }}
            />
            <TextField
              label="Date de fin"
              type="date"
              size="small"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ backgroundColor: 'white', minWidth: 180 }}
            />
          </>
        )}

        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel>Département</InputLabel>
          <Select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            label="Département"
            size="small"
            sx={{ backgroundColor: 'white' }}
          >
            <MenuItem value="all">Tous les départements</MenuItem>
            {directionLibsArray.map((direction: any) => (
              <MenuItem key={direction.dircod} value={direction.dircod}>
                {direction.dirlib}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {kpiData.map((kpi, index) => (
          <Grid item xs={6} sm={6} md={3} key={index}>
            <Card
              sx={{
                backgroundColor: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'all 0.3s',
                '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                },
                borderRadius: 2,
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '12px',
                      backgroundColor: `${kpi.color}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: kpi.color,
                    }}
                  >
                    {kpi.icon}
                  </Box>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: kpi.color, mb: 0.5 }}>
                  {kpi.value}
                </Typography>
                <Typography variant="body2" sx={{ color: '#666', mb: 1 }}>
                  {kpi.title}
                </Typography>
                {kpi.evolution !== undefined && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    {(() => {
                      const good =
                        kpi.positiveIsGood
                          ? kpi.evolution >= 0
                          : kpi.evolution <= 0;

                      return (
                        <>
                          {good ? (
                            <TrendingUpIcon sx={{ fontSize: 14, color: '#4caf50' }} />
                          ) : (
                            <TrendingDownIcon sx={{ fontSize: 14, color: '#f44336' }} />
                          )}
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: '0.75rem',
                              color: good ? '#4caf50' : '#f44336',
                              fontWeight: 600,
                            }}
                          >
                            {Math.abs(kpi.evolution).toFixed(1)}%
                          </Typography>
                        </>
                      );
                    })()}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Alerts Section */}
      {dashboardData && (dashboardData.pointagesIncomplets > 0 || dashboardData.nombreEmployesEnRetard > 0 || dashboardData.totalDemandesEnAttente > 0) && (
        <Card sx={{ mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon sx={{ color: '#ff9800' }} /> Alertes et Notifications
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {dashboardData.pointagesIncomplets > 0 && (
                <Alert
                  severity="error"
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setOpenPointageInvalidDialog(true)}
                >
                  <strong>Pointage manquant:</strong> {dashboardData.pointagesIncomplets} pointage(s) non compléte(s). Cliquez pour voir la liste.
                </Alert>
              )}
              {dashboardData.nombreEmployesEnRetard > 0 && (
                <Alert severity="warning">
                  <strong>Retards:</strong> {dashboardData.nombreEmployesEnRetard} employés en retard
                </Alert>
              )}
              {dashboardData.totalDemandesEnAttente > 0 && (
                <Alert severity="info" sx={{ cursor: 'pointer' }} onClick={() => setOpenCongeDialog(true)}>
                  <strong>Validation requise:</strong> {dashboardData.totalDemandesEnAttente} demande(s) en attente de validation
                </Alert>
              )}
            </Box>
          </CardContent>
        </Card>
      )}
      <EvolutionChart
        data={Array.isArray(evolutionData) ? evolutionData : []}
        isLoading={loadingEvolution}
      />
      <Dialog open={openCongeDialog} onClose={() => setOpenCongeDialog(false)} maxWidth="lg"
        sx={{
          '& .MuiDialog-container': {
            alignItems: 'center',
          },
          '& .MuiDialog-paper': {
            margin: { xs: 0, sm: '32px' },
            width: { xs: '80%', sm: 'auto' },
            maxWidth: { xs: '90%', sm: '500px' },
          },
        }}>
        <DialogTitle>Liste des Demandes de Congé</DialogTitle>
        <DialogContent>
          <CongeProvider>
            <DashboardCongeList data={demandesData || []} isLoading={loadingDemandes} />
          </CongeProvider>
        </DialogContent>
      </Dialog>

      <Dialog open={openPointageInvalidDialog}
        onClose={() => setOpenPointageInvalidDialog(false)} maxWidth="lg"
        sx={{
          '& .MuiDialog-container': {
            alignItems: 'center',
          },
          '& .MuiDialog-paper': {
            margin: { xs: 0, sm: '32px' },
            width: { xs: '80%', sm: 'auto' },
            maxWidth: { xs: '90%', sm: '500px' },
          },
        }}>
        <DialogTitle>Pointages non complètes</DialogTitle>
        <DialogContent sx={{ minHeight: 250 }}>
          {loadingPointagesInvalides ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : errorPointagesInvalides ? (
            <Alert severity="error">Erreur lors de la récupération des pointages incomplets.</Alert>
          ) : !pointagesInvalidesData || pointagesInvalidesData.length === 0 ? (
            <Alert severity="info">Aucun pointage non complet trouvé pour cette période.</Alert>
          ) : (
            <TableContainer component={Paper} sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Matricule</TableCell>
                    <TableCell>Nom</TableCell>
                    <TableCell>Département</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>{t('i18nFix.common.arrival')}</TableCell>
                    <TableCell>{t('i18nFix.common.departure')}</TableCell>
                    <TableCell>Commentaire</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pointagesInvalidesData.map((row, index) => (
                    <TableRow
                      key={index}
                      sx={{
                        backgroundColor:
                          row.entreeManquante
                            ? '#fff3e0'
                            : row.incoherenceHoraire || row.midiIncoherent
                              ? '#fff8e1'
                              : '#ffebee',
                      }}
                    >
                      <TableCell>{row.empcod || '-'}</TableCell>
                      <TableCell>{row.emplib || '-'}</TableCell>
                      <TableCell>{row.departement || '-'}</TableCell>
                      <TableCell>
                        {row.predat ? dayjs(row.predat).format('DD/MM/YYYY') : '-'}
                      </TableCell>
                      <TableCell>{row.preentmatup || '-'}</TableCell>
                      <TableCell>
                        {row.presortamidiup || row.presortmatup || '-'}
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="caption"
                          sx={{
                            color: '#d32f2f',
                            fontWeight: 500,
                            whiteSpace: 'pre-line',
                          }}
                        >
                          {row.motif || '-'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button variant="outlined" onClick={() => setOpenPointageInvalidDialog(false)}>
              Fermer
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}