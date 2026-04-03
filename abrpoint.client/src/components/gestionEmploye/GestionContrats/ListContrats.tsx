import { useEffect, useMemo, useState } from 'react';
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
  Chip,
  ListItemIcon,
  MenuItem,
  Typography,
  lighten,
} from '@mui/material';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Autorenew, Delete, Edit } from '@mui/icons-material';
import AlertModal from '../../AlertModal/AlertModal';
import CustomizedSnackbars from '../../Snackbar/Snackbar';
import useGetContrats from '../../../hooks/contratHooks/useGetContrats';
import useGetAllContrats from '../../../hooks/contratHooks/useGetAllContrats';
import useDeleteContrat from '../../../hooks/contratHooks/useDeleteContrat';
import ForbiddenMessage from '../../AlertModal/ForbiddenMessage';
import { useAuth } from '../../helper/AuthProvider';
import { Contrat } from '../../../models/Contrat';

interface ListContratsProps {
  req: string;
  filters?: { srvcod?: string; sitcod?: string; echdeb?: string; echfin?: string };
  onEdit?: (contract: Contrat) => void;
  onRenew?: (contract: Contrat) => void;
  allowDelete?: boolean;
}

const ListContrats = ({ req, filters, onEdit, onRenew, allowDelete = true }: ListContratsProps) => {
  const [openModal, setOpenModal] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<Contrat | null>(null);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const { uticod } = useAuth();
  const { data: allContracts, error } = useGetAllContrats('', '', { uticod: uticod || '' });
  const { data: filteredContracts, error: filteredError } = useGetContrats(req, filters);
  const { mutate } = useDeleteContrat();
  const [forbiddenError, setForbiddenError] = useState(false);
  const [forbiddenDeleteError, setForbiddenDeleteError] = useState(false);
  const { soccod } = useAuth();
  const data = filters ? filteredContracts || [] : allContracts || [];
  const hasActions = Boolean(onEdit || onRenew || allowDelete);

  useEffect(() => {
    if ((error instanceof Error && error.message.includes('403')) || (filteredError instanceof Error && filteredError.message.includes('403'))) {
      setForbiddenError(true);
    }
  }, [error, filteredError]);

  const formatContractType = (type?: string) => {
    switch (type) {
      case '0':
        return 'CDD';
      case '1':
        return 'CDI';
      case '2':
        return 'Ouvrier';
      case '3':
        return 'CIVP';
      default:
        return type || '-';
    }
  };

  const formatDate = (date?: Date | string) => {
    if (!date) return '';
    const parsedDate = new Date(date);
    return Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.toLocaleDateString();
  };

  const handleDeleteConfirm = () => {
    if (!contractToDelete) {
      return;
    }

    mutate(
      { soccod: contractToDelete.soccod, concod: contractToDelete.concod },
      {
        onSuccess: () => {
          setOpenModal(false);
          setShowSuccessAlert(true);
        },
        onError: (deleteError: any) => {
          console.error('Error deleting contract:', deleteError);
          if (deleteError?.response?.status === 403) {
            setForbiddenDeleteError(true);
          }
        },
      }
    );
  };

  const columns = useMemo<MRT_ColumnDef<Contrat>[]>(() => {
    const baseColumns: MRT_ColumnDef<Contrat>[] = [
      {
        accessorKey: 'concod',
        header: 'No Contrat',
        size: 120,
      },
      {
        accessorKey: 'empcod',
        header: 'Employe',
        size: 140,
      },
      {
        accessorKey: 'condat',
        header: 'Date contrat',
        size: 120,
        Cell: ({ cell }) => formatDate(cell.getValue<string>()),
      },
      {
        accessorKey: 'empemb',
        header: 'Date debut',
        size: 120,
        Cell: ({ cell }) => formatDate(cell.getValue<string>()),
      },
      {
        accessorKey: 'empsort',
        header: 'Date fin',
        size: 120,
        Cell: ({ cell }) => formatDate(cell.getValue<string>()),
      },
    ];

    if (req !== `Contrats/get-list-echeance/${soccod}`) {
      baseColumns.push(
        {
          accessorKey: 'conmois',
          header: 'Nb. mois',
          size: 80,
        },
        {
          accessorKey: 'contype',
          header: 'Type contrat',
          size: 120,
          Cell: ({ cell }) => (
            <Chip label={formatContractType(cell.getValue<string>())} size="small" variant="outlined" />
          ),
        },
        {
          accessorKey: 'sitcod',
          header: 'Site',
          size: 80,
        }
      );
    }

    return baseColumns;
  }, [req]);

  const table = useMaterialReactTable({
    columns,
    data,
    enableEditing: false,
    enableColumnFilterModes: true,
    enableColumnOrdering: true,
    enableGrouping: true,
    enableColumnPinning: true,
    enableFacetedValues: true,
    enableRowActions: hasActions,
    enableRowSelection: req !== 'Contrats/get-list-echeance/01',
    initialState: {
      showColumnFilters: false,
      showGlobalFilter: true,
      pagination: { pageIndex: 0, pageSize: 5 },
      columnPinning: {
        left: ['mrt-row-expand', 'mrt-row-select'],
        right: hasActions ? ['mrt-row-actions'] : [],
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
        padding: '4px 8px',
      },
    },
    muiTableHeadCellProps: {
      sx: {
        fontSize: '0.78rem',
        padding: '6px 8px',
      },
    },
    renderRowActionMenuItems: hasActions
      ? ({ closeMenu, row }) => {
          const items = [] as JSX.Element[];

          if (onEdit) {
            items.push(
              <MenuItem
                key="edit"
                onClick={() => {
                  onEdit(row.original);
                  closeMenu();
                }}
                sx={{ m: 0 }}
              >
                <ListItemIcon>
                  <Edit />
                </ListItemIcon>
                Editer
              </MenuItem>
            );
          }

          if (onRenew) {
            items.push(
              <MenuItem
                key="renew"
                onClick={() => {
                  onRenew(row.original);
                  closeMenu();
                }}
                sx={{ m: 0 }}
              >
                <ListItemIcon>
                  <Autorenew />
                </ListItemIcon>
                Renouveler
              </MenuItem>
            );
          }

          if (allowDelete) {
            items.push(
              <MenuItem
                key="delete"
                onClick={() => {
                  setContractToDelete(row.original);
                  setOpenModal(true);
                  closeMenu();
                }}
                sx={{ m: 0 }}
              >
                <ListItemIcon>
                  <Delete />
                </ListItemIcon>
                Supprimer
              </MenuItem>
            );
          }

          return items;
        }
      : undefined,
    renderTopToolbar: ({ table }) => {
      const handleExportRows = (rows: Contrat[]) => {
        const doc = new jsPDF();
        const tableData = rows.map((row) => [
          row.concod ?? '',
          row.empcod ?? '',
          formatDate(row.condat),
          formatDate(row.empemb),
          formatDate(row.empsort),
          row.conmois ?? '',
          formatContractType(row.contype),
          row.sitcod ?? '',
        ]);

        const tableHeaders = ['No Contrat', 'Employe', 'Date', 'Date debut', 'Date fin', 'Nb. mois', 'Type', 'Site'];

        autoTable(doc, {
          head: [tableHeaders],
          body: tableData,
        });

        doc.save('contrats-pdf-export.pdf');
      };

      return (
        <Box
          sx={(theme) => ({
            backgroundColor: lighten(theme.palette.background.default, 0.05),
            display: 'flex',
            gap: '0.75rem',
            p: '12px',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            borderRadius: 2,
          })}
        >
          <Box sx={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <MRT_GlobalFilterTextField table={table} />
            <MRT_ToggleFiltersButton table={table} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {data.length} contrat(s)
            </Typography>
            {req !== 'Contrats/get-list-echeance/01' && (
              <Button
                color="primary"
                disabled={!table.getIsSomeRowsSelected()}
                onClick={() => handleExportRows(table.getSelectedRowModel().flatRows.map((row) => row.original))}
                variant="contained"
              >
                Exporter la selection
              </Button>
            )}
          </Box>
        </Box>
      );
    },
  });

  return (
    <div>
      {showSuccessAlert && (
        <CustomizedSnackbars
          open={showSuccessAlert}
          message="Le contrat a ete supprime avec succes !"
          severity="success"
          onClose={() => setShowSuccessAlert(false)}
        />
      )}

      <MaterialReactTable table={table} />

      <AlertModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onConfirm={handleDeleteConfirm}
        message="Voulez-vous vraiment supprimer ce contrat ?"
      />

      {forbiddenDeleteError && (
        <ForbiddenMessage message="Vous n'avez pas les droits necessaires pour supprimer ce contrat." />
      )}
      {forbiddenError && (
        <ForbiddenMessage message="Vous n'avez pas les droits necessaires pour consulter les contrats." />
      )}
    </div>
  );
};

export default ListContrats;
