import React, { useMemo, useState } from 'react';
import { MaterialReactTable, useMaterialReactTable, type MRT_Row, createMRTColumnHelper, MRT_RowSelectionState, MRT_GlobalFilterTextField, MRT_ToggleFiltersButton } from 'material-react-table';
import { Box, Button, lighten, ListItemIcon, MenuItem } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import useGetAllaitement from '../../../hooks/allaitementHooks/useGetAllaitement';
import AllaitementModel, { AllaitementDto } from '../../../models/Allaitement';
import { Delete, Edit } from '@mui/icons-material';
import useDeleteAllaitement from '../../../hooks/allaitementHooks/useDeleteAllaitement';
import AlertModal from '../../AlertModal/AlertModal';
import CustomizedSnackbars from '../../Snackbar/Snackbar';
import { useAllaitementContext } from '../../helper/AllaitementContext';

const columnHelper = createMRTColumnHelper<AllaitementDto>();

export const ListAllaitement: React.FC = () => {
  const { setSelectedAllaitement } = useAllaitementContext();
  const soccod = sessionStorage.getItem('soccod')||'';
  const [rowSelection, setRowSelection] = useState<MRT_RowSelectionState>({});
  const [AllaitementToDelete, setAllaitementToDelete] = useState<{soccod:string,concod:string}| null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);

  const {data = [], refetch} = useGetAllaitement(soccod);
  const{mutate:deleteAllaitement} = useDeleteAllaitement();
 
  
  const getAllaitementToEdit = (original: AllaitementDto) =>{
    const selectedAllaitement = data.find((allaitement:AllaitementDto)=>allaitement.concod == original.concod);
    if(selectedAllaitement)
      setSelectedAllaitement(selectedAllaitement);
  }
 
  const handleSnackbarClose = () => {
    setShowSuccessAlert(false);  // Reset Snackbar state after it closes
  };
  const columns = useMemo(() => [
    columnHelper.accessor('concod', {
      header: 'N°Ordre',
      size: 60,
    }),
    columnHelper.accessor('empcod', {
      header: 'Code',
      size: 100,
    }),
    columnHelper.accessor('emplib', {
      header: 'Nom et Prénom',
      size: 100,
    }),
    columnHelper.accessor('condat', {
      header: 'Date',
      size: 100,
      Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleDateString(),
    }),
    columnHelper.accessor('condep', {
      header: 'Date Départ',
      size: 100,
      Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleDateString(), // Updated to remove time
    }),
    columnHelper.accessor('conret', {
      header: 'Date Retour',
      size: 100,
      Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleDateString(), // Updated to remove time
    }),
    columnHelper.accessor('lundi', {
      header: 'Lundi',
      size: 60,
    }),
    {
      accessorKey: 'mardi',
      header: 'Mardi',
      size: 60,
    },
    {
      accessorKey: 'mercredi',
      header: 'Mercredi',
      size: 60,
    },
    {
      accessorKey: 'jeudi',
      header: 'Jeudi',
      size: 60,
    },
    {
      accessorKey: 'vendredi',
      header: 'Vendredi',
      size: 60,
    },
    {
      accessorKey: 'samedi',
      header: 'Samedi',
      size: 60,
    },
    {
      accessorKey: 'conjour',
      header: 'Période',
      size: 60,
    },
  ], []);
  
 const deleteAllaitementFunction = (soccod:string ,concod:string )=>{
  deleteAllaitement({ soccod, concod }, {
  onSuccess() {
    setShowSuccessAlert(true);
    refetch();
  },
});
 }
  const handleExportRows = (rows: MRT_Row<AllaitementDto>[]) => {
    const doc = new jsPDF();

    // Get table headers from columns
    const tableHeaders = columns.map((c) => c.header);

    // Map the data to match column order
    const tableData = rows.map((row) => [
      row.original.concod,  // N°Ordre
      row.original.empcod,  // Femme (Employee Code)
      new Date(row.original.condat).toLocaleDateString(),  // Date
      new Date(row.original.condep).toLocaleString(),  // Date Départ
      new Date(row.original.conret).toLocaleString(),  // Date Retour
    ]);

    // Use autoTable to generate the PDF
    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
    });

    // Save the PDF
    doc.save('allaitement-pdf-export.pdf');
  };


  const table = useMaterialReactTable({
    columns,
    data,
    enableRowSelection: true,
    getRowId: (row) => row.concod,
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
    columnFilterDisplayMode: 'popover',
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
        getAllaitementToEdit(row.original);
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
          setAllaitementToDelete({ soccod: row.original.soccod, concod: row.original.concod });
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
      const handleExportRows = (rows: AllaitementModel[]) => {
        const doc = new jsPDF();
        const tableData = rows.map((row) => [
          row.concod,
          row.condat,
          row.empcod,
          row.condep,
          row.conret,
        ]);
        const tableHeaders = ['N° Ordre', 'Date', 'Employé', 'Imputation', 'Date Départ', 'Date Retour', 'Nb.Heures'];

        autoTable(doc, {
          head: [tableHeaders],
          body: tableData,
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

    renderTopToolbarCustomActions: ({ table }) => (
      <Box
        sx={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <Button
          disabled={table.getPrePaginationRowModel().rows.length === 0}
          onClick={() =>
            handleExportRows(table.getPrePaginationRowModel().rows)
          }
          startIcon={<FileDownloadIcon />}
        >
          Export Tous les ligne en PDF
        </Button>
        <Button
          disabled={table.getRowModel().rows.length === 0}
          onClick={() => handleExportRows(table.getRowModel().rows)}
          startIcon={<FileDownloadIcon />}
        >
          Export Lignes de Page
        </Button>
        <Button
          disabled={
            !table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()
          }
          onClick={() => handleExportRows(table.getSelectedRowModel().rows)}
          startIcon={<FileDownloadIcon />}
        >
          Export Ligne(s) Selectionée
        </Button>
      </Box>
    ),
  });

 
  
  return (
    <Box>
      {showSuccessAlert && (
          <CustomizedSnackbars
            open={showSuccessAlert}
            message="Autorisation de sortie a été supprimée avec succès!"
            severity="success"
            onClose={handleSnackbarClose}
          />
        )}
      <MaterialReactTable table={table} />
      {rowSelection && (
        <AlertModal
          open={openModal}
          onClose={() => setOpenModal(false)} // Close modal without deleting
          onConfirm={() => {
            deleteAllaitementFunction(AllaitementToDelete?.soccod||'', AllaitementToDelete?.concod||''); // Perform delete action
            setOpenModal(false); // Close modal after deletion
          }}
          message="Vous etes sure de supprimer cette allaitement?"
        />
      )}
    </Box>
  );
};

export default ListAllaitement;
