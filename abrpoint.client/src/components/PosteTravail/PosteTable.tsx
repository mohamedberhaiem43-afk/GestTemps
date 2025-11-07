import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Checkbox
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface PosteListProps {
  scheduleData: any[];
  onChange: (index: number, field: string, value: any) => void;
}

const PosteList = ({ scheduleData, onChange }: PosteListProps) => {
  const theme = useTheme();

  const headers = [
    'Journée',
    'Début Entrée Matin',
    'Entrée Matin',
    'Fin Entrée Matin',
    'Sortie Matin',
    'Début Entrée Après-midi',
    'Entrée Après-midi',
    'Sortie Après-midi',
    'Fin Entrée Après-midi',
    'Repas Bonus',
    'Repos',
    'Max Hre',
    'Min Jour',
    'Min Demi-Jour',
    'Douche'
  ];

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {headers.map((header) => (
              <TableCell
                key={header}
                size="small"
                sx={{
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  fontWeight: 'bold',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
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

              {/* Matin */}
              <TableCell size="small">
                <TextField
                  value={row.DebEntree || ''}
                  onChange={(e) => onChange(index, 'DebEntree', e.target.value)}
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

              {/* Après-midi */}
              <TableCell size="small">
                <TextField
                  value={row.DebEntree2 || ''}
                  onChange={(e) => onChange(index, 'DebEntree2', e.target.value)}
                  variant="standard"
                  size="small"
                />
              </TableCell>
              <TableCell size="small">
                <TextField
                  value={row.Entree2 || ''}
                  onChange={(e) => onChange(index, 'Entree2', e.target.value)}
                  variant="standard"
                  size="small"
                />
              </TableCell>
              <TableCell size="small">
                <TextField
                  value={row.Sortie2 || ''}
                  onChange={(e) => onChange(index, 'Sortie2', e.target.value)}
                  variant="standard"
                  size="small"
                />
              </TableCell>
              <TableCell size="small">
                <TextField
                  value={row.FinEntree2 || ''}
                  onChange={(e) => onChange(index, 'FinEntree2', e.target.value)}
                  variant="standard"
                  size="small"
                />
              </TableCell>

              {/* Autres colonnes */}
              <TableCell size="small">
                <TextField
                  value={row.repasBonus || '0'}
                  onChange={(e) => onChange(index, 'repasBonus', e.target.value)}
                  variant="standard"
                  size="small"
                />
              </TableCell>

              <TableCell size="small" align="center">
                <Checkbox
                  size="small"
                  checked={row.repos === '1'}
                  onChange={(e) => onChange(index, 'repos', e.target.checked ? '1' : '0')}
                />
              </TableCell>

              <TableCell size="small">
                <TextField
                  value={row.maxhre || ''}
                  onChange={(e) => onChange(index, 'maxhre', e.target.value)}
                  variant="standard"
                  size="small"
                />
              </TableCell>

              <TableCell size="small">
                <TextField
                  value={row.minhjour || ''}
                  onChange={(e) => onChange(index, 'minhjour', e.target.value)}
                  variant="standard"
                  size="small"
                />
              </TableCell>

              <TableCell size="small">
                <TextField
                  value={row.minhdemijour || ''}
                  onChange={(e) => onChange(index, 'minhdemijour', e.target.value)}
                  variant="standard"
                  size="small"
                />
              </TableCell>

              <TableCell size="small">
                <Checkbox
                  size="small"
                  checked={row.Douche === '1'}
                  onChange={(e) => onChange(index, 'Douche', e.target.checked ? '1' : '0')}
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
