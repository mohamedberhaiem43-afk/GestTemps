// DailyHoursTable.tsx
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
// Add to your models
export interface DailyHours {
  jour: string;
  date: string;
  heuresTravaillees: number;
  // Add other fields you need
}
interface DailyHoursTableProps {
  dailyHours: DailyHours[];
}

const DailyHoursTable = ({ dailyHours }: DailyHoursTableProps) => {
  if (!dailyHours || dailyHours.length === 0) {
    return <div>No daily hours data available</div>;
  }

  return (
    <TableContainer component={Paper} sx={{ mt: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Jour</TableCell>
            <TableCell>Date</TableCell>
            <TableCell>Heures Travaillées</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {dailyHours.map((day, index) => (
            <TableRow key={index}>
              <TableCell>{day.jour}</TableCell>
              <TableCell>{day.date}</TableCell>
              <TableCell>{day.heuresTravaillees.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default DailyHoursTable;