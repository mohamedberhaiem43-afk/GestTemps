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
  ListItemIcon,
  MenuItem,
  lighten,
} from '@mui/material';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Delete } from '@mui/icons-material';
import AlertModal from '../../AlertModal/AlertModal';
import CustomizedSnackbars from '../../Snackbar/Snackbar';
import useGetContrats from '../../../hooks/contratHooks/useGetContrats';
import useGetAllContrats from '../../../hooks/contratHooks/useGetAllContrats';
import useDeleteContrat from '../../../hooks/contratHooks/useDeleteContrat';
import ForbiddenMessage from '../../AlertModal/ForbiddenMessage';

type Contrat = {
  soccod: string;
  concod: string;
  empcod: string;
  condat?: Date | string;
  empemb?: Date | string;
  empsort?: Date | string;
  conmois?: number;
  contype?: string;
  sitcod?: string;
};
interface ListContratsProps{
  req:string,
  filters:any
}
const ListContrats = ({ req, filters }:ListContratsProps) => {
  const [openModal, setOpenModal] = useState(false);  
  const [contractToDelete, setContractToDelete] = useState<Contrat | null>(null);  
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);  
  const uticod = localStorage.getItem('Uticod')||'';
  const { data: allContracts, error } = useGetAllContrats("", "", { uticod });
  const [forbiddenError, setForbiddenError] = useState(false);
  const [forbiddenDeleteError, setForbiddenDeleteError] = useState(false);

  const { data: filteredContracts, error: filteredError } = useGetContrats(req, filters);

  
  const data = filters === undefined ? allContracts || [] : filteredContracts || [];
  
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
        return 'Unknown';
    }
  };
  const { mutate } = useDeleteContrat();
useEffect(() => {
  if (error?.message?.includes("403") || filteredError?.message?.includes("403")) {
    setForbiddenError(true);
  }
}, [error, filteredError]);

const handleDeleteConfirm = () => {
  if (contractToDelete) {
    mutate(
      { soccod: contractToDelete.soccod, concod: contractToDelete.concod },
      {
        onSuccess: () => {
          setOpenModal(false);
          setShowSuccessAlert(true);
        },
        onError: (error: any) => {
          console.error("Error deleting contract:", error);
          if (error?.response?.status === 403) {
            setForbiddenDeleteError(true);
          }
        },
      }
    );
  }
};

  const formatDate = (date?: Date | string) => {
    if (!date) return '';
    const parsedDate = new Date(date);
    return parsedDate.toLocaleDateString();
  };

  const columns = useMemo<MRT_ColumnDef<Contrat>[]>(() => {
    const baseColumns: MRT_ColumnDef<Contrat>[] = [
      {
        accessorKey: 'concod',
        header: 'N° Contrat',
        size: 100,
        enableEditing: false,
      },
      {
        accessorKey: 'empcod',
        header: 'Employé',
        size: 100,
        enableEditing: false,
      },
      {
        accessorKey: 'condat',
        header: 'Date',
        size: 100,
        Cell: ({ cell }) => formatDate(cell.getValue<string>()),
      },
      {
        accessorKey: 'empemb',
        header: 'Date Début',
        size: 100,
        Cell: ({ cell }) => formatDate(cell.getValue<string>()),
      },
      {
        accessorKey: 'empsort',
        header: 'Date Fin',
        size: 100,
        Cell: ({ cell }) => formatDate(cell.getValue<string>()),
      },
    ];

    // Conditionally add columns based on the `req` prop
    if (req !== "Contrats/get-list-echeance/01") {
      baseColumns.push(
        {
          accessorKey: 'conmois',
          header: 'Nb. Mois',
          size: 60,
        },
        {
          accessorKey: 'contype',
          header: 'Type Contrat',
          size: 100,
          Cell: ({ cell }) => formatContractType(cell.getValue<string>()), 
        },
        {
          accessorKey: 'sitcod',
          header: 'Statut',
          size: 100,
        }
      );
    }

    return baseColumns;
  }, [req]);

  const handleSnackbarClose = () => {
    setShowSuccessAlert(false);  
  };

  const table = useMaterialReactTable({
    columns,
    data,
    enableEditing: true,
    enableColumnFilterModes: true,
    enableColumnOrdering: true,
    enableGrouping: true,
    enableColumnPinning: true,
    enableFacetedValues: true,
    enableRowActions: false,

    enableRowSelection: req !== "Contrats/get-list-echeance/01",

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
      </MenuItem>,
    ],
    renderTopToolbar: ({ table }) => {
      const handleExportRows = (rows: Contrat[]) => {
      const doc = new jsPDF();

      const tableData = rows.map((row) => [
        row.concod ?? '',
        formatDate(row.condat),
        formatDate(row.empemb),
        formatDate(row.empsort),
        row.conmois ?? '',
        row.contype ?? '',
        row.sitcod ?? '',
      ]);

      let tableHeaders = ['N° Contrat', 'Date', 'Date Début', 'Date Fin'];
      if (!req.includes("Contrats/get-list-echeance/")) {
        tableHeaders = [...tableHeaders, 'Nb. Mois', 'Type Contrat', 'Statut'];
      }

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
          gap: '0.5rem',
          p: '8px',
          justifyContent: 'space-between',
          fontFamily: "'San Francisco', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",  // Apple font stack
          fontSize: "16px",  
          fontWeight: "400", 
          color: "#333",    
          lineHeight: "1.5", 
          })}
        >
          <Box sx={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <MRT_GlobalFilterTextField table={table} />
            <MRT_ToggleFiltersButton table={table} />
          </Box>
          {req !== "Contrats/get-list-echeance/01" && (
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
          )}
        </Box>
      );
    },
    
    // localization: {
    //   actions: 'Action',
    // },
  });

  return (
    <div >
      {showSuccessAlert && (
        <CustomizedSnackbars
              open={showSuccessAlert}
              message="Le contrat a été supprimé avec succès!"
              severity="success"
              onClose={handleSnackbarClose}
            />

      )}

      <div >
        <MaterialReactTable table={table} />
      </div>
      <AlertModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onConfirm={handleDeleteConfirm}
        message="Voulez-vous vraiment supprimer ce contrat ?"
      />
      {forbiddenDeleteError && (
      <ForbiddenMessage message="Vous n'avez pas les droits nécessaires pour supprimer ce contrat." />
    )}
    {forbiddenError && (
      <ForbiddenMessage message="Vous n'avez pas les droits nécessaires pour consulter les contrats." />
    )}


    </div>
  );
};

export default ListContrats;
