import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { useTranslation } from 'react-i18next';
import useGetUsers from '../../../hooks/userHooks/useGetUsers';
import { useUserContext } from '../../helper/UserProvider';

export default function ListeUtilisateur() {
  const { t } = useTranslation();
  const { data: users, isLoading, error } = useGetUsers();
  const { selectedUser, setSelectedUser } = useUserContext();

  if (isLoading) return <p>{t('pointeuseAccees.list.loading')}</p>;
  if (error) return <p>{t('pointeuseAccees.list.fetchError')}</p>;

  return (
    <TableContainer component={Paper} sx={{ maxHeight: 450, position: 'relative' }}>
      <Table size="small" aria-label="a dense table" >
        <TableHead sx={{ backgroundColor: '#1976d2', position: 'sticky', top: 0, zIndex: 1 }}>
          <TableRow>
            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>{t('pointeuseAccees.list.code')}</TableCell>
            <TableCell align="left" sx={{ color: 'white', fontWeight: 'bold' }}>{t('pointeuseAccees.list.name')}</TableCell>
            <TableCell align="left" sx={{ color: 'white', fontWeight: 'bold' }}>{t('pointeuseAccees.list.firstName')}</TableCell>
            <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>{t('pointeuseAccees.list.active')}</TableCell>
            <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>{t('pointeuseAccees.list.admin')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users?.map((user: any) => (
            <TableRow
              key={user.uticod}
              onClick={() => setSelectedUser(user.uticod)}
              sx={{ 
                '&:last-child td, &:last-child th': { border: 0 }, 
                cursor: "pointer",
                backgroundColor: selectedUser === user.uticod ? '#e3f2fd' : 'inherit',
                '&:hover': {
                  backgroundColor: '#f5f5f5'
                }
              }}
            >
              <TableCell component="th" scope="row">{user.uticod}</TableCell>
              <TableCell align="left">{user.utinom}</TableCell>
              <TableCell align="left">{user.utiprn}</TableCell>
              <TableCell align="center">{user.utiactif === '1' ? t('pointeuseAccees.list.yes') : t('pointeuseAccees.list.no')}</TableCell>
              <TableCell align="center">{user.utiadm === '1' ? t('pointeuseAccees.list.yes') : t('pointeuseAccees.list.no')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}