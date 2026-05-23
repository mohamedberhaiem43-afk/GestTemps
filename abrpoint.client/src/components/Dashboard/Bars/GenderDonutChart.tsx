import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Box, Typography, Stack } from '@mui/material';
import WcIcon from '@mui/icons-material/Wc';

interface GenderCounts {
  M?: number;
  F?: number;
  Autre?: number;
}

interface GenderDonutChartProps {
  data?: GenderCounts;
}

const COLORS = {
  M: '#0040a1',
  F: '#d946ef',
  Autre: '#94a3b8',
};

const LABELS: Record<keyof GenderCounts, string> = {
  M: 'Hommes',
  F: 'Femmes',
  Autre: 'Autre',
};

export default function GenderDonutChart({ data }: GenderDonutChartProps) {
  const m = data?.M ?? 0;
  const f = data?.F ?? 0;
  const autre = data?.Autre ?? 0;
  const total = m + f + autre;

  // On garde les segments à 0 hors du donut (sinon recharts les affiche en
  // tooltip vide). On préserve l'ordre M → F → Autre pour la légende.
  const chartData = [
    { name: LABELS.M, value: m, key: 'M' as const },
    { name: LABELS.F, value: f, key: 'F' as const },
    { name: LABELS.Autre, value: autre, key: 'Autre' as const },
  ].filter((d) => d.value > 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: '10px',
          background: 'rgba(124,58,237,0.12)', color: '#7c3aed',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <WcIcon sx={{ fontSize: 20 }} />
        </Box>
        <Box>
          <Typography className="db-chart-title">Effectif par sexe</Typography>
          <Typography variant="caption" color="text.secondary">
            {total > 0 ? `${total} salarié(s) actif(s)` : 'Aucune donnée disponible'}
          </Typography>
        </Box>
      </Stack>

      {total === 0 ? (
        <Box sx={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#94a3b8', fontSize: 13,
        }}>
          Renseignez le champ « Sexe » sur les fiches employés pour activer ce graphique.
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 240, position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={chartData.length > 1 ? 2 : 0}
                stroke="#ffffff"
                strokeWidth={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={COLORS[entry.key]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => {
                  const n = typeof value === 'number' ? value : Number(value ?? 0);
                  const pct = total > 0 ? ((n / total) * 100).toFixed(1) : '0';
                  return [`${n} (${pct}%)`, name as string];
                }}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Total affiché au centre du donut. */}
          <Box sx={{
            position: 'absolute', top: '42%', left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center', pointerEvents: 'none',
          }}>
            <Typography sx={{ fontSize: 28, fontWeight: 800, color: '#0d1f3c', lineHeight: 1 }}>
              {total}
            </Typography>
            <Typography sx={{ fontSize: 11, color: '#64748b', mt: 0.5 }}>
              total
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}
