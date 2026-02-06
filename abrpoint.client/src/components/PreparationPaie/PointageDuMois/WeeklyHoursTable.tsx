import { Box, Paper, Grid, Typography, TextField } from "@mui/material";
import { useTranslation } from 'react-i18next';

interface WeeklyHoursTableProps {
  weekRanges: { start: string; end: string }[];
  weeklyHours: (number | undefined)[];
}

const WeeklyHoursTable: React.FC<WeeklyHoursTableProps> = ({
  weekRanges,
  weeklyHours,
}) => {
  const NUM_WEEKS = 6;
  const paddedWeekRanges = [...weekRanges];
  const paddedWeeklyHours = [...weeklyHours];

  while (paddedWeekRanges.length < NUM_WEEKS) {
    paddedWeekRanges.push({ start: '', end: '' });
    paddedWeeklyHours.push(undefined);
  }

  // Format date to dd/MM/yyyy
  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '';
    }
  };

  // Format hours to 2 decimal places
  const formatHours = (hours: number | undefined): string => {
    if (hours === undefined || hours === null) return '';
    return hours.toFixed(2);
  };

  const { t } = useTranslation();

  return (
    <Box mt={4}>
      <Paper elevation={1} sx={{ p: 2 }}>
        <Grid container spacing={1}>
          <Grid item xs={2}></Grid>
          {paddedWeekRanges.map((_, i) => (
            <Grid item xs={1.6} key={i}>
              <Typography variant="subtitle2" align="center" fontWeight="bold" color="#1976d2">
                Semaine {i + 1}
              </Typography>
            </Grid>
          ))}

          <Grid item xs={2}>
            <Typography fontWeight="bold" color="#1976d2">{t('weeklyHoursTable.dateStart')}</Typography>
          </Grid>
          {paddedWeekRanges.map((week, i) => (
            <Grid item xs={1.6} key={i}>
              <TextField 
                variant='standard' 
                fullWidth 
                size="small" 
                value={formatDate(week.start)} 
                InputProps={{ readOnly: true }} 
              />
            </Grid>
          ))}

          <Grid item xs={2}>
            <Typography fontWeight="bold" color="#1976d2">{t('weeklyHoursTable.dateEnd')}</Typography>
          </Grid>
          {paddedWeekRanges.map((week, i) => (
            <Grid item xs={1.6} key={i}>
              <TextField 
                variant='standard' 
                fullWidth 
                size="small" 
                value={formatDate(week.end)} 
                InputProps={{ readOnly: true }} 
              />
            </Grid>
          ))}

          <Grid item xs={2}>
            <Typography fontWeight="bold" color="#1976d2">{t('weeklyHoursTable.hours')}</Typography>
          </Grid>
          {paddedWeeklyHours.map((hours, i) => (
            <Grid item xs={1.6} key={i}>
              <TextField 
                variant='standard' 
                fullWidth 
                size="small" 
                value={formatHours(hours)} 
                InputProps={{ readOnly: true }} 
              />
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Box>
  );
};

export default WeeklyHoursTable;