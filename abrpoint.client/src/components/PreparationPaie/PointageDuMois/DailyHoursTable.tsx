// DailyHoursTable.tsx
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { t } from 'i18next';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    return <div>{t('dailyHours.noData')}</div>;
  }

  return (
    <TableContainer component={Paper} sx={{ mt: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('dailyHours.day')}</TableCell>
            <TableCell>{t('dailyHours.date')}</TableCell>
            <TableCell>{t('dailyHours.hoursWorked')}</TableCell>
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