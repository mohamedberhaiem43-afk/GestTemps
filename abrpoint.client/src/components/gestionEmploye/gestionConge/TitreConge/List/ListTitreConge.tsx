import { useMemo ,useState} from 'react';
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
  Typography,
  lighten,
} from '@mui/material';
import { Edit, PictureAsPdf, Send } from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Conge } from '../../../../../models/Conge';
import AlertModal from '../../../../AlertModal/AlertModal';
import useGetTitreConge from '../../../../../hooks/congeHooks/useGetTitreConge';
import useDeleteTitreConge from '../../../../../hooks/congeHooks/useDeleteTitreConge';
import { useTranslation } from 'react-i18next';
import { useCongeContext } from '../../../../helper/CongeContext';
import CongeReportService from '../../../../../services/CongeService/CongeReportService';

const TitreCongeList = () => {
  const { setSelectedConge } = useCongeContext();
  const { t } = useTranslation();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('error');
  const [openAlert, setOpenAlert] = useState(false); // State to manage modal visibility
  const [rowToDelete, setRowToDelete] = useState<Conge | null>(null); // Store the row that is to be deleted
  const { mutate: deleteConge } = useDeleteTitreConge(); // Use delete hook
  const { data = [], error,isLoading,refetch } = useGetTitreConge();
  const handleSnackbarClose = ()=>{
    setSnackbarOpen(false);
  }
  const handleDelete = () => {
    if (rowToDelete) {
      deleteConge(rowToDelete, {
        onSuccess: () => {
          setOpenAlert(false); // Close the modal
          refetch();
          setSnackbarOpen(true);
          setSnackbarSeverity("success");
          setSnackbarMessage(t('conge.messages.deleteSuccess') || 'Deletion successful');
        },
        onError: () => {
          setSnackbarSeverity("error");
          setSnackbarMessage(t('conge.messages.deleteError') || 'Error during deletion');
          alert(t('conge.messages.deleteErrorAlert') || 'Error deleting leave.');
        },
      });
    }
  };
  const getCongeReport = async (original: Conge) => {
    try {
      // Fetch the report as a Blob
        const response = await CongeReportService.getReport(`get-report/${original.concod}`,'blob');
        const blob = new Blob([response], { type: 'application/pdf' });


        // Create a temporary download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Conge.pdf';

        // Trigger the download
        link.click();

        // Clean up the temporary URL
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading the report:', error);
    }
};

  

  const getCongeToEdit = (original: Conge) => {
    const selectedConge = data.find((conge:Conge) => conge?.concod == original?.concod);
    if(selectedConge)
      setSelectedConge(selectedConge);
  }
  const columns = useMemo<MRT_ColumnDef<Conge>[]>(() => [
    {
      id: 'congeDetails',
      header: '',
      columns: [
        {
          accessorKey: 'concod',
          header: t('conge.orderNumber') || 'Order No',
          size: 100,
        },
        {
          accessorKey: 'emplib',
          header: t('common.employee') || 'Employee',
          size: 160,
        },
        {
          accessorKey: 'abslib',
          header: t('common.imputation') || 'Imputation',
          size: 100,
        },
        {
          accessorKey: 'condat',
          header: t('common.date') || 'Date',
          size: 100,
          Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleDateString(),
        },
        {
          accessorKey: 'condep',
          header: t('common.dateStart') || 'Start Date',
          size: 100,
          Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleDateString(),
        },
        {
          accessorKey: 'conret',
          header: t('common.dateEnd') || 'End Date',
          size: 60,
          Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleDateString(),
        },
        {
          accessorKey: 'connbjour',
          header: t('common.nbDays') || 'Nb.Days',
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
    renderRowActionMenuItems: ({ row, closeMenu }) => [
      <MenuItem
        key={0}
        onClick={() => {
          getCongeToEdit(row.original);
          closeMenu();
        }}
        sx={{ m: 0 }}
      >
        <ListItemIcon>
          <Edit />
        </ListItemIcon>
        {t('common.edit') || 'Edit'}
      </MenuItem>,
      <MenuItem
        key={1}
        onClick={() => {
          setRowToDelete(row.original);
          setOpenAlert(true);
          closeMenu();
        }}
        sx={{ m: 0 }}
      >
        <ListItemIcon>
          <Send />
        </ListItemIcon>
        {t('common.delete') || 'Delete'}
      </MenuItem>,
      <MenuItem
        key={2}
        onClick={() => {
          getCongeReport(row.original);
          closeMenu();
        }}
        sx={{ m: 0 }}
      >
        <ListItemIcon>
          <PictureAsPdf />
        </ListItemIcon>
        {t('conge.actions.print') || 'Print'}
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
        const tableHeaders = [
          t('conge.orderNumber') || 'Order No',
          t('common.imputation') || 'Imputation',
          t('common.date') || 'Date',
          t('common.dateStart') || 'Start Date',
          t('common.dateEnd') || 'End Date',
          t('common.nbDays') || 'Nb.Days',
        ];
  
        autoTable(doc, {
          head: [tableHeaders],
          body: tableData,
        });
  
        doc.save('conges-pdf-export.pdf');
      };
      const logSelectedRows = () => {
        const selectedRows = table.getSelectedRowModel().flatRows.map((row) => row.original);
        console.log('Selected Rows:', selectedRows);
    
        selectedRows.forEach((row) => {
          console.log(`Employee: ${row.empcod}, N° Ordre: ${row.concod}, Nb. jours: ${row.connbjour}`);
        });
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
              onClick={() => {
                const selectedRows = table.getSelectedRowModel().flatRows.map((row) => row.original);
                logSelectedRows();  // Log the selected rows when button is clicked
                handleExportRows(selectedRows); // Export logic here
              }}     
              variant="contained"
            >
              {t('list.exportSelection') || 'Export selection'}
            </Button> 
          </Box>
        </Box>
      );
    },
    localization: {
      actions: t('common.actions') || 'Actions', // This changes the Action column's header name
    },
  });

 

  return (
    <Box>
          {  (isLoading)&&
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
            )}
            {error && (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                  }}
                >
                  <Typography color="error">
                    {error as any}
                  </Typography>
                </Box>
              )}


      <Box>
        <MaterialReactTable table={table} />
      </Box>

      {/* AlertModal for confirming deletion */}
      <AlertModal
        open={openAlert}
        onClose={() => setOpenAlert(false)}
        onConfirm={handleDelete}
        message={t('conge.confirmDelete', { order: rowToDelete?.concod }) || `Are you sure you want to delete this leave (Order No: ${rowToDelete?.concod})?`}
      />
        <Snackbar
               open={snackbarOpen}
               autoHideDuration={1000}
               onClose={handleSnackbarClose}
             >
               <Alert onClose={handleSnackbarClose} severity={snackbarSeverity}>
                 {snackbarMessage}
               </Alert>
             </Snackbar>
    </Box>
    
  );
};

export default TitreCongeList;
