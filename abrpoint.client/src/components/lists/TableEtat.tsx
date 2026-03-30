import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, useTheme } from '@mui/material';
import { ReactElement, JSXElementConstructor, ReactNode, ReactPortal } from 'react';

function TableEtat({ data }: { data: any }) {
  const theme = useTheme();

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle1" fontWeight={700}>
          Horaires de l'employé sélectionné
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Cliquez sur un salarié dans la liste pour prévisualiser ses horaires ici.
        </Typography>
      </Box>

      <TableContainer sx={{ flex: 1, minHeight: 0 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell size='small' sx={{ backgroundColor: theme.palette.primary.main, color: theme.palette.primary.contrastText, fontWeight: 'bold' }}>
                Poste
              </TableCell>
              <TableCell size='small' sx={{ backgroundColor: theme.palette.primary.main, color: theme.palette.primary.contrastText, fontWeight: 'bold' }}>
                Entrée Matin
              </TableCell>
              <TableCell size='small' sx={{ backgroundColor: theme.palette.primary.main, color: theme.palette.primary.contrastText, fontWeight: 'bold' }}>
                Sortie Matin
              </TableCell>
              <TableCell size='small' sx={{ backgroundColor: theme.palette.primary.main, color: theme.palette.primary.contrastText, fontWeight: 'bold' }}>
                Entrée AM
              </TableCell>
              <TableCell size='small' sx={{ backgroundColor: theme.palette.primary.main, color: theme.palette.primary.contrastText, fontWeight: 'bold' }}>
                Sortie AM
              </TableCell>
              <TableCell size='small' sx={{ backgroundColor: theme.palette.primary.main, color: theme.palette.primary.contrastText, fontWeight: 'bold' }}>
                Tolérance Entrée
              </TableCell>
              <TableCell size='small' sx={{ backgroundColor: theme.palette.primary.main, color: theme.palette.primary.contrastText, fontWeight: 'bold' }}>
                Tolérance Sortie
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.length ? data.map((row: {
              lunhdmat:string, lunhfmat: ReactNode; codposte: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined; lunhdam: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined; avantEnt: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined; avantSort: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined;
            }, index: number) => (
              <TableRow key={index} hover>
                <TableCell size='small'>{row.codposte}</TableCell>
                <TableCell size='small'>{row.lunhdmat}</TableCell>
                <TableCell size='small'>{row.lunhfmat}</TableCell>
                <TableCell size='small'>{row.lunhdam}</TableCell>
                <TableCell size='small'>{row.lunhdam}</TableCell>
                <TableCell size='small'>{row.avantEnt}</TableCell>
                <TableCell size='small'>{row.avantSort}</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={7} sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                  Sélectionnez un employé pour afficher ses horaires.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default TableEtat;
