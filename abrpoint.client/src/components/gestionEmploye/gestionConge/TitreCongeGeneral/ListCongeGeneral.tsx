import { useMemo, useState } from 'react';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  MRT_GlobalFilterTextField,
  MRT_ToggleFiltersButton,
} from 'material-react-table';
import {
  Alert,
  Box,
  Button,
  ListItemIcon,
  MenuItem,
  Snackbar,
  lighten,
} from '@mui/material';
import { Delete } from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Conge } from '../../../../models/Conge';
import AlertModal from '../../../AlertModal/AlertModal';
import useGetTitreConge from '../../../../hooks/congeHooks/useGetTitreConge';
import useDeleteTitreConge from '../../../../hooks/congeHooks/useDeleteTitreConge';

const ListCongeGeneral = () => {
  const [openModal, setOpenModal] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<Conge | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('error');

  const { data = [], refetch } = useGetTitreConge();
  const { mutate: deleteConge } = useDeleteTitreConge();

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  const handleDelete = () => {
    if (rowToDelete) {
      deleteConge(rowToDelete, {
        onSuccess: () => {
          setOpenModal(false);
          refetch();
          setSnackbarOpen(true);
          setSnackbarSeverity('success');
          setSnackbarMessage('Suppression avec succès');
        },
        onError: () => {
          setSnackbarSeverity('error');
          setSnackbarMessage('Problème de suppression');
          alert('Erreur lors de la suppression du congé.');
        },
      });
    }
  };

  const columns = useMemo<MRT_ColumnDef<Conge>[]>(
    () => [
      {
        id: 'congeDetails',
        header: 'Détails Congé',
        columns: [
          {
            accessorKey: 'concod',
            header: 'N° Ordre',
            size: 100,
          },
          {
            accessorKey: 'emplib',
            header: 'Employé',
            size: 160,
          },
          {
            accessorKey: 'abslib',
            header: 'Imputation',
            size: 100,
          },
          {
            accessorKey: 'condat',
            header: 'Date',
            size: 100,
            Cell: ({ cell }) =>
              cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleDateString('fr-FR') : '',
          },
          {
            accessorKey: 'condep',
            header: 'Date départ',
            size: 100,
            Cell: ({ cell }) =>
              cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleDateString('fr-FR') : '',
          },
          {
            accessorKey: 'conret',
            header: 'Date retour',
            size: 100,
            Cell: ({ cell }) =>
              cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleDateString('fr-FR') : '',
          },
          {
            accessorKey: 'connbjour',
            header: 'Nb. jours',
            size: 60,
          },
        ],
      },
    ],
    [],
  );

  const table = useMaterialReactTable({
    columns,
    data,
    enableColumnFilterModes: true,
    enableColumnOrdering: true,
    enableGrouping: true,
    enableColumnPinning: true,
    enableFacetedValues: true,
    enableRowActions: true,
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
        key={0}
        onClick={() => {
          setRowToDelete(row.original);
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
    ],
    renderTopToolbar: ({ table }) => {
      const handleExportRows = (rows: Conge[]) => {
        const formattedTableData = rows.map((row) => [
          row.concod,
          row.emplib,
          row.condat ? new Date(row.condat).toLocaleDateString('fr-FR') : '',
          row.condep ? new Date(row.condep).toLocaleDateString('fr-FR') : '',
          row.conret ? new Date(row.conret).toLocaleDateString('fr-FR') : '',
          row.connbjour,
        ]);

        const doc = new jsPDF();
        const tableHeaders = ['N° Ordre', 'Employé', 'Imputation', 'Date', 'Date départ', 'Date retour', 'Nb. jours'];

        autoTable(doc, {
          head: [tableHeaders],
          body: formattedTableData,
        });

        doc.save('conges-pdf-export.pdf');
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
              onClick={() =>
                handleExportRows(table.getSelectedRowModel().flatRows.map((row) => row.original))
              }
              variant="contained"
            >
              Export Selected
            </Button>
          </Box>
        </Box>
      );
    },
    localization: {
      actions: 'Décision',
    },
  });

  return (
    <Box>
      <MaterialReactTable table={table} />

      <AlertModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onConfirm={handleDelete}
        message="Êtes-vous sûr de vouloir supprimer ce congé ?"
      />

      <Snackbar open={snackbarOpen} autoHideDuration={1500} onClose={handleSnackbarClose}>
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ListCongeGeneral;
