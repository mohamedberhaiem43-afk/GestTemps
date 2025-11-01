import { Box, Paper, Grid, Typography, TextField } from "@mui/material";

interface WeeklyHoursTableProps {
  weekRanges: { start: string; end: string }[];
  weeklyHours: (string | undefined)[];
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
  paddedWeeklyHours.push('');
}

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
            <Typography fontWeight="bold" color="#1976d2">Date début</Typography>
          </Grid>
          {paddedWeekRanges.map((week, i) => (
            <Grid item xs={1.6} key={i}>
              <TextField variant='standard' fullWidth size="small" value={week.start} InputProps={{ readOnly: true }} />
            </Grid>
          ))}

          <Grid item xs={2}>
            <Typography fontWeight="bold" color="#1976d2">Date fin</Typography>
          </Grid>
          {paddedWeekRanges.map((week, i) => (
            <Grid item xs={1.6} key={i}>
              <TextField variant='standard' fullWidth size="small" value={week.end} InputProps={{ readOnly: true }} />
            </Grid>
          ))}

          <Grid item xs={2}>
            <Typography fontWeight="bold" color="#1976d2">Nb. Heures</Typography>
          </Grid>
          {paddedWeeklyHours.map((hours, i) => (
            <Grid item xs={1.6} key={i}>
              <TextField variant='standard' fullWidth size="small" value={hours} InputProps={{ readOnly: true }} />
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Box>
  );
};
export default WeeklyHoursTable;