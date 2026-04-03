import { BarChart } from '@mui/x-charts/BarChart';

const xLabels = [
  'Cadre',
  'Maîtrise',
  'Exécutant',
];

const tLabels = [
  'Effectif Total',
];
interface StackedBarChartProps {
  cadrhor: number;
  cadrmen: number;
  maihor: number;
  maimen: number;
  exhor: number;
  exmen: number;
}
export default function StackedBarChart({ cadrhor, cadrmen,maihor, maimen, exhor,exmen, }: StackedBarChartProps) {
    const totmens = cadrmen + exmen + maimen; // Total for 'Mensuelle'
    const tothor = cadrhor + maihor + exhor; // Total for 'Horaire'
    
    const uData = [cadrhor, maihor, exhor]; // Hourly Data
    const pData = [cadrmen, maimen, exmen]; // Monthly Data

  return (
    <>
      <BarChart
        width={300}
        height={300}
        series={[
          { data: pData, label: 'Mensuelle', id: 'mensuelle', stack: 'total' },
          { data: uData, label: 'Horaire', id: 'horaire', stack: 'total' },

        ]}
        xAxis={[{ data: xLabels, scaleType: 'band' }]}
      />

      <BarChart
        width={170}
        height={300}
        series={[
          { data: [totmens], label: 'Mensuelle', id: 'tmensuelle', stack: 'total' },
          { data: [tothor], label: 'Horaire', id: 'thoraire', stack: 'total' },
        ]}
        xAxis={[{ data: tLabels, scaleType: 'band' }]}
      />
    </>
  );
}
