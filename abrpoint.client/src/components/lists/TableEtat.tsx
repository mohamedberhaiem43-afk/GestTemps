import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, useTheme } from '@mui/material'
import { ReactElement, JSXElementConstructor, ReactNode, ReactPortal } from 'react';

function TableEtat({ data }: { data: any }) {
  const theme = useTheme();

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Poste
            </TableCell>
            <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Entrée Matin
            </TableCell>
            <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Sortie Matin
            </TableCell>
            <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Entrée AM
            </TableCell>
            <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Sortie AM
            </TableCell>
            <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Tolérance Entrée
            </TableCell>
            <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Tolérance Sortie
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data?.map((row: {
            lunhdmat:string,  lunhfmat: ReactNode; codposte: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined; lunhdam: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined; avantEnt: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined; avantSort: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined;  
}) => (
            <TableRow key={'index'}>
              <TableCell size='small'>{row.codposte}</TableCell>
              <TableCell size='small'>{row.lunhdmat}</TableCell>
              <TableCell size='small'>{row.lunhfmat}</TableCell>
              <TableCell size='small'>{row.lunhdam}</TableCell>
              <TableCell size='small'>{row.lunhdam}</TableCell>
              <TableCell size='small'>{row.avantEnt}</TableCell>
              <TableCell size='small'>{row.avantSort}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default TableEtat