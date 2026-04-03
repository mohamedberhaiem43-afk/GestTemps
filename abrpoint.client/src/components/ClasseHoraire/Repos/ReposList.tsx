import { useMemo, useState } from 'react';
import { 
  MaterialReactTable, 
  useMaterialReactTable, 
  type MRT_ColumnDef,
} from 'material-react-table';
import { 
  ListItemIcon, 
  MenuItem, 
  Snackbar, 
  Alert, 
  CircularProgress,
  Box,
} from '@mui/material';
import { CheckCircle, Cancel, Delete, Edit } from '@mui/icons-material';
import AlertModal from '../../AlertModal/AlertModal';
import useGetRepos from '../../../hooks/Repos/useGetRepos';
import useDeleteRepos from '../../../hooks/Repos/useDeleteRepos';
import { Ferier } from '../../../models/Ferier';
import { useFerierContext } from '../../helper/ReposContext';
import { formatCellDate } from '../../helper/formatCellDate';
// utils/dateUtils.ts

const FerierList = () => {
  const {setSelectedFerier} = useFerierContext();
  const [openModal, setOpenModal] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<Ferier | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Fetching Data
  const { data = [], error, isLoading, refetch } = useGetRepos();
  const deleteRepos = useDeleteRepos();
  const getReposToEdit = (original: Ferier) => {
    const selectedRepos = data.find((ferier: Ferier) => ferier.ferdate === original.ferdate && ferier.soccod === original.soccod);
    if(selectedRepos)
      setSelectedFerier(selectedRepos);
  }
  // Handle delete confirmation
  const handleDelete = (row: Ferier) => {
    setRowToDelete(row);
    setOpenModal(true);
  };

  const confirmDelete = () => {
    if (rowToDelete) {
      deleteRepos.mutate(rowToDelete, {
        onSuccess: () => {
          refetch();
          setSnackbar({ open: true, message: 'Supprimé avec succès!', severity: 'success' });
          setRowToDelete(null);
          setOpenModal(false);
        },
        onError: (err) => {
          console.error("Error deleting row:", err);
          setSnackbar({ open: true, message: "Erreur lors de la suppression.", severity: 'error' });
        },
      });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: '', severity: 'success' });
  };

  // Define table columns
  const columns = useMemo<MRT_ColumnDef<Ferier>[]>(() => [
    {
      id: 'ferierDetails',
      header: '',
      columns: [
        {
          accessorKey: 'ferdate',
          header: 'Date',
          size: 60,
          Cell: ({ cell }) => formatCellDate(cell.getValue()),
        },
        {
          accessorKey: 'fermotif',
          header: 'Motif',
          size: 60,
        },
        {
          accessorKey: 'ferfixe',
          header: 'Fixe ?',
          size: 60,
          Cell: ({ cell }) => (
            cell.getValue() === '1' ? <CheckCircle color="success" /> : <Cancel color="error" />
          ),
        },
        {
          accessorKey: 'fertype',
          header: 'Type',
          size: 60,
        },
        {
          accessorKey: 'ferheure',
          header: 'Nb.Heures',
          size: 60,
        },
        {
          accessorKey: 'fernpaye',
          header: 'Payé ?',
          size: 60,
          Cell: ({ cell }) => (
            cell.getValue() === '1' ? <Cancel color="error" /> : <CheckCircle color="success" />
          ),
        },
        {
          accessorKey: 'fertrv',
          header: 'Date de Retour',
          size: 60,
          Cell: ({ cell }) => formatCellDate(cell.getValue()),
        },
      ],
    },
  ], []);

  const table = useMaterialReactTable({
    columns,
    data,
    enableColumnFilterModes: true,
    enableRowActions: true,
    enableColumnOrdering: true,
    enableGrouping: true,
    enableColumnPinning: true,
    enableFacetedValues: true,
    enableRowSelection: true,
    initialState: {
      showColumnFilters: false,
      showGlobalFilter: true,
      pagination: { pageIndex: 0, pageSize: 4 },
      columnPinning: {
        left: ['mrt-row-expand', 'mrt-row-select'],
        right: ['mrt-row-actions'],
      },
    },
    paginationDisplayMode: 'pages',
    positionToolbarAlertBanner: 'bottom',
    muiSearchTextFieldProps: {
      size: 'small',
      variant: 'outlined',
    },
    muiPaginationProps: {
      color: 'secondary',
      rowsPerPageOptions: [4, 10, 20],
      shape: 'rounded',
      variant: 'outlined',
    },
    muiTableBodyCellProps: {
      sx: {
        padding: '0px 0px',
      },
    },
    muiTableHeadCellProps: {
      sx: {
        fontSize: '0.7rem',
        padding: '0px 0px',
      },
    },
    renderRowActionMenuItems: ({ row, closeMenu }) => [
      <MenuItem key="edit" onClick={() => { getReposToEdit(row.original); closeMenu(); }} sx={{ m: 0 }}>
        <ListItemIcon>
          <Edit />
        </ListItemIcon>
        Editer
      </MenuItem>,
      <MenuItem key="delete" onClick={() => { handleDelete(row.original); closeMenu(); }} sx={{ m: 0 }}>
        <ListItemIcon>
          <Delete />
        </ListItemIcon>
        Supprimer
      </MenuItem>,
    ],
  });

  return (
    <Box >
        {isLoading ? (
          <CircularProgress />
         ) : error ? (
         <Alert severity="error">Erreur de chargement des données</Alert>
        ) : (
          <MaterialReactTable table={table} />
        )}
        <AlertModal 
          open={openModal} 
          onClose={() => setOpenModal(false)} 
          onConfirm={confirmDelete}
          message="Êtes-vous sûr de vouloir supprimer cet élément ?" 
        />
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
            {snackbar.message}
          </Alert>
        </Snackbar>
    </Box>
  );
};

export default FerierList;
