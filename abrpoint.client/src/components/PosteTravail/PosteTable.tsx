import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Checkbox } from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface PosteListProps {
  scheduleData: any[];
  onChange: (index: number, field: string, value: any) => void;
}

const PosteList = ({ scheduleData, onChange }: PosteListProps) => {
  const theme = useTheme();

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {['Journée','Début Entrée', 'Entrée', 'Fin Entrée','Sortie', 'Repas Bonus', 'Repos'].map((header) => (
              <TableCell
                key={header}
                size="small"
                sx={{
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  fontWeight: 'bold',
                }}
              >
                {header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {scheduleData.map((row, index) => (
            <TableRow key={index}>
              <TableCell size="small">{row.jour}</TableCell>
              <TableCell size="small">
                <TextField
                  value={row.DebutEntree || ''}
                  onChange={(e) => onChange(index, 'DebutEntree', e.target.value)}
                  variant="standard"
                  size="small"
                />
              </TableCell>
              <TableCell size="small">
                <TextField
                  value={row.Entrée || ''}
                  onChange={(e) => onChange(index, 'Entrée', e.target.value)}
                  variant="standard"
                  size="small"
                />
              </TableCell>
              <TableCell size="small">
                <TextField
                  value={row.FinEntree || ''}
                  onChange={(e) => onChange(index, 'FinEntree', e.target.value)}
                  variant="standard"
                  size="small"
                />
              </TableCell>
              <TableCell size="small">
                <TextField
                  value={row.Sortie || ''}
                  onChange={(e) => onChange(index, 'Sortie', e.target.value)}
                  variant="standard"
                  size="small"
                />
              </TableCell>
              <TableCell size="small">
                <TextField
                  value={row.repasBonus || '0'}
                  onChange={(e) => onChange(index, 'repasBonus', e.target.value)}
                  variant="standard"
                  size="small"
                />
              </TableCell>
              <TableCell size="small">
                <Checkbox
                  size="small"
                  checked={row.repos === '1'}
                  onChange={(e) => onChange(index, 'repos', e.target.checked ? '1' : '0')}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default PosteList;
