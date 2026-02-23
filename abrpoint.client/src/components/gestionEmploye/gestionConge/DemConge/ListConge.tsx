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
import './ListConge.css'
import { AccountCircle, Edit, Send } from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Conge } from '../../../../models/Conge';
import useAcceptDemConge from '../../../../hooks/congeHooks/useAcceptDemConge';
import useGetDemConges from '../../../../hooks/congeHooks/useGetDemConges';
import { useCongeContext } from '../../../helper/CongeContext';
import AlertModal from '../../../AlertModal/AlertModal';

export default function CongeList() {
  const { setSelectedConge: setSelectedCongeForEdit } = useCongeContext();
  const { mutate: acceptConge, isLoading: isAccepting } = useAcceptDemConge();
  const { data = [], isLoading } = useGetDemConges();
  
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

  const getDemCongeToEdit = (original: Conge) => {
    const selectedConge = data.find((conge: Conge) => conge.concod === original.concod);
    if (selectedConge)
      setSelectedCongeForEdit(selectedConge);
  }

  const handleAcceptClick = (concod: string, empcod: string) => {
    setSelectedCongeToAccept({ concod, empcod });
    setAlertOpen(true);
  };

  const handleConfirmAccept = () => {
    if (selectedCongeToAccept) {
      acceptConge(
        { concod: selectedCongeToAccept.concod, empcod: selectedCongeToAccept.empcod },
        {
          onSuccess: (data: any) => {
            setSnackbar({
              open: true,
              message: data.message || 'Demande de congé acceptée avec succès',
              severity: 'success',
            });
            setAlertOpen(false);
            setSelectedCongeToAccept(null);
          },
          onError: (error: any) => {
            console.error('Erreur:', error);
            const errorMessage = error.response?.data?.message || 
                                error.message || 
                                'Erreur lors de l\'acceptation de la demande';
            setSnackbar({
              open: true,
              message: errorMessage,
              severity: 'error',
            });
            setAlertOpen(false);
            setSelectedCongeToAccept(null);
          },
        }
      );
    }
  };

  const handleCancelAccept = () => {
    setAlertOpen(false);
    setSelectedCongeToAccept(null);
  };

  const columns = useMemo<MRT_ColumnDef<Conge>[]>(() => [
    {
      id: 'congeDetails',
      header: '',
      columns: [
        {
          accessorKey: 'concod',
          header: 'N° Ordre',
          size: 100,
        },
        {
          accessorKey: 'empcod',
          header: 'Employé',
          size: 160,
        },
        {
          accessorKey: 'abscod',
          header: 'Imputation',
          size: 100,
        },
        {
          accessorKey: 'condat',
          header: 'Date',
          size: 100,
          Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleDateString(),
        },
        {
          accessorKey: 'condep',
          header: 'Date départ',
          size: 100,
          Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleDateString(),
        },
        {
          accessorKey: 'conret',
          header: 'Date retour',
          size: 100,
          Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleDateString(),
        },
        {
          accessorKey: 'connbjour',
          header: 'Nb.jours',
          size: 60,
        },
      ],
    },
  ], []);

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
          handleAcceptClick(row.original.concod, row.original.empcod);
          closeMenu();
        }}
        sx={{ m: 0 }}
      >
        <ListItemIcon>
          <AccountCircle />
        </ListItemIcon>
        Accepter
      </MenuItem>,
      <MenuItem
        key={1}
        onClick={() => {
          closeMenu();
        }}
        sx={{ m: 0 }}
      >
        <ListItemIcon>
          <Send />
        </ListItemIcon>
        Refuser
      </MenuItem>,
      <MenuItem
        key="edit"
        onClick={() => {
          getDemCongeToEdit(row.original)
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
      const handleExportRows = (rows: Conge[]) => {
        const doc = new jsPDF();
        const tableData = rows.map((row) => [
          row.concod,
          row.empcod,
          row.condat ? new Date(row.condat).toLocaleDateString() : '',
          row.connbjour,
          row.consolde,
        ]);
        const tableHeaders = ['N° Ordre', 'Employé', 'Imputation', 'Date', 'Date départ', 'Date retour', 'Nb.jours',];

        autoTable(doc, {
          head: [tableHeaders],
          body: tableData,
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
              onClick={() => handleExportRows(table.getSelectedRowModel().flatRows.map((row) => row.original))}
              variant="contained"
            >
              Export Selected
            </Button>
          </Box>
        </Box>
      );
    },
    localization: {
      actions: "Decision",
    },
  });

  return (
    <Box>
      {
        (isLoading || isAccepting) &&
        (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100vh',
            }}
          >
            <CircularProgress />
          </Box>
        )
      }
      <div className="scrollable-table-container">
        <MaterialReactTable table={table} />
      </div>

      <AlertModal
        open={alertOpen}
        onClose={handleCancelAccept}
        onConfirm={handleConfirmAccept}
        message="Êtes-vous sûr de vouloir accepter cette demande de congé ?"
      />
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}