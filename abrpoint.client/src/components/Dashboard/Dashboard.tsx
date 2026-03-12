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
} from '@mui/material';
import { DashboardRequest } from '../../models/DashboardModels';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import GroupIcon from '@mui/icons-material/Group';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningIcon from '@mui/icons-material/Warning';
import AssignmentIcon from '@mui/icons-material/Assignment';
import useGetDashboardData from '../../hooks/dashboardHooks/useGetDashboardData';
import dayjs from 'dayjs';
import { useAuth } from '../helper/AuthProvider';
import useGetDirectionLibs from '../../hooks/directionHooks/useGetDirectionLibs';
import useGetEvolution from '../../hooks/dashboardHooks/useGetEvolution';
import EvolutionChart from './Bars/EvolutionChart';

// interface formattedData {
//   label: string;
//   value: number;
// }

interface KPIData {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  evolution?: number;
  positiveIsGood?: boolean;
  color: string;
}


export default function DashboardPage() {
  // const [sexStat, setSexStat] = useState<formattedData[]>([]);
  const [filterDateRange, setFilterDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  // const [searchTerm, setSearchTerm] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

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
  // Compute sex statistics
  // useEffect(() => {
  //   if (empStat && empStat.length > 0) {
  //     const sexeCounts: Record<string, number> = { M: 0, F: 0 };
  //     empStat.forEach((item: any) => {
  //       if (item.sexe) {
  //         sexeCounts[item.sexe] = item.count || 0;
  //       }
  //     });

  //     const formatted = Object.entries(sexeCounts).map(([label, value]) => ({
  //       label: label === 'F' ? 'Féminin' : label === 'M' ? 'Masculin' : 'Inconnu',
  //       value,
  //     }));

  //     setSexStat(formatted);
  //   }
  // }, [empStat]);

  // Construire les KPI données dynamiquement
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
      value: dashboardData.nombreRetards + dashboardData.totalAbsences,
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
    <Box sx={{ p: 3, backgroundColor: '#f5f7fa', minHeight: '100vh', width:'97vw' }} mt={-5}>
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
            {directionLibsArray.map((direction:any) => (
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
      {dashboardData && (dashboardData.pointagesIncomplets > 0 || dashboardData.nombreRetards > 0 || dashboardData.totalDemandesEnAttente > 0) && (
        <Card sx={{ mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon sx={{ color: '#ff9800' }} /> Alertes et Notifications
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {dashboardData.pointagesIncomplets > 0 && (
                <Alert severity="error">
                  <strong>Pointage manquant:</strong> {dashboardData.pointagesIncomplets} employés n'ont pas complété leur pointage
                </Alert>
              )}
              {dashboardData.nombreRetards > 0 && (
                <Alert severity="warning">
                  <strong>Retards:</strong> {dashboardData.nombreRetards} employés en retard
                </Alert>
              )}
              {dashboardData.totalDemandesEnAttente > 0 && (
                <Alert severity="info">
                  <strong>Validation requise:</strong> {dashboardData.totalDemandesEnAttente} demandes en attente de validation
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
      {/* Charts Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* <Grid item xs={12} md={8}>
          <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                📊 Évolution des Heures par Catégorie
              </Typography>
              <Box sx={{ height: 300 }}>
                <Item>
                  <BasicBars
                    cadrhor={empStat['2']?.horaire ?? 0}
                    cadrmen={empStat['2']?.mensuelle ?? 0}
                    maihor={empStat['1']?.horaire ?? 0}
                    maimen={empStat['1']?.mensuelle ?? 0}
                    exhor={empStat['0']?.horaire ?? 0}
                    exmen={empStat['0']?.mensuelle ?? 0}
                  />
                </Item>
              </Box>
            </CardContent>
          </Card>
        </Grid> */}

        {/* <Grid item xs={12} md={4}>
          <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                👥 Répartition par Sexe
              </Typography>
              <Box sx={{ height: 300 }}>
                <Item>
                  <BasicPie data={sexStat} />
                </Item>
              </Box>
            </CardContent>
          </Card>
        </Grid> */}
      </Grid>
      {/* Attendance Table */}
      {/* <Card sx={{ mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              📋 Pointages en Temps Réel
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                placeholder="🔍 Rechercher un employé..."
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ width: 250, backgroundColor: 'white' }}
                InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: '#666' }} /> }}
              />
              <Button
                variant="contained"
                sx={{
                  backgroundColor: '#d32f2f',
                  '&:hover': { backgroundColor: '#b71c1c' },
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                }}
                startIcon={<FileDownloadIcon />}
                onClick={handleExportCsv}
              >
                Exporter
              </Button>
            </Box>
          </Box>

          <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f7fa' }}>
                  <TableCell sx={{ fontWeight: 600, color: '#666', fontSize: '0.9rem' }}>Matricule</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#666', fontSize: '0.9rem' }}>Nom et Prénom</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#666', fontSize: '0.9rem' }}>Département</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, color: '#666', fontSize: '0.9rem' }}>Heure Arrivée</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, color: '#666', fontSize: '0.9rem' }}>Heure Départ</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, color: '#666', fontSize: '0.9rem' }}>Heures Travaillées</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, color: '#666', fontSize: '0.9rem' }}>Statut</TableCell>
                </TableRow>
              </TableHead>
            </Table>
          </TableContainer>
        </CardContent>
      </Card> */}


      {/* Additional Data Sections */}
      {/* <Grid container spacing={2}>
      </Grid> */}
    </Box>
  );
}