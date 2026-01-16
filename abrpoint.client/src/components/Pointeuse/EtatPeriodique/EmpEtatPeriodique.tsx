import { useMemo, useState, useContext } from 'react';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { Box, Checkbox, CircularProgress, Dialog, DialogContent, DialogTitle, FormControl, IconButton, InputLabel, MenuItem, Select, Tooltip, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EmployeeContext } from './EmployeeContext';
import { useDateRange } from './FilterContext';
import useUpdatePresence from '../../../hooks/presenceHooks/useUpdatePresence';
import useGetEmpEtat from '../../../hooks/presenceHooks/useGetEmpEtat';
import SaisieAbsence from './SaisieAbsence';
import SaisieConge from './SaisieConge';
import SaisieAutorisation from './SaisieAutorisation';
import EmpEtat from '../../../models/EmpEtat';
import { useAuth } from '../../helper/AuthProvider';
import OptimisationPointage from '../Optimisation/OptimisationPointage';
import type {
  MRT_Cell,
  MRT_Column,
  MRT_Row,
  MRT_TableInstance,
} from 'material-react-table';



const Example = ({ empetat }: { empetat: EmpEtat[] }) => {
  const [validationErrors, setValidationErrors] = useState<Record<string, string | undefined>>({});
  const {mutate:updatePresence} = useUpdatePresence(); 
  const { soccod } = useAuth();
  
  const formatDateToLocalISO = (date: Date): string => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISODate = new Date(date.getTime() - tzOffset).toISOString().slice(0, -1);
    return localISODate;
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<EmpEtat | null>(null);
  const [motif, setMotif] = useState<string>('');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const { setSelectedEmpPoste,setDate,setSelectedEmp,setArrondi,setArrondiSup } = useContext(EmployeeContext);

  const handleSaveRow = async ({
    values,
    table,
  }: {
    values: Record<string, any>;
    table: any;
  }) => {
    setValidationErrors({});
    if (!soccod) {
        return;
    }

    const presenceData = {
        predat: formatDateToLocalISO(new Date(values.predat)),
        preentamidiup: values.preentamidiup || "",
        preentmatup: values.preentmatup || "",
        preentsupup: values.preentsupup || "",
        prerepas: values.prerepas || 0,
        prerepos: values.prerepos || "0",
        presortamidiup: values.presortamidiup || "",
        presortmatup: values.presortmatup || "",
        presortsupup: values.presortsupup || "",
        tothnuit: values.tothnuit || "",
        tothre: values.tothre || "",
      };
    
    const encodedPredat = encodeURIComponent(presenceData.predat);
    
    updatePresence(
        { soccod, empcod: empetat[0].empcod, predat: encodedPredat, presence: presenceData },
        {
            onSuccess: () => {
            },
            onError: (error) => {
                console.error("Erreur lors de la mise à jour:", error);
            },
        }
    );

    table.setEditingRow(null);
  };
  
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setMotif('');
    setSelectedRow(null);
  };

  const handleOpenDialog = (row: EmpEtat, selectedMotif?: string) => {
    setSelectedRow(row);
    setDialogOpen(true);
    if (selectedMotif) {
      setMotif(selectedMotif);
    }
  };

  const columns = useMemo<any[]>(() => [
    {
      accessorKey: 'predat',
      header: 'Date',
      size: 80,
      Cell: ({ cell }: { cell: import('material-react-table').MRT_Cell<EmpEtat> }) => {
        const dateValue = cell.getValue();
        return (typeof dateValue === 'string' || typeof dateValue === 'number' || dateValue instanceof Date)
          ? new Date(dateValue).toLocaleDateString()
          : '';
      },
    },
    {
      header: 'Journée',
      accessorFn: (row: EmpEtat) => {
        const date = new Date(row.predat);
        return isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR', { weekday: 'long' });
      },
      id: 'journee',
      size: 30,
    },
    {
      accessorKey: 'prerepos',
      header: 'Rep',
      size: 10,
      Cell: ({ row }: { row: MRT_Row<EmpEtat> }) => (
        <Checkbox
          size="small"
          checked={row.getValue('prerepos') === '1'}
          disabled
        />
      ),
      Edit: ({
        column,
        row,
        table,
      }: {
        cell: MRT_Cell<EmpEtat>;
        column: MRT_Column<EmpEtat>;
        row: MRT_Row<EmpEtat>;
        table: MRT_TableInstance<EmpEtat>;
      }) => (
        <Checkbox
          size="small"
          checked={row.getValue(column.id) === '1'}
          onChange={(e) => {
            row._valuesCache[column.id] = e.target.checked ? '1' : '0';
            table.setEditingRow(row);
          }}
        />
      ),
    },
    {
      accessorKey: 'preentmatup',
      header: 'Entrée1',
      size: 30,
      muiEditTextFieldProps: {
        type: 'time',
        required: true,
      },
    },
    {
      accessorKey: 'presortmatup',
      header: 'Sortie1',
      size: 30,
      muiEditTextFieldProps: {
        type: 'time',
        required: true,
      },
    },
    {
      accessorKey: 'prerepas',
      header: 'Repas',
      size: 30,
      muiEditTextFieldProps: {
        type: 'text',
      },
    },
    {
      accessorKey: 'preentamidiup',
      header: 'Entrée2',
      size: 30,
      muiEditTextFieldProps: {
        type: 'time',
      },
    },
    {
      accessorKey: 'presortamidiup',
      header: 'Sortie2',
      size: 30,
      muiEditTextFieldProps: {
        type: 'time',
      },
    },
    {
      accessorKey: 'preentsupup',
      header: 'Entrée3',
      size: 30,
      muiEditTextFieldProps: {
        type: 'time',
      },
    },
    {
      accessorKey: 'presortsupup',
      header: 'Sortie3',
      size: 30,
      muiEditTextFieldProps: {
        type: 'time',
      },
    },
    {
      accessorKey: 'poicod',
      header: 'Pointeuse',
      size: 30,
      muiEditTextFieldProps: {
        type: 'text',
        required: true,
      },
    },
    {
      accessorKey: 'totalHeure',
      header: 'Total Heure',
      size: 30,
      muiEditTextFieldProps: {
        type: 'text',
        required: true,
      },
    },
    {
      accessorKey: 'tothnuit',
      header: 'Heure Nuit',
      size: 30,
      muiEditTextFieldProps: {
        type: 'text',
      },
    },
    {
      accessorKey: 'tothsup',
      header: 'Heure supp',
      size: 30,
      muiEditTextFieldProps: {
        type: 'text',
      },
    },
    {
      accessorKey: 'tothre',
      header: 'Total',
      size: 30,
      muiEditTextFieldProps: {
        type: 'text',
        required: true,
      },
    },
    {
      accessorKey: 'etat',
      header: 'Etat',
      size: 30,
      muiEditTextFieldProps: {
        type: 'text',
      },
      Cell: ({ cell, row }: { cell: import('material-react-table').MRT_Cell<EmpEtat>; row: MRT_Row<EmpEtat> }) => {
        const value = cell.getValue<string>();
        const hasValue = value !== null && value !== undefined && value.trim() !== '';
        
        return (
          <Box
            sx={{
              backgroundColor: hasValue ? '#fff3cd' : 'transparent',
              color: hasValue ? '#856404' : 'inherit',
              padding: '3px',
              cursor: hasValue ? 'pointer' : 'default',
            }}
            onDoubleClick={() => {
              if (hasValue) {
                // Open dialog with Congé option when double-clicking etat cell
                handleOpenDialog(row.original, 'Congé');
              }
            }}
          >
            {value}
          </Box>
        );
      },
    },
    {
      accessorKey: 'preobs',
      header: 'Observation',
      size: 30,
      muiEditTextFieldProps: {
        type: 'text',
      },
    },
    {
      accessorKey: 'totret',
      header: 'Retard',
      size: 10,
      muiEditTextFieldProps: {
        type: 'text',
        required: true,
      },
    },
    {
      accessorKey: 'hreaut',
      header: 'H. Aut. Sortie',
      size: 10,
    },
    {
      accessorKey: 'tothabs',
      header: 'Total Absence',
      size: 10,
    },
    {
      accessorKey: 'totcmp',
      header: 'Tot. cmp',
      size: 10,
      muiEditTextFieldProps: {
        type: 'text',
        required: true,
      },
    },
    {
      accessorKey: 'predouche',
      header: 'douche',
      size: 10,
      muiEditTextFieldProps: {
        type: 'text',
        required: true,
      },
    },
  ], [validationErrors]);

  const table = useMaterialReactTable({
    columns,
    enablePagination: true,
    pageCount: 5,
    data: empetat,
    enableEditing: true,
    createDisplayMode: 'row',
    editDisplayMode: 'row',
    enableColumnPinning: true,
    enableColumnDragging: true,
    getRowId: (row) => row.empcod + '-' + row.predat,
    onEditingRowSave: handleSaveRow,
    renderRowActions: ({ row, table }) => (
      <Box sx={{ display: 'flex', gap: '1rem' }}>
        <Tooltip title="Edit">
          <IconButton onClick={() => table.setEditingRow(row)}>
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Plus">
          <IconButton
            color="primary"
            onClick={() => handleOpenDialog(row.original)}
          >
            +
          </IconButton>
        </Tooltip>
      </Box>
    ),
    muiTableBodyRowProps: ({ row }) => {
      const isRepos = row.original.prerepos === '1';
      const isIncomplete =
        !row.original.presortmatup ||
        (row.original.preentamidiup && !row.original.presortamidiup) ||
        (row.original.preentsupup && !row.original.presortsupup);

      const rowId = row.id;

      return {
        onClick: () => {
          setSelectedEmpPoste({
            codposte: row.original.codposte,
            day: new Date(row.original.predat).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
          });
          setArrondi(row.original.arrondi || 0);
          setArrondiSup(row.original.arrhsup || 0);
          setSelectedEmp(row.original.empcod);
          setDate(row.original.predat);
          setSelectedRowId(rowId);
        },
        sx: {
          cursor: 'pointer',
          backgroundColor:
            selectedRowId === rowId
              ? 'rgba(25, 118, 210, 0.2)'
              : isRepos
              ? 'rgba(0, 255, 0, 0.1)'
              : isIncomplete
              ? 'rgba(255, 0, 0, 0.1)'
              : 'transparent',
          transition: 'background-color 0.2s ease',
        },
      };
    },
    muiTableBodyCellProps: {
      sx: {
        padding: '0',
        fontSize: '0.875rem',
      },
    },
  });

  return (
    <>
      <MaterialReactTable table={table} />
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog}
        sx={{
          '& .MuiDialog-container': {
            alignItems: 'center',
          },
          '& .MuiDialog-paper': {
            margin: { xs: 0, sm: '32px' },
            width: { xs: '70%', sm: 'auto' },
            maxWidth: { xs: '100%', sm: '500px' },
          },
        }}
      >
        <DialogTitle>Saisir un motif</DialogTitle>
        <DialogContent>
          <FormControl size='small' fullWidth sx={{ mt: 2 }}>
            <InputLabel>Motif</InputLabel>
            <Select
              size='small'
              variant='standard'
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              label="Motif"
            >
              <MenuItem value="Absence">Absence</MenuItem>
              <MenuItem value="Congé">Congé</MenuItem>  
              <MenuItem value="Autorisation">Autorisation de sortie</MenuItem>
              <MenuItem value="Optimisation">Optimisation pointage (journée)</MenuItem>
            </Select>
          </FormControl>
          {motif === 'Absence' && <SaisieAbsence empcod={selectedRow?.empcod || ''} date={selectedRow?.predat || ''} />}
          {motif === 'Congé' && <SaisieConge empcod={selectedRow?.empcod || ''} date={selectedRow?.predat || ''} />}
          {motif === 'Autorisation' && <SaisieAutorisation date={selectedRow?.predat} empcod={selectedRow?.empcod || ''} />}
          {motif === 'Optimisation' && (
            <OptimisationPointage 
              empcod={selectedRow?.empcod || ''} 
              date={selectedRow?.predat || ''} 
              onSuccess={() => { setDialogOpen(false); }} 
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const queryClient = new QueryClient();

function EmpEtatPeriodique() {
  const { selectedEmpMat } = useContext(EmployeeContext);
  const { dateRange } = useDateRange() as { dateRange: { dateDebut: Date; dateFin: Date; pres?: string; mois: string } };
  const { soccod } = useAuth();
  const { data: empetat = [], isLoading: loading, error } = useGetEmpEtat({ soccod, selectedEmpMat, dateRange });

  return (
    <QueryClientProvider client={queryClient}>
      {loading ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "300px",
          }}
        >
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 2 }}>
            Chargement des données...
          </Typography>
        </Box>
      ) : error ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "300px",
          }}
        >
          <Typography variant="body2" color="error">
            Erreur lors du chargement des données
          </Typography>
        </Box>
      ) : (
        <Example empetat={empetat} />
      )}
    </QueryClientProvider>
  );
}

export default EmpEtatPeriodique;