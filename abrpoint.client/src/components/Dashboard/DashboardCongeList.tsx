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
  CircularProgress,
  ListItemIcon,
  MenuItem,
  Snackbar,
  lighten,
} from '@mui/material';
import { Send } from '@mui/icons-material';
import { Conge } from '../../models/Conge';
import useAcceptDemConge from '../../hooks/congeHooks/useAcceptDemConge';
import AlertModal from '../AlertModal/AlertModal';

interface DashboardCongeListProps {
  data: Conge[];
  isLoading: boolean;
}

export default function DashboardCongeList({ data = [], isLoading }: DashboardCongeListProps) {

    const { mutate: acceptConge } = useAcceptDemConge();

  // États pour le modal de confirmation d'acceptation
  const [alertOpen, setAlertOpen] = useState(false);
  const [selectedCongeToAccept, setSelectedCongeToAccept] = useState<{ concod: string; empcod: string } | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleAcceptConge = (conge: Conge) => {
    setSelectedCongeToAccept({ concod: conge.concod, empcod: conge.empcod });
    setAlertOpen(true);
  };

  const confirmAcceptConge = () => {
    if (selectedCongeToAccept) {
      acceptConge(selectedCongeToAccept, {
        onSuccess: () => {
          setSnackbar({
            open: true,
            message: 'Demande de congé acceptée avec succès',
            severity: 'success',
          });
          setAlertOpen(false);
          setSelectedCongeToAccept(null);
        },
        onError: () => {
          setSnackbar({
            open: true,
            message: 'Erreur lors de l\'acceptation de la demande',
            severity: 'error',
          });
          setAlertOpen(false);
          setSelectedCongeToAccept(null);
        },
      });
    }
  };

  const columns = useMemo<MRT_ColumnDef<Conge>[]>(
    () => [
      {
        accessorKey: 'concod',
        header: 'N° Ordre',
        size: 100,
      },
      {
        accessorKey: 'empcod',
        header: 'Matricule',
        size: 100,
      },
      {
        accessorKey: 'emplib',
        header: 'Nom',
        size: 150,
      },
            {
          accessorKey: 'abscod',
          header: 'Imputation',
          size: 100,
    },
      {
        accessorKey: 'condep',
        header: 'Date Début',
        size: 120,
        Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleDateString('fr-FR'),
      },
      {
        accessorKey: 'conret',
        header: 'Date Fin',
        size: 120,
        Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleDateString('fr-FR'),
      },
      {
        accessorKey: 'connbjour',
        header: 'Nombre de Jours',
        size: 120,
      }
    ],
    []
  );

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
      rowsPerPageOptions: [10, 20, 30],
      shape: 'rounded',
      variant: 'outlined',
    },
    renderRowActionMenuItems: ({ closeMenu, row }) => [
      <MenuItem
        key={1}
        onClick={() => {
          closeMenu();
          handleAcceptConge(row.original);
        }}
        sx={{ m: 0 }}
      >
        <ListItemIcon>
          <Send />
        </ListItemIcon>
        Accepter
      </MenuItem>,
    ],
    renderTopToolbar: ({ table }) => {
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
            <Box sx={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                color="success"
                disabled={!table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()}
                onClick={() => {
                  const selectedRows = table.getSelectedRowModel().rows;
                  selectedRows.forEach((row) => {
                    handleAcceptConge(row.original);
                  });
                }}
                variant="contained"
              >
                Accepter Sélectionnés
              </Button>
            </Box>
          </Box>
        </Box>
      );
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <MaterialReactTable table={table} />
      <AlertModal
        open={alertOpen}
        onClose={() => setAlertOpen(false)}
        message="Êtes-vous sûr de vouloir accepter cette demande de congé ?"
        onConfirm={confirmAcceptConge}
      />
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}