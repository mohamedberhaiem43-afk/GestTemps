import React, { useEffect, useMemo, useState, useContext } from 'react';
import { MaterialReactTable, useMaterialReactTable, type MRT_Row, MRT_RowSelectionState, MRT_GlobalFilterTextField, MRT_ToggleFiltersButton, MRT_ColumnDef } from 'material-react-table';
import { Box, Button, lighten, ListItemIcon, MenuItem } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import useGetAllaitement from '../../../hooks/allaitementHooks/useGetAllaitement';
import { AllaitementDto } from '../../../models/Allaitement';
import { Delete, Edit } from '@mui/icons-material';
import PersonIcon from '@mui/icons-material/Person';
import useDeleteAllaitement from '../../../hooks/allaitementHooks/useDeleteAllaitement';
import AlertModal from '../../AlertModal/AlertModal';
import CustomizedSnackbars from '../../Snackbar/Snackbar';
import { useAllaitementContext } from '../../helper/AllaitementContext';
import { EmployeeContext } from '../../Pointeuse/EtatPeriodique/EmployeeContext';
import ForbiddenMessage from '../../AlertModal/ForbiddenMessage';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const formatDate = (date?: Date | string) => {
    if (!date) return '';
    const parsedDate = new Date(date);
    return parsedDate.toLocaleDateString();
  };
export const ListAllaitement: React.FC = () => {
  const { setSelectedAllaitement } = useAllaitementContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setSelectedEmpMat } = useContext(EmployeeContext);
  const [rowSelection, setRowSelection] = useState<MRT_RowSelectionState>({});
  const [AllaitementToDelete, setAllaitementToDelete] = useState<{soccod:string,concod:string}| null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [forbiddenError, setForbiddenError] = useState(false);
  const [forbiddenDeleteError, setForbiddenDeleteError] = useState(false);

  const { data = [], error, refetch } = useGetAllaitement();
  const{ mutate:deleteAllaitement } = useDeleteAllaitement();

  // Helper to navigate to employee management
  const manageEmployee = (empcod: string) => {
    setSelectedEmpMat(empcod);
    navigate('/gestion-employe');
  };
  
  const getAllaitementToEdit = (original: AllaitementDto) =>{
    const selectedAllaitement = data.find((allaitement:any)=>allaitement.concod == original.concod);
    if(selectedAllaitement){
      setSelectedAllaitement(selectedAllaitement);
    }

  }
    // 🔒 Détection des erreurs 403 lors du fetch
    useEffect(() => {
      if (error instanceof Error && error.message.includes("403")) {
        setForbiddenError(true);
        setTimeout(() => setForbiddenError(false), 5000);
      }
    }, [error]);

  const handleSnackbarClose = () => {
    setShowSuccessAlert(false);  // Reset Snackbar state after it closes
  };
  const columns = useMemo<MRT_ColumnDef<any>[]>(
    () => [
      {
        accessorKey: 'concod',
        header: t('allaitement.list.order') || 'N°Ordre',
        size: 60,
      },
      {
        accessorKey: 'empcod',
        header: t('allaitement.list.code') || 'Code',
        size: 100,
      },
      {
        accessorKey: 'emplib',
        header: t('allaitement.list.name') || 'Nom et Prénom',
        size: 150,
      },
      {
        accessorKey: 'condep',
        header: t('allaitement.list.startDate') || 'Date Début',
        size: 100,
        Cell: ({ cell }) => formatDate(cell.getValue<string>()),
      },
      {
        accessorKey: 'conret',
        header: t('allaitement.list.endDate') || 'Date Fin',
        size: 100,
        Cell: ({ cell }) => formatDate(cell.getValue<string>()),
      },
      {
        accessorKey: 'lundi',
        header: t('allaitement.form.monday') || 'Lundi',
        size: 60,
      },
      {
        accessorKey: 'mardi',
        header: t('allaitement.form.tuesday') || 'Mardi',
        size: 60,
      },
      {
        accessorKey: 'mercredi',
        header: t('allaitement.form.wednesday') || 'Mercredi',
        size: 60,
      },
      {
        accessorKey: 'jeudi',
        header: t('allaitement.form.thursday') || 'Jeudi',
        size: 60,
      },
      {
        accessorKey: 'vendredi',
        header: t('allaitement.form.friday') || 'Vendredi',
        size: 60,
      },
      {
        accessorKey: 'samedi',
        header: t('allaitement.form.saturday') || 'Samedi',
        size: 60,
      },
      {
        accessorKey: 'conjour',
        header: t('allaitement.list.period') || 'Période',
        size: 60,
      },
    ],
    [t]
  );

  

  const deleteAllaitementFunction = (soccod: string, concod: string) => {
  deleteAllaitement(
    { soccod, concod },
    {
      onSuccess() {
        setShowSuccessAlert(true);
        refetch();
      },
      onError(error: any) {
        // Check if it's a 403 Forbidden error
        if (error?.response?.status === 403 || error?.message?.includes('403')) {
          setForbiddenDeleteError(true);
        }
      },
    }
  );
};


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
      {t('allaitement.actions.edit') || 'Edit'}
    </MenuItem>,
      <MenuItem
        key="manage"
        onClick={() => {
          manageEmployee(row.original.empcod);
          closeMenu();
        }}
        sx={{ m: 0 }}
      >
        <ListItemIcon>
          <PersonIcon />
        </ListItemIcon>
        {t('allaitement.actions.manage') || 'Gérer Employé'}
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
        {t('allaitement.actions.delete') || 'Supprimer'}
      </MenuItem>,
    ],
    renderTopToolbar: ({ table }) => {
      const handleExportRows = (rows: any) => {
        const doc = new jsPDF();
        const tableData = rows.map((row:any) => [
          row.original.concod,  // N°Ordre
          row.original.empcod,  // Femme (Employee Code)
          new Date(row.original.condat).toLocaleDateString(),  // Date
          new Date(row.original.condep).toLocaleString(),  // Date Départ
          new Date(row.original.conret).toLocaleString(),  // Date Retour
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
          {t('allaitement.list.exportAll') || 'Export Tous les ligne en PDF'}
        </Button>
        <Button
          disabled={table.getRowModel().rows.length === 0}
          onClick={() => handleExportRows(table.getRowModel().rows)}
          startIcon={<FileDownloadIcon />}
        >
          {t('allaitement.list.exportPage') || 'Export Lignes de Page'}
        </Button>
        <Button
          disabled={
            !table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()
          }
          onClick={() => handleExportRows(table.getSelectedRowModel().rows)}
          startIcon={<FileDownloadIcon />}
        >
          {t('allaitement.list.exportSelected') || 'Export Ligne(s) Selectionée'}
        </Button>
      </Box>
    ),
  });

 
  
  return (
    <Box>
      {showSuccessAlert && (
          <CustomizedSnackbars
            open={showSuccessAlert}
            message="Allaitement a été supprimée avec succès!"
            severity="success"
            onClose={handleSnackbarClose}
          />
        )}
        {forbiddenError && (
        <ForbiddenMessage message="Vous n'avez pas les droits nécessaires pour consulter ces données." />
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
      {forbiddenDeleteError && (
        <ForbiddenMessage message="Vous n'avez pas les droits nécessaires pour supprimer ces données." />
      )}

    </Box>
  );
};

export default ListAllaitement;
