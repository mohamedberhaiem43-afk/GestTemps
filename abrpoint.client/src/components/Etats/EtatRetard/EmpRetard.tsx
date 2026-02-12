import {  useMemo } from 'react';
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
import { Delete } from '@mui/icons-material';
import useGetPresence from '../../../hooks/presenceHooks/useGetPresence';
import { useDateRange } from '../../Pointeuse/EtatPeriodique/FilterContext';

const EmpRetard = () => {
  const { dateRange } = useDateRange();
  const { data = [], isLoading } = useGetPresence(dateRange.dateDebut, dateRange.dateFin,dateRange.selectedRegime,dateRange.empcods);
   const computeTotal = useMemo(() => {
    return (row: any) => {
      const toMin = (t: string) => {
        if (!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };

      let total =
        toMin(row.preretmateup) +
        toMin(row.preretameup);

      if (dateRange?.compterAvance) {
        total += toMin(row.preretmatsup) + toMin(row.preretamsup);
      }

      const h = Math.floor(total / 60).toString().padStart(2, '0');
      const m = (total % 60).toString().padStart(2, '0');

      console.log(dateRange.compterAvance)
      return `${h}:${m}`;
    };
  }, [dateRange.compterAvance]);

  const dataWithTotal = useMemo(() => {
  return data.map(row => ({
    ...row,
    totalRetard: computeTotal(row),
  }));
}, [data, computeTotal]);


const columns = useMemo<MRT_ColumnDef<any>[]>(() => {
  const baseColumns: MRT_ColumnDef<any>[] = [
    { accessorKey: 'empcod', header: 'Badge', size: 60 },
    { accessorKey: 'empmat', header: 'Matricule', size: 60 },
    { accessorKey: 'emplib', header: 'Nom et Prénom', size: 180 },
    { accessorKey: 'regime', header: 'Régime', size: 60 },
    { accessorFn: (row) => new Date(row.predat).toISOString().split('T')[0], accessorKey: 'predat', header: 'Date', size: 60 },

    { accessorKey: 'entree1', header: 'Entrée Matin', size: 60 },
    { accessorKey: 'preretmateup', header: 'Retard Matin', size: 60 },
    { accessorKey: 'sortie1', header: 'Sortie Matin', size: 60 },

    // **Insérer Avance Matin ici**
    ...(dateRange.compterAvance ? [{ accessorKey: 'preretmatsup', header: 'Avance Matin', size: 60 }] : []),

    { accessorKey: 'entree2', header: 'Entrée Après-midi', size: 60 },
    { accessorKey: 'preretameup', header: 'Retard Après-midi', size: 60 },
    { accessorKey: 'sortie2', header: 'Sortie Après-midi', size: 60 },

    // **Insérer Avance Après-midi ici**
    ...(dateRange.compterAvance ? [{ accessorKey: 'preretamsup', header: 'Avance Après-midi', size: 60 }] : []),

    { accessorKey: 'totalRetard', header: 'Total Retard', size: 10 },
  ];

  return baseColumns;
}, [dateRange.compterAvance]);


  const table = useMaterialReactTable({
    columns,
    data: dataWithTotal,
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
    muiTableBodyCellProps: ({ column }) => ({
        sx: {
          padding: '0px 0px',
          ...(column.id === 'totalRetard' && {
            backgroundColor: 'tomato', // Fond jaune pour toute la colonne
            color: '#fff', // Texte en rouge
            fontWeight: 'bold', // Optionnel : texte en gras pour le rendre plus visible
          }),
        },
      }),
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

export default EmpRetard;
