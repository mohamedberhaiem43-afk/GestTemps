/**
 * Exemples d'utilisation des hooks et services Dashboard
 * Ces exemples montrent comment intégrer les données du dashboard dans d'autres composants
 */

// ============================================
// EXEMPLE 1: Hook simple pour afficher les KPI
// ============================================
import { Box, Typography, CircularProgress } from '@mui/material';

function SimpleKPIDisplay() {
  const { data, isLoading, error } = useGetDashboardData({
    soccod: localStorage.getItem('soccod') || '',
    date: new Date(),
    departement: null,
  });

  if (isLoading) return <CircularProgress />;
  if (error) return <Typography color="error">Erreur de chargement</Typography>;

  return (
    <Box>
      <Typography variant="h6">
        Effectif présent: {data?.effectifPresent} / {data?.effectifTotal}
      </Typography>
      <Typography>
        Taux de présence: {data?.pourcentagePresence.toFixed(1)}%
      </Typography>
      <Typography>
        Heures travaillées: {data?.heuresTravaillees.toFixed(2)}h
      </Typography>
    </Box>
  );
}

// ============================================
// EXEMPLE 2: Statistiques par département
// ============================================
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

function DepartementStatistics() {
  const { data: kpis = [], isLoading } = useGetKpisDepartements({
    soccod: localStorage.getItem('soccod') || '',
    date: new Date(),
  });

  if (isLoading) return <CircularProgress />;

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Département</TableCell>
            <TableCell align="right">Total</TableCell>
            <TableCell align="right">Présents</TableCell>
            <TableCell align="right">Taux</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {kpis.map((kpi:any) => (
            <TableRow key={kpi.departement}>
              <TableCell>{kpi.departement}</TableCell>
              <TableCell align="right">{kpi.effectifTotal}</TableCell>
              <TableCell align="right">{kpi.effectifPresent}</TableCell>
              <TableCell align="right">{(kpi.tauxPresence * 100).toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ============================================
// EXEMPLE 3: Liste des employés avec recherche avancée
// ============================================
import { useState, useMemo } from 'react';
import { TextField, List, ListItem, ListItemText } from '@mui/material';

function EmployeeList() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: employes = [] } = useGetEmployesStatut({
    soccod: localStorage.getItem('soccod') || '',
    date: new Date(),
  });

  const filtered = useMemo(
    () =>
      employes.filter(
        (emp) =>
          emp.emplib.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.prenom.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [employes, searchTerm]
  );

  return (
    <Box>
      <TextField
        label="Rechercher un employé"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        fullWidth
        margin="normal"
      />
      <List>
        {filtered.map((emp) => (
          <ListItem key={emp.empcod}>
            <ListItemText
              primary={`${emp.emplib} ${emp.prenom}`}
              secondary={`${emp.departement} - Statut: ${emp.statut}`}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

// ============================================
// EXEMPLE 4: Évolution des heures sur 30 jours
// ============================================

function EvolutionChart() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data: evolution = [], isLoading } = useGetEvolution({
    soccod: localStorage.getItem('soccod') || '',
    dateDebut: thirtyDaysAgo,
    dateFin: today,
  });

  if (isLoading) return <CircularProgress />;

  return (
    <Box>
      <Typography variant="h6">Évolution des 30 derniers jours</Typography>
      <pre>{JSON.stringify(evolution, null, 2)}</pre>
    </Box>
  );
}

// ============================================
// EXEMPLE 5: Résumé du jour - Mini dashboard
// ============================================

function TodaySummary() {
  const soccod = localStorage.getItem('soccod') || '';
  const { data: resume, isLoading } = useGetResumeDuJour(soccod);

  if (isLoading) return <CircularProgress />;
  if (!resume) return <Typography>Pas de données</Typography>;

  return (
    <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderRadius: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Résumé du jour - {new Date(resume.date).toLocaleDateString('fr-FR')}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        <Box>
          <Typography variant="body2" color="textSecondary">
            Effectif
          </Typography>
          <Typography variant="h6">
            {resume.effectifPresent} / {resume.effectifTotal}
          </Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="textSecondary">
            Taux présence
          </Typography>
          <Typography variant="h6">{(resume.tauxPresence * 100).toFixed(1)}%</Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="textSecondary">
            Heures travaillées
          </Typography>
          <Typography variant="h6">{resume.heuresTravaillees.toFixed(2)}h</Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="textSecondary">
            Retards/Absences
          </Typography>
          <Typography variant="h6">
            {resume.retards} / {resume.absences}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ============================================
// EXEMPLE 6: Export CSV avec barre de progression
// ============================================

import { Button, Alert } from '@mui/material';

function ExportDashboard() {
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState('');
  const dashboardService = require('../../services/DashboardService').dashboardService;
  const handleExport = async () => {
    try {
      setIsExporting(true);
      setMessage('Préparation de l\'export...');

      const blob = await dashboardService.exportToCsv({
        soccod: localStorage.getItem('soccod') || '',
        date: new Date(),
      });

      setMessage('Téléchargement du fichier...');
      const fileName = `pointages_${new Date().toISOString().split('T')[0]}.csv`;
      dashboardService.downloadCsv(blob, fileName);

      setMessage('Export réussi! 🎉');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`Erreur lors de l'export: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Box>
      <Button
        variant="contained"
        onClick={handleExport}
        disabled={isExporting}
        sx={{ mb: 2 }}
      >
        {isExporting ? 'Export en cours...' : 'Exporter en CSV'}
      </Button>
      {message && <Alert severity="info">{message}</Alert>}
    </Box>
  );
}

// ============================================
// EXEMPLE 7: Rafraîchissement manuel des données
// ============================================
import { useQueryClient } from 'react-query';

function DashboardWithRefresh() {
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    // Invalide toutes les requêtes dashboard
    queryClient.invalidateQueries('dashboardData');
    queryClient.invalidateQueries('employesStatut');
    queryClient.invalidateQueries('dashboardEvolution');
  };

  return (
    <Box>
      <Button variant="outlined" onClick={handleRefresh}>
        🔄 Rafraîchir les données
      </Button>
    </Box>
  );
}

// ============================================
// EXEMPLE 8: Composant conditionnel basé sur les alertes
// ============================================
import { Chip } from '@mui/material';
import { useGetDashboardData, useGetEmployesStatut, useGetEvolution, useGetKpisDepartements, useGetResumeDuJour } from '../../hooks/dashboardHooks';

function AlertIndicator() {
  const { data: dashboard } = useGetDashboardData({
    soccod: localStorage.getItem('soccod') || '',
    date: new Date(),
  });

  const hasAlerts =
    (dashboard?.pointagesIncomplets || 0) > 0 ||
    (dashboard?.nombreRetards || 0) > 0 ||
    (dashboard?.totalDemandesEnAttente || 0) > 0;

  if (!hasAlerts) return null;

  return (
    <Chip
      label={`${
        (dashboard?.pointagesIncomplets || 0) +
        (dashboard?.nombreRetards || 0) +
        (dashboard?.totalDemandesEnAttente || 0)
      } alertes`}
      color="error"
      variant="outlined"
    />
  );
}

// ============================================
// EXEMPLE 9: Hook personnalisé combinant plusieurs sources
// ============================================

function useDashboardSummary(soccod: string, departement?: string) {
  const { data: dashboard, ...dashboardQuery } = useGetDashboardData(
    {
      soccod,
      departement,
    },
    !!soccod
  );

  const { data: employes, ...employesQuery } = useGetEmployesStatut(
    {
      soccod,
      departement,
    },
    !!soccod
  );

  return {
    dashboard,
    employes,
    isLoading: dashboardQuery.isLoading || employesQuery.isLoading,
    error: dashboardQuery.error || employesQuery.error,
  };
}

function MyDashboard() {
  const summary = useDashboardSummary(localStorage.getItem('soccod') || '');

  if (summary.isLoading) return <CircularProgress />;

  return <Box>{/* Votre contenu ici */}</Box>;
}

export {
  SimpleKPIDisplay,
  DepartementStatistics,
  EmployeeList,
  EvolutionChart,
  TodaySummary,
  ExportDashboard,
  DashboardWithRefresh,
  AlertIndicator,
  useDashboardSummary,
  MyDashboard,
};
