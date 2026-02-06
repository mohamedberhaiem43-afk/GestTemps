import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Select,
  MenuItem,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
} from '@mui/material';
import BasicBars from './Bars/Bars';
import BasicPie from '../BasicPie/BasicPie';
import DemCongeList from '../gestionEmploye/gestionConge/DemConge/DemCongeList';
import { Item } from '../helper/Item/Item';
import useGetStatistics from '../../hooks/employeHooks/useGetStatistics';
import { DashboardRequest, EmployeStatut } from '../../models/DashboardModels';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import GroupIcon from '@mui/icons-material/Group';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningIcon from '@mui/icons-material/Warning';
import AssignmentIcon from '@mui/icons-material/Assignment';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SearchIcon from '@mui/icons-material/Search';
import useGetEmployesStatut from '../../hooks/dashboardHooks/useGetEmployesStatut';
import useGetDashboardData from '../../hooks/dashboardHooks/useGetDashboardData';
import dayjs from 'dayjs';
import { useAuth } from '../helper/AuthProvider';
import formatDateForApi from '../helper/formatDate';
import { formatCellDate } from '../helper/formatCellDate';

interface formattedData {
  label: string;
  value: number;
}

interface KPIData {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendPositive?: boolean;
  color: string;
}



export default function DashboardPage() {
  const [sexStat, setSexStat] = useState<formattedData[]>([]);
  const [filterDateRange, setFilterDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Récupérer le code société depuis le contexte ou le localStorage
  const { soccod } = useAuth();
    const now = new Date();
    const isoDate = now.toISOString().split('T')[0]; // "2026-02-06"
  // Construire la requête dashboard
  const dashboardRequest: DashboardRequest | null = useMemo(() => {
    // n'appeler l'API que si un département réel est choisi (pas "all")
    if (!soccod || filterDepartment === 'all') return null;

    return {
      soccod,
      date: `${isoDate}T00:00:00`, // "2026-02-06T00:00:00"
      departement: "010",
      empcods: [],
    };
  }, [soccod, filterDepartment]);

  // Hooks pour récupérer les données
  const { data: empStat = [], isLoading: loadingStats } = useGetStatistics();
  const { data: dashboardData, isLoading: loadingDashboard, error: errorDashboard } = useGetDashboardData(dashboardRequest);
  // const { data: employesData = [], isLoading: loadingEmployes } = useGetEmployesStatut(dashboardRequest);


  // Filtre employés par terme de recherche
  // const filteredEmployes = useMemo(() => {
  //   return employesData.filter(
  //     (emp:any) =>
  //       emp.emplib.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //       emp.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //       emp.empcod.includes(searchTerm)
  //   );
  // }, [employesData, searchTerm]);

  // Compute sex statistics
  useEffect(() => {
    if (empStat && empStat.length > 0) {
      const sexeCounts: Record<string, number> = { M: 0, F: 0 };
      empStat.forEach((item: any) => {
        if (item.sexe) {
          sexeCounts[item.sexe] = item.count || 0;
        }
      });

      const formatted = Object.entries(sexeCounts).map(([label, value]) => ({
        label: label === 'F' ? 'Féminin' : label === 'M' ? 'Masculin' : 'Inconnu',
        value,
      }));

      setSexStat(formatted);
    }
  }, [empStat]);

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
        trend: `${dashboardData.pourcentagePresence.toFixed(1)}% du total`,
        trendPositive: true,
        color: '#1976d2',
      },
      {
        title: 'Heures Travaillées',
        value: `${dashboardData.heuresTravaillees.toFixed(1)}h`,
        icon: <AccessTimeIcon sx={{ fontSize: 32 }} />,
        trend: 'Total du jour',
        trendPositive: true,
        color: '#f57c00',
      },
      {
        title: 'Retards/Absences',
        value: dashboardData.nombreRetards + dashboardData.totalAbsences,
        icon: <WarningIcon sx={{ fontSize: 32 }} />,
        trend: `${dashboardData.nombreRetards} retards, ${dashboardData.totalAbsences} absences`,
        trendPositive: false,
        color: '#d32f2f',
      },
      {
        title: 'Demandes en Attente',
        value: dashboardData.totalDemandesEnAttente,
        icon: <AssignmentIcon sx={{ fontSize: 32 }} />,
        trend: 'À valider',
        trendPositive: true,
        color: '#388e3c',
      },
    ];
  }, [dashboardData]);

  const handleExportCsv = async () => {};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return { bg: '#e8f5e9', text: '#2e7d32' };
      case 'absent':
        return { bg: '#ffebee', text: '#c62828' };
      case 'conge':
        return { bg: '#fff3e0', text: '#ef6c00' };
      case 'retard':
        return { bg: '#fcf8e3', text: '#8a6d3b' };
      default:
        return { bg: '#f5f5f5', text: '#666' };
    }
  };

  const isLoading = loadingStats || loadingDashboard;

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
      <Box sx={{ p: 3, backgroundColor: '#f5f7fa', minHeight: '100vh', width:'97vw' }} mt={-15}>
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
              <MenuItem value="custom">Personnalisé</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel id="dept-label">Département</InputLabel>
            <Select
              labelId="dept-label"
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              label="Département"
              size="small"
              sx={{ backgroundColor: 'white' }}
            >
              <MenuItem value="all">🏢 Tous les départements</MenuItem>
              <MenuItem value="production">Production</MenuItem>
              <MenuItem value="administration">Administration</MenuItem>
              <MenuItem value="logistique">Logistique</MenuItem>
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
                  {kpi.trend && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.85rem' }}>
                      {kpi.trendPositive ? (
                        <TrendingUpIcon sx={{ fontSize: 16, color: '#4caf50' }} />
                      ) : (
                        <TrendingDownIcon sx={{ fontSize: 16, color: '#f44336' }} />
                      )}
                      <Typography
                        variant="caption"
                        sx={{
                          color: kpi.trendPositive ? '#4caf50' : '#f44336',
                          fontWeight: 500,
                        }}
                      >
                        {kpi.trend}
                      </Typography>
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

        {/* Charts Row */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={8}>
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
          </Grid>

          <Grid item xs={12} md={4}>
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
          </Grid>
        </Grid>

        {/* Attendance Table */}
        <Card sx={{ mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2 }}>
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
                {/* <TableBody>
                  {filteredEmployes.length > 0 ? (
                    filteredEmployes.map((emp: EmployeStatut) => {
                      const statusColor = getStatusColor(emp.statut);
                      const statusLabels: { [key: string]: string } = {
                        present: 'Présent',
                        absent: 'Absent',
                        conge: 'Congé',
                        retard: 'Retard',
                      };

                      return (
                        <TableRow key={emp.empcod} sx={{ '&:hover': { backgroundColor: '#f5f5f5' } }}>
                          <TableCell>{emp.empcod}</TableCell>
                          <TableCell>{emp.emplib} {emp.prenom}</TableCell>
                          <TableCell>{emp.departement}</TableCell>
                          <TableCell align="center">{emp.heureArrivee || '--:--'}</TableCell>
                          <TableCell align="center">{emp.heureDepart || '--:--'}</TableCell>
                          <TableCell align="center">
                            {emp.heuresTravaillees ? `${emp.heuresTravaillees.toFixed(2)}h` : '0h'}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={statusLabels[emp.statut] || emp.statut}
                              sx={{
                                backgroundColor: statusColor.bg,
                                color: statusColor.text,
                                fontWeight: 600,
                                fontSize: '0.85rem',
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                        <Typography sx={{ color: '#999' }}>Aucun employé trouvé</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody> */}
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Additional Data Sections */}
        <Grid container spacing={2}>
          {/* <Grid item xs={12} md={6}>
            <EcheanceContratList />
          </Grid> */}
          {/* <Grid item xs={12} md={6}>
            <DemCongeList />
          </Grid> */}
          {/* <Grid item xs={12}>
            <DepassMaxTable />
          </Grid> */}
        </Grid>
      </Box>
  );
}
