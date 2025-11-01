import { useMemo, useState } from 'react';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  MRT_GlobalFilterTextField,
  MRT_ToggleFiltersButton,
} from 'material-react-table';
import {
  Box,
  Button,
  ListItemIcon,
  MenuItem,
  Snackbar,
  Alert,
  lighten,
} from '@mui/material';
import { Delete, Edit } from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Solde } from '../../../../models/Solde';
import './SoldeConge.css';
import AlertModal from '../../../AlertModal/AlertModal';
import useGetSolde from '../../../../hooks/soldeCongeHooks/useGetSolde';
import useDeleteSolde from '../../../../hooks/soldeCongeHooks/useDeleteSolde';
import { useSoldeContext } from '../../../helper/SoldeContext';

const SoldeList = () => {
  const { setSelectedSolde } = useSoldeContext();
  const [openModal, setOpenModal] = useState(false);
  const [soldeToDelete, setSoldeToDelete] = useState<Solde | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const { data = [],refetch } = useGetSolde();
  const deleteSoldeMutation = useDeleteSolde();

  const getSoldeToEdit = (original: Solde) => {
    const selectedSolde = data.find((solde:Solde) => solde.soccod == original.soccod && solde.empcod == original.empcod);
    if(selectedSolde){
      setSelectedSolde(selectedSolde);
    }
  }

  const columns = useMemo<MRT_ColumnDef<Solde>[]>(() => [
    {
      id: 'soldeDetails',
      header: '',
      columns: [
        {
          accessorKey: 'empcod',
          header: 'Code',
          size: 60,
        },
        {
          accessorKey: 'annee',
          header: 'Année',
          size: 60,
        },
        {
          accessorKey: 'conge',
          header: 'Solde',
          size: 60,
        },
        {
          accessorKey: 'empconge',
          header: 'Droit de Congé',
          size: 60,
        },
      ],
    },
  ], []);

  const table = useMaterialReactTable({
    columns,
    data,
    enableRowActions: true,
    enableColumnFilterModes: true,
    enableColumnOrdering: true,
    enableGrouping: true,
    enableColumnPinning: true,
    enableFacetedValues: true,
    enableRowSelection: true,

    initialState: {
      showColumnFilters: false,
      showGlobalFilter: true,
      pagination: { pageIndex: 0, pageSize: 5 },
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
      rowsPerPageOptions: [5, 10, 20],
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

    renderRowActionMenuItems: ({ closeMenu, row }) => [
      <MenuItem
        key="delete"
        onClick={() => {
          setSoldeToDelete(row.original);
          setOpenModal(true);
          closeMenu();
        }}
        sx={{ m: 0 }}
      >
        <ListItemIcon>
          <Delete />
        </ListItemIcon>
        Supprimer
      </MenuItem>,
      <MenuItem
        key="edit"
        onClick={() => {
          getSoldeToEdit(row.original);
          closeMenu();
        }}
        sx={{ m: 0 }}
      >
        <ListItemIcon>
          <Edit />
        </ListItemIcon>
        Editer
      </MenuItem>,
    ],

    renderTopToolbar: ({ table }) => {
      const handleExportRows = (rows: Solde[]) => {
        const doc = new jsPDF();
        const tableData = rows.map((row) => [
          row.empcod,
          row.soccod,
          row.annee || '',
          row.conge || 0,
          row.empconge || 0,
        ]);
        const tableHeaders = ['Employee Code', 'Soc Code', 'Year', 'Leave Balance', 'Employee Leave'];

        autoTable(doc, {
          head: [tableHeaders],
          body: tableData,
        });

        doc.save('soldes-pdf-export.pdf');
      };

      return (
        <Box
          sx={(theme) => ({
            backgroundColor: lighten(theme.palette.background.default, 0.05),
            display: 'flex',
            gap: '0.5rem',
            p: '8px',
            justifyContent: 'space-between',
          })}
        >
          <Box sx={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <MRT_GlobalFilterTextField table={table} />
            <MRT_ToggleFiltersButton table={table} />
          </Box>
          <Box>
            <Button
              color="primary"
              disabled={!table.getIsSomeRowsSelected()}
              onClick={() => handleExportRows(table.getSelectedRowModel().flatRows.map((row) => row.original))}
              variant="contained"
            >
              Export Selected
            </Button>
          </Box>
        </Box>
      );
    },
  });

  const handleDeleteConfirm = () => {
    if (soldeToDelete) {
      deleteSoldeMutation.mutate(soldeToDelete, {
        onSuccess: () => {
          setSnackbarMessage('Solde supprimé avec succès !');
          setSnackbarSeverity('success');
          setSnackbarOpen(true);
          setOpenModal(false);
              refetch();
        },
        onError: () => {
          setSnackbarMessage('Erreur lors de la suppression du solde.');
          setSnackbarSeverity('error');
          setSnackbarOpen(true);
        },
      });
    }
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  return (
    <Box width={'90vw'}>
      <div >
        <MaterialReactTable table={table} />
      </div>
      {/* AlertModal to confirm deletion */}
      <AlertModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onConfirm={handleDeleteConfirm}
        message="Êtes-vous sûr de vouloir supprimer ce solde ?"
      />
      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SoldeList;
