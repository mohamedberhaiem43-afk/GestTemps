// EvolutionChart.tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { Card, CardContent, Typography, Box, Alert, CircularProgress } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

interface EvolutionChartProps {
  data: any[];
  isLoading?: boolean;
}

const EvolutionChart = ({ data, isLoading }: EvolutionChartProps) => {
  
  // Formater les données pour le graphique
  const formattedData = (data && Array.isArray(data))
    ? data.map((item) => {
        try {
          const dateObj = new Date(item.date);
          return {
            date: dateObj.toLocaleDateString('fr-FR', {
              weekday: 'short',
              day: '2-digit',
              month: 'short',
            }),
            'Effectif Présent': item.effectifPresent || 0,
            'Heures Travaillées': item.heuresTravaillees || 0,
            // Le backend renvoie déjà un pourcentage (0–100), pas un ratio (0–1).
            // Ne pas re-multiplier par 100 sinon on affiche 6000% pour 60%.
            'Taux Présence (%)': (item.tauxPresence || 0).toFixed(1),
            jourSemaine: item.jourSemaine || '',
          };
        } catch (e) {
          console.error('Error formatting data item:', item, e);
          return null;
        }
      })
      .filter((item) => item !== null)
    : [];


  // Tooltip personnalisé
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            backgroundColor: 'white',
            p: 2,
            border: '1px solid #e0e0e0',
            borderRadius: 1,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            {label}
          </Typography>
          {payload.map((entry: any, index: number) => (
            <Typography
              key={index}
              variant="body2"
              sx={{ color: entry.color, fontSize: '0.85rem' }}
            >
              {entry.name}: <strong>{entry.value}{entry.name.includes('%') ? '%' : ''}</strong>
            </Typography>
          ))}
        </Box>
      );
    }
    return null;
  };

  return (
    <Card sx={{ mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2 }}>
      <CardContent>
        <Typography
          variant="h6"
          sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <TrendingUpIcon sx={{ color: '#1976d2' }} />
          📈 Évolution des Présences et Heures Travaillées
        </Typography>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2, color: '#666' }}>
              Chargement des données...
            </Typography>
          </Box>
        ) : !data || data.length === 0 ? (
          <Alert severity="info">
            Aucune donnée d'évolution disponible pour cette période
          </Alert>
        ) : (
          <>
            <Box sx={{ width: '100%', height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={formattedData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 80,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }}
                    iconType="rect"
                  />
                  <Bar
                    dataKey="Effectif Présent"
                    fill="#2e7d32"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={60}
                  />
                  <Bar
                    dataKey="Heures Travaillées"
                    fill="#1976d2"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>

            {/* Graphique du taux de présence */}
            <Box sx={{ width: '100%', height: 300, mt: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: '#666' }}>
                📊 Taux de Présence
              </Typography>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={formattedData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 60,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="line" />
                  <Line
                    type="monotone"
                    dataKey="Taux Présence (%)"
                    stroke="#f57c00"
                    strokeWidth={3}
                    dot={{ fill: '#f57c00', r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>

            {/* Statistiques résumées */}
            <Box
              sx={{
                mt: 3,
                p: 2,
                backgroundColor: '#f5f7fa',
                borderRadius: 2,
                display: 'flex',
                justifyContent: 'space-around',
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: '#666', mb: 0.5 }}>
                  Moyenne Effectif Présent
                </Typography>
                <Typography variant="h6" sx={{ color: '#2e7d32', fontWeight: 600 }}>
                  {data && data.length > 0
                    ? (
                        data.reduce((sum, item) => sum + (item.effectifPresent || 0), 0) /
                        data.length
                      ).toFixed(1)
                    : '0'}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: '#666', mb: 0.5 }}>
                  Total Heures Travaillées
                </Typography>
                <Typography variant="h6" sx={{ color: '#1976d2', fontWeight: 600 }}>
                  {data && data.length > 0
                    ? data.reduce((sum, item) => sum + (item.heuresTravaillees || 0), 0).toFixed(1)
                    : '0'}
                  h
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: '#666', mb: 0.5 }}>
                  Moyenne Heures/Jour
                </Typography>
                <Typography variant="h6" sx={{ color: '#1976d2', fontWeight: 600 }}>
                  {data && data.length > 0
                    ? (
                        data.reduce((sum, item) => sum + (item.heuresTravaillees || 0), 0) /
                        data.length
                      ).toFixed(1)
                    : '0'}
                  h
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: '#666', mb: 0.5 }}>
                  Taux Présence Moyen
                </Typography>
                <Typography variant="h6" sx={{ color: '#f57c00', fontWeight: 600 }}>
                  {data && data.length > 0
                    ? (
                        data.reduce((sum, item) => sum + (item.tauxPresence || 0), 0) /
                          data.length
                      ).toFixed(1)
                    : '0'}
                  %
                </Typography>
              </Box>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default EvolutionChart;