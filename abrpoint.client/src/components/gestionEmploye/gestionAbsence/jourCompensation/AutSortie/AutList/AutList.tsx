import { useMemo, useState } from 'react';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
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
  lighten,
} from '@mui/material';
import { Delete, Edit, PictureAsPdf } from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Autoriser } from '../../../../../../models/Autoriser';
import AlertModal from '../../../../../AlertModal/AlertModal';
import CustomizedSnackbars from '../../../../../Snackbar/Snackbar';
import useGetSortie from '../../../../../../hooks/sortieHooks/useGetSortie';
import useDeleteSortie from '../../../../../../hooks/sortieHooks/useDeleteSortie';
import { useSortieGeneralContext } from '../../../../../helper/SortieGeneralContext';
import SortieService from '../../../../../../services/SortieService/SortieService';
import SortieReportService from '../../../../../../services/SortieService/SortieReportService';

const AutoriserList = () => {
  const { setSelectedSortieGeneral } = useSortieGeneralContext();
  const uticod = localStorage.getItem('Uticod');

  const [selectedAutoriser, setSelectedAutoriser] = useState<{ concod: string } | null>(null); // Track the selected Autoriser for deletion
  const [openModal, setOpenModal] = useState(false); // Track modal open state
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const {data = [],refetch} = useGetSortie(uticod);
  const {mutate:deleteSortie} = useDeleteSortie();

  const deleteAutoriser = (concod: string) => {
    deleteSortie({code:concod},
      {
        onSuccess() {
          setShowSuccessAlert(true);
          refetch();
        },
        onError() {
          
        },
      }
    )
  };

  const getAutorisationReport = async (soccod: string, concod: string) => {
    try {
        // Fetch the report as a Blob
        const response = await SortieReportService.getReport(`get-autorisation-report/${soccod}/${concod}`, 'blob');

        const blob = new Blob([response], { type: 'application/pdf' });


        // Create a temporary download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'AutorisationSortie.pdf';

        // Trigger the download
        link.click();

        // Clean up the temporary URL
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading the report:', error);
    }
};
  const getSortieToEdit= (soccod:string,original: Autoriser) => {
    if(original.concod !=""){
      const sortie = SortieService.getWithParams(`get-autorisation/${soccod}/${original.concod}`);
      sortie.then(res=>setSelectedSortieGeneral(res));
    }
  }

  const columns = useMemo<MRT_ColumnDef<Autoriser>[]>(() => [
    {
      id: 'autoriserDetails',
      header: '',
      columns: [
        {
          accessorKey: 'concod',
          header: 'N° Ordre',
          size: 60,
        },
        {
          accessorKey: 'emplib',
          header: 'Employé',
          size: 60,
        },
        {
         accessorKey: 'condat',
         header: 'Date',
         size: 160,
         Cell: ({ cell }) => {
           const value = cell.getValue<string | Date>(); // Explicitly type the value
           return new Date(value).toLocaleDateString('fr-FR');
         },
       },
       {
         accessorKey: 'abslib',
         header: 'Imputation',
         size: 60,
       },
       {
         accessorKey: 'condep',
         header: 'Date Départ',
         size: 60,
         Cell: ({ cell }) => {
           const value = cell.getValue<string | Date>(); // Explicitly type the value
           return new Date(value).toLocaleTimeString('fr-FR', {
             hour: '2-digit',
             minute: '2-digit',
             second: '2-digit',
           });
         },
       },
       {
         accessorKey: 'conret',
         header: 'Date Retour',
         size: 60,
         Cell: ({ cell }) => {
           const value = cell.getValue<string | Date>(); // Explicitly type the value
           return new Date(value).toLocaleTimeString('fr-FR', {
             hour: '2-digit',
             minute: '2-digit',
             second: '2-digit',
           });
         },
       },
        {
          accessorKey: 'connbjour',
          header: 'Nb.Heures',
          size: 60,
        },
      ],
    },
  ], []);
  const handleSnackbarClose = () => {
    setShowSuccessAlert(false);  // Reset Snackbar state after it closes
  };


  const table = useMaterialReactTable({
    columns,
    data,
    enableColumnFilterModes: true,
    enableColumnOrdering: true,
    enableGrouping: true,
    enableColumnPinning: true,
    enableFacetedValues: true,
    enableRowSelection: true,
    enableRowActions: true,
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
      key="edit"
      onClick={() => {
        getSortieToEdit(row.original.soccod || '', row.original)
        closeMenu();
      }}
      sx={{ m: 0 }}
    >
      <ListItemIcon>
        <Edit />
      </ListItemIcon>
        Editer
      </MenuItem>,
      <MenuItem
        key="delete"
        onClick={() => {
          setSelectedAutoriser({ concod: row.original.concod });
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
        key="report"
        onClick={() => {
          setSelectedAutoriser({ concod: row.original.concod });
          getAutorisationReport(row.original.soccod || '', row.original.concod);
          closeMenu();
        }}
        sx={{ m: 0 }}
      >
        <ListItemIcon>
          <PictureAsPdf />
        </ListItemIcon>
        Rapport
      </MenuItem>,
    
    ],
    renderTopToolbar: ({ table }) => {
      const handleExportRows = (rows: Autoriser[]) => {
    const doc = new jsPDF();
    
    // Filter out null/undefined values and convert to strings
    const tableData = rows.map((row) => [
      row.concod ?? '',
      row.condat ? new Date(row.condat).toLocaleDateString('fr-FR') : '',
      row.empcod ?? '',
      row.abscod ?? '',
      row.condep ? new Date(row.condep).toLocaleTimeString('fr-FR') : '',
      row.conret ? new Date(row.conret).toLocaleTimeString('fr-FR') : '',
      row.connbjour?.toString() ?? '',
    ]);

    const tableHeaders = [
      'N° Ordre', 
      'Date', 
      'Employé', 
      'Imputation', 
      'Date Départ', 
      'Date Retour', 
      'Nb.Heures'
    ];

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      styles: {
        cellPadding: 3,
        fontSize: 8,
        valign: 'middle',
        halign: 'center',
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
      },
    });

    doc.save('autoriser-pdf-export.pdf');
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
            <FileDownloadIcon/>
            </Button>
          </Box>
        </Box>
      );
    },
  });

  return (
    <Box >
      {showSuccessAlert && (
        <CustomizedSnackbars
          message="Autorisation de sortie supprimée avec succès !"
          onClose={handleSnackbarClose}
          open={showSuccessAlert}
          severity="success"
        />
      )}

      <div className="scrollable-table-container">
        <MaterialReactTable table={table} />
      </div>
      {/* Confirmation Modal */}
      {selectedAutoriser && (
        <AlertModal
          open={openModal}
          onClose={() => setOpenModal(false)} // Close modal without deleting
          onConfirm={() => {
            deleteAutoriser(selectedAutoriser.concod); // Perform delete action
            setOpenModal(false); // Close modal after deletion
          }}
          message="Vous etes sure de supprimer cette autorisation de sortie ?"
        />
      )}
    </Box>
  );
};

export default AutoriserList;
