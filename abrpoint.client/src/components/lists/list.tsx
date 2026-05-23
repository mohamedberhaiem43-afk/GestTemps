import { SetStateAction, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Box,
    Button,
    lighten,
    ListItemIcon,
    MenuItem,
    Snackbar,
} from '@mui/material';
import AlertModal from "../AlertModal/AlertModal";
import { Delete, DeleteSweep, Description, Edit, MedicalServices, Schedule, Work, WorkOutline } from "@mui/icons-material";
import {
    MaterialReactTable,
    useMaterialReactTable,
    MRT_GlobalFilterTextField,
    MRT_ToggleFiltersButton,
} from 'material-react-table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
type DataListProps = {
  data: any;
  columns: any;
  message: any;
  deleteMethod: any;
  idKey: any;
  refetchMethod: any;
  pageSize: number;
  reportGeneration1: any;
  reportGeneration2: any;
  reportGeneration3: any;
  reportGeneration4: any;
  purge: any;
  empHoraires: any;
  actions?: boolean;
  setData:any
  onRowClick?: (row: any) => void;
  // 2026-05-23 — Gating UI par permission. Si non passé, on garde le
  // comportement legacy (édition + suppression visibles) pour ne pas casser
  // les pages qui consomment encore DataList sans avoir migré. Les pages
  // qui veulent appliquer la matrice CAMD passent explicitement le résultat
  // de useAuth().hasPermission(...).
  canEdit?: boolean;
  canDelete?: boolean;
};

export default function DataList({ data, columns, message, deleteMethod, idKey,refetchMethod,setData,pageSize,purge,
                                    reportGeneration1,reportGeneration2,reportGeneration3,reportGeneration4,empHoraires,actions,onRowClick,
                                    canEdit = true, canDelete = true }: DataListProps)
{
    const [selectedRow, setSelectedRow] = useState<any>(null);
    const [openModal, setOpenModal] = useState(false);
    const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
    const [resMessage, setResMessage] = useState('');
    const [severity, setSeverity] = useState<'success'|'error'>('success');
    const { t } = useTranslation();

    const handleOpenModal = (row: SetStateAction<string | number | null>) => {
        setSelectedRow(row);
        setOpenModal(true);
    };
    const handleCloseModal = () => {
        setOpenModal(false);
        setSelectedRow(null);
    };
    function handleEdit(original: any) {
        if(original.concod)
            setData(original.concod);
        if(original.empcod)
            setData(original.empcod);
        else
            setData(original);
    }
    const confirmDelete = async () => {
    if (!selectedRow) return;

    try {
        await deleteMethod({ [idKey]: selectedRow[idKey] });
        await refetchMethod();
        handleCloseModal();
        handleSnackbarOpening(t('list.messages.deleteSuccess') || 'Deletion successful', 'success');
    } catch (error: any) {
        if (error?.response?.status === 403) {
        handleSnackbarOpening(t('list.messages.actionForbidden') || "Action forbidden: you don't have permission.", 'error');
        } else {
        handleSnackbarOpening(t('list.messages.deleteError') || 'Error during deletion', 'error');
        }
    }
    };


    const handleSnackbarOpening = (message:string, severity:'success'|'error') => {
        setResMessage(message);
        setSeverity(severity);
        setIsSnackbarOpen(true);
    };
    const handleSnackbarClose = () => {
        setIsSnackbarOpen(false);
    };

    const table = useMaterialReactTable({
        columns,
        data: Array.isArray(data) ? data : [],
        enableColumnFilterModes: true,
        enableColumnOrdering: true,
        enableGrouping: true,
        enableColumnPinning: true,
        enableFacetedValues: true,
        enableRowSelection: true,
        enableRowActions: actions,
        initialState: {
            showColumnFilters: false,
            showGlobalFilter: true,
            pagination: { pageIndex: 0, pageSize: pageSize },
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
            sx: { padding: '0px 0px' },
        },
        muiTableHeadCellProps: {
            sx: { fontSize: '0.7rem', padding: '0px 0px' },
        },
        muiTableBodyRowProps: ({ row }) => ({
            onClick: () => {
                if (onRowClick) {
                    onRowClick(row.original);
                }
                setSelectedRow(row.index); // ✅ Save clicked row ID for highlighting
            },
            sx: {
                cursor: onRowClick ? 'pointer' : 'default',
                backgroundColor: selectedRow === row.index ? '#e3f2fd' : 'inherit',
                '&:hover': {
                    backgroundColor: onRowClick ? '#f5f5f5' : 'inherit',
                },
            },
        }),

        renderRowActionMenuItems: ({ row, closeMenu }) => {
            // Edit/Delete sont insérés UNIQUEMENT si la permission est accordée.
            // null dans le tableau est filtré par .filter(Boolean) en bas — ne
            // produit pas de slot vide dans le menu MUI.
            const menuItems = [
                canEdit ? (
                    <MenuItem key="edit" onClick={() => {handleEdit(row.original);closeMenu()}} sx={{ m: 0 }}>
                        <ListItemIcon><Edit /></ListItemIcon>
                        {t('list.edit') || 'Edit'}
                    </MenuItem>
                ) : null,
                canDelete ? (
                    <MenuItem key="delete" onClick={() => { handleOpenModal(row.original); closeMenu(); }} sx={{ m: 0 }}>
                        <ListItemIcon><Delete /></ListItemIcon>
                        {t('list.delete') || 'Delete'}
                    </MenuItem>
                ) : null,
                purge && (
                    <MenuItem
                        key="contrat"
                        onClick={() => {
                            purge(row.original);
                            closeMenu();
                        }}
                        sx={{ m: 0 }}
                    >
                        <ListItemIcon><DeleteSweep /></ListItemIcon>
                        {t('list.purge') || 'Purge'}
                    </MenuItem>
                ),
                reportGeneration2 && (
                    <MenuItem
                        key="contrat"
                        onClick={() => {
                            reportGeneration2(row.original);
                            closeMenu();
                        }}
                        sx={{ m: 0 }}
                    >
                        <ListItemIcon><Description /></ListItemIcon>
                        {t('list.contract') || 'Contract'}
                    </MenuItem>
                ),
                reportGeneration1 && (
                    <MenuItem
                        key="attestation"
                        onClick={() => {
                            reportGeneration1(row.original);
                            closeMenu();
                        }}
                        sx={{ m: 0 }}
                    >
                        <ListItemIcon><WorkOutline /></ListItemIcon>
                        {t('list.workAttestation') || 'Work Attestation'}
                    </MenuItem>
                ),
                reportGeneration4 && (
                    <MenuItem
                        key="medicale"
                        onClick={() => {
                            reportGeneration4(row.original);
                            closeMenu();
                        }}
                        sx={{ m: 0 }}
                    >
                        <ListItemIcon><MedicalServices /></ListItemIcon>
                        {t('list.medicalVisit') || 'Medical Visit'}
                    </MenuItem>
                ),
                reportGeneration3 && (
                    <MenuItem
                        key="individuelle"
                        onClick={() => {
                            reportGeneration3(row.original);
                            closeMenu();
                        }}
                        sx={{ m: 0 }}
                    >
                        <ListItemIcon><Work /></ListItemIcon>
                        {t('list.individualSheet') || 'Individual Sheet'}
                    </MenuItem>
                ),
                empHoraires && (
                    <MenuItem
                        key="horaires"
                        onClick={() => {
                            empHoraires(row.original);
                            closeMenu();
                        }}
                        sx={{ m: 0 }}
                    >
                        <ListItemIcon><Schedule /></ListItemIcon>
                        {t('list.employeeHours') || 'Employee Hours'}
                    </MenuItem>
                ),
            ];
        
            // Remove undefined values before rendering
            return menuItems.filter(Boolean);
        },
        
            
        renderTopToolbar: ({ table }) => {
            const handleExportRows = (rows: any[]) => {
                const doc = new jsPDF();
                const tableData = rows.map((row: { [x: string]: any; }) => columns.map((col: { accessorKey: string | number; }) => row[col.accessorKey]));
                const tableHeaders = columns.map((col: { header: any; }) => col.header);

                autoTable(doc, { head: [tableHeaders], body: tableData });
                doc.save('export.pdf');
            };

            return (
                <Box sx={(theme) => ({
                    backgroundColor: lighten(theme.palette.background.default, 0.05),
                    display: 'flex',
                    gap: '0.5rem',
                    p: '8px',
                    justifyContent: 'space-between',
                })}>
                    <Box sx={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <MRT_GlobalFilterTextField table={table} />
                        <MRT_ToggleFiltersButton table={table} />
                    </Box>
                    <Box>
                        <Button
                            color="primary"
                            disabled={!table.getIsSomeRowsSelected()}
                            onClick={() => handleExportRows(table.getSelectedRowModel().flatRows.map(row => row.original))}
                            variant="contained"
                        >
                            {t('list.exportSelection') || 'Export selection'}
                        </Button>
                    </Box>
                </Box>
            );
        },
    });

    return (
        <>
            <MaterialReactTable table={table} />
            <AlertModal open={openModal} onClose={handleCloseModal} onConfirm={confirmDelete} message={message} />
            <Snackbar open={isSnackbarOpen} autoHideDuration={6000} onClose={handleSnackbarClose}>
                <Alert onClose={handleSnackbarClose} severity={severity}>{resMessage}</Alert>
            </Snackbar>
            
        </>
    );
}


