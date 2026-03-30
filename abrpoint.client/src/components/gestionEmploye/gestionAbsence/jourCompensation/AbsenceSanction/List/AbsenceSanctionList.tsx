import { useEffect, useMemo, useState } from 'react';
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
  CircularProgress,
  ListItemIcon,
  MenuItem,
  lighten,
} from '@mui/material';
import { Delete, Edit, PictureAsPdf } from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sanction } from '../../../../../../models/Sanction';
import AlertModal from '../../../../../AlertModal/AlertModal';
import CustomizedSnackbars from '../../../../../Snackbar/Snackbar';
import useGetSanctions from '../../../../../../hooks/sanctionHooks/useGetSanctions';
import useDeleteSanction from '../../../../../../hooks/sanctionHooks/useDeleteSanction';
import { useSanctionContext } from '../../../../../helper/SanctionContext';
import apiInstance from '../../../../../API/apiInstance';
import AbsenceReportService from '../../../../../../services/SanctionService/AbsenceReportService';
import ForbiddenMessage from '../../../../../AlertModal/ForbiddenMessage';
import axios from 'axios';
type SanctionsResponse = {
  data: Sanction[];
  message: string;
};
const AbsenceSanctionList = () => {
  const { setSelectedSanction } = useSanctionContext();
  const soccod = sessionStorage.getItem('soccod')||'';
  const [openModal, setOpenModal] = useState(false);  // Modal state
  const [sanctionToDelete, setSanctionToDelete] = useState<Sanction | null>(null);  // Selected contract to delete
  const [sanctions, setSanctions] = useState<Sanction[]>([]); // Local sanctions state

  const [showSuccessAlert, setShowSuccessAlert] = useState(false);  // State to show success alert

  const {mutate:deleteSanction} = useDeleteSanction();
   // Handle delete confirmation
   const handleDeleteConfirm = async () => {
      if (sanctionToDelete) {
      deleteSanction(
        { soccod, concod: sanctionToDelete.concod },
        {
          onSuccess() {
            setOpenModal(false);
            setSanctions((prev) =>
              prev.filter((s) => s.concod !== sanctionToDelete.concod)
            );
            setShowSuccessAlert(true);
          },
          onError(error) {
            console.error(error);
            setShowSuccessAlert(true);
            // tu peux utiliser un message différent :
            // setSnackbar({ open: true, message: "Erreur lors de la suppression", severity: "error" });
          },
        }
      );
    }
  };

  const getSanctionToEdit = (original: Sanction) =>{
    if(original.concod !=""){
      apiInstance.get(`/Sanctions/get-sanction/${soccod}/${original.concod}`)
      .then(res=>setSelectedSanction(res.data));
    }
  }
    const getSanctionRapport = async (soccod: string, empcod: string, concod: string) => {
      try {
          // Fetch the report as a Blob
          const response = await AbsenceReportService.getReport(`get-absence-report/${soccod}/${empcod}/${concod}`, 'blob');

          const blob = new Blob([response], { type: 'application/pdf' });
  
  
          // Create a temporary download link
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'Absence.pdf';
  
          // Trigger the download
          link.click();
  
          // Clean up the temporary URL
          window.URL.revokeObjectURL(url);
      } catch (error) {
          console.error('Error downloading the report:', error);
      }
  };
  const { data: sanctionsResponse = {} as SanctionsResponse, isLoading, isError, error } = useGetSanctions(soccod);
  useEffect(() => {
    if (sanctionsResponse && 'data' in sanctionsResponse) {
      setSanctions(sanctionsResponse.data);
    } else if (Array.isArray(sanctionsResponse)) {
      setSanctions(sanctionsResponse);
    }
  }, [sanctionsResponse]);

    const handleSnackbarClose = () => {
    setShowSuccessAlert(false);  // Reset Snackbar state after it closes
  };
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (isError && axios.isAxiosError(error)) {
      if (error.response?.status === 403) {
        setForbidden(true);
      }
    }
  }, [isError, error]);


  const columns = useMemo<MRT_ColumnDef<Sanction>[]>(
    () => [
      {
        id: 'sanctionDetails',
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
            size: 160,
          },
          {
            accessorKey: 'condat',
            header: 'Date',
            size: 100,
            Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleDateString(),
          },
          {
            accessorKey: 'abslib',
            header: 'Imputation',
            size: 100,
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
    ],
    [],
  );

  const table = useMaterialReactTable({
    columns,
    data: Array.isArray(sanctions) ? sanctions : [], // Safeguard against invalid data
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
      placeholder:'Chercher...',
      sx: {
        fontSize: '0.2rem', // Small font size
        minWidth: '100px', // Smaller width
        padding: '0px', // Reduce padding
        marginBottom: '20px', // Remove margin
        maxHeight:'5px',
        
      },
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
     
      <MenuItem key="edit" onClick={()=>{
        getSanctionToEdit(row.original);
        closeMenu();
        }} sx={{ m: 0 }}>
        <ListItemIcon>
          <Edit />
        </ListItemIcon>
        Editer
      </MenuItem>,
      <MenuItem key="delete" onClick={()=>{
        setSanctionToDelete(row.original);
        setOpenModal(true);
        closeMenu();
        }} sx={{ m: 0 }}>
        <ListItemIcon>
          <Delete />
        </ListItemIcon>
        Supprimer
      </MenuItem>,
      <MenuItem key="print" onClick={()=>{
        setSanctionToDelete(row.original);
        if(row.original.soccod && row.original.empcod && row.original.concod)
          getSanctionRapport(row.original.soccod,row.original.empcod,row.original.concod);
        closeMenu();
        }} sx={{ m: 0 }}>
        <ListItemIcon>
          <PictureAsPdf />
        </ListItemIcon>
        Imprimer
      </MenuItem>,
    ],
    renderTopToolbar: ({ table }) => {
      const handleExportRows = (rows: Sanction[]) => {
  const doc = new jsPDF();
  
  // Ensure all values are defined (replace undefined with empty strings)
  const tableData = rows.map((row) => [
    row.concod ?? '',
    row.empcod ?? '',
    row.condat ? new Date(row.condat).toLocaleDateString() : '',
    row.connbjour?.toString() ?? '0', // Convert number to string and provide default
  ]);

    const tableHeaders = ['N° Ordre', 'Employé', 'Date', 'Nb.jours'];

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      styles: {
        cellPadding: 3,
        fontSize: 8,
      },
    });

    doc.save('sanctions-pdf-export.pdf');
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
              size='small'
              
            >
              <FileDownloadIcon/>

            </Button>
          </Box>
        </Box>
      );
    },
    localization: {
      actions: 'Decision',
    },
  });
  
  
return (
  <Box>
    {/* Snackbar succès */}
    <CustomizedSnackbars
      open={showSuccessAlert}
      message="Sanction supprimée avec succès !"
      severity="success"
      onClose={handleSnackbarClose}
    />

    {/* Message d'interdiction */}
    {forbidden ? (
      <ForbiddenMessage message="Vous n'avez pas l'autorisation d'accéder à ces données." />
    ) : isLoading ? (
      <CircularProgress />
    ) : (
      <>
        <MaterialReactTable table={table} />
        <AlertModal
          open={openModal}
          onClose={() => setOpenModal(false)}
          onConfirm={handleDeleteConfirm}
          message="Voulez-vous vraiment supprimer cette sanction ?"
        />
      </>
    )}
  </Box>
);

};

export default AbsenceSanctionList;
