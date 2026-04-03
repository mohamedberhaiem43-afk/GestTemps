import { PieChart } from '@mui/x-charts/PieChart';

export default function BasicPie({ data }: { data?: { label: string; value: number }[] }) {
  // Default to an empty array if data is null or undefined
  const pieData = data || [];

  return (
    <PieChart
      series={[
        {
          data: pieData,
        },
      ]}
      width={400}
      height={200}
    />
  );
}
