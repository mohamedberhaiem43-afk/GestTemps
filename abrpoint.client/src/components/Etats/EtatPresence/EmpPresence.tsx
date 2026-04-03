import { useMemo } from 'react';
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
  Skeleton,
  lighten,
} from '@mui/material';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Cancel, CheckCircle, Delete } from '@mui/icons-material';
import { useDateRange } from '../../Pointeuse/EtatPeriodique/FilterContext';
import EtatPresence from '../../../models/EtatPresece';
import useGetEtatPresence from '../../../hooks/presenceHooks/useGetEtatPresence';

const EmpPresence = () => {

  const { dateRange } = useDateRange() as { dateRange: { dateDebut: Date; dateFin: Date,selectedRegime:string,mois:string,empcods:string[] } };
const { data = [], isLoading } = useGetEtatPresence(
  dateRange.dateDebut, 
  dateRange.dateFin,
  dateRange.empcods,      // empcods should be 3rd parameter
  dateRange.selectedRegime // regime should be 4th parameter
  );
  const columns = useMemo<MRT_ColumnDef<EtatPresence>[]>(() => [
    {
      id: 'etat-presence',
      header: '',
      columns: [
        
        {
          accessorKey: 'empcod',
          header: 'Badge',
          size: 60,
          enableEditing: false,
        },
        {
            accessorKey: 'matricule',
            header: 'Matricule',
            size: 60,
          },
        {
          accessorKey: 'emplib',
          header: 'Nom et Prénom',
          size: 200,
        },
        {
          accessorKey: 'regime',
          header: 'Régime',
          size: 60,
        },
        {
        accessorFn: (row: EtatPresence) => {
            if (!row.predat) return '';
            const date = new Date(row.predat);
            return !isNaN(date.getTime()) ? date.toISOString().split('T')[0] : '';
          },
          accessorKey: 'predat',
          header: 'Date',
          size: 60,
        },
        {
            accessorKey: 'motif',
            header: 'Motif',
            size: 60,
        },     
        {
          accessorKey: 'entree1',
          header: 'Entrée1',
          size: 60,
        },
        {
          accessorKey: 'preretmateup',
          header: 'Retard',
          size: 60,
        },
        {
          accessorKey: 'sortie1',
          header: 'Sortie1',
          size: 60,
        },
        {
          accessorKey: 'preretmatsup',
          header: 'Avance',
          size: 60,
        },
        {
          accessorKey: 'entree2',
          header: 'Entrée2',
          size: 60,
        },
        {
          accessorKey: 'preretameup',
          header: 'Retard',
          size: 60,
        },
        {
          accessorKey: 'sortie2',
          header: 'Sortie2',
          size: 60,
        },
        {
          accessorKey: 'preretamsup',
          header: 'Avance',
          size: 60,
        },
                {
          accessorKey: 'allaitement',
          header: 'Allaitement',
          size: 60,
          Cell: ({ row }) => {
            return row.original.allaitement?  (
              <CheckCircle style={{ color: 'green' }} />
            ) : (
              <Cancel style={{ color: 'red' }} />
            );
          },
        },
       {
          accessorKey: 'hasConge',
          header: 'Congé',
          size: 60,
          Cell: ({ row }) => {
            return row.original.hasConge =="True"? (
              <CheckCircle style={{ color: 'green' }} />
            ) : (
              <Cancel style={{ color: 'red' }} />
            );
          },
        },
                {
            accessorKey: 'totalHeure',
            header: 'Total Heure',
            size: 60,
        },
        {
            accessorKey:'totalRetard',
            header: 'Total Retard',
            size: 60,

        },
        {
          accessorKey: 'tothnuit',
          header: 'Heure Nuit',
          size: 60,
        },
      ],
    },
  ], []);

  const table = useMaterialReactTable({
    columns,
    data,
    enableEditing: true,
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
      //columnPinning: {
        //left: ['mrt-row-expand', 'mrt-row-select'],
        //right: ['mrt-row-actions'],
      //},
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

    renderRowActionMenuItems: ({ closeMenu }) => [

      <MenuItem
        key={1}
        onClick={() => {
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
      const handleExportRows = (rows: any[]) => {
        const doc = new jsPDF();
        const tableData = rows.map((row) => [
          row.emplib, // Nom de l'employé
          new Date(row.predat).toLocaleDateString(), // Date formatée
          row.totalHeure, // Total Heures
          row.tothnuit, // Heures Nuit
        ]);
        const tableHeaders = ['Employé', 'Date', 'Total Heures', 'Heures Nuit'];

        autoTable(doc, {
          head: [tableHeaders],
          body: tableData,
        });

        doc.save('pointeuses-pdf-export.pdf');
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
  });

  return (
    <>
      {isLoading ? (
        <div>
          <Skeleton variant="rectangular" height={40} />
          <Skeleton variant="rectangular" height={40} style={{ marginTop: 10 }} />
          <Skeleton variant="rectangular" height={40} style={{ marginTop: 10 }} />
        </div>
      ) : (
        <div>
          <MaterialReactTable table={table} />
        </div>
      )}
    </>
  );
  
};

export default EmpPresence;
