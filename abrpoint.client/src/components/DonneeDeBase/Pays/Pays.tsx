import { useMemo, useState } from 'react';
import {
  MaterialReactTable,
  type MRT_ColumnDef,
  MRT_Row,
  useMaterialReactTable,
} from 'material-react-table';
import {
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import './Pays.css';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';
import { PaysModel } from '../../../models/Pays';
import useGetPays from '../../../hooks/paysHooks/useGetPays';

const Nation = () => {
  const [validationErrors, setValidationErrors] = useState<Record<string, string | undefined>>({});
  const [editedNations, setEditedNations] = useState<Record<string, PaysModel>>({});

  const token = localStorage.getItem('authToken');
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const { data: nations = [], refetch, isLoading, isError } = useGetPays();

  const openDeleteConfirmModal = async (row: MRT_Row<PaysModel>) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce pays ?')) {
      try {
        await axios.delete(`https://localhost:7189/api/Pays/${row.original.natcod}`, { headers });
        refetch();
      } catch (error) {
        console.error("Erreur suppression pays: ", error);
      }
    }
  };

  const columns = useMemo<MRT_ColumnDef<PaysModel>[]>(() => [
    {
      accessorKey: 'natcod',
      header: 'Code',
      size: 80,
      muiEditTextFieldProps: ({ cell }) => ({
        onBlur: (event) => {
          const rowId = cell.row.id;
          const value = event.target.value;

          setEditedNations((prev) => ({
            ...prev,
            [rowId]: {
              ...prev[rowId],
              natcod: value,
            },
          }));
        },
      }),
    },
    {
      accessorKey: 'natlib',
      header: 'Libellé',
      size: 200,
      muiEditTextFieldProps: ({ cell }) => ({
        onBlur: (event) => {
          const rowId = cell.row.id;
          const value = event.target.value;

          setEditedNations((prev) => ({
            ...prev,
            [rowId]: {
              ...prev[rowId],
              natlib: value,
            },
          }));
        },
      }),
    },
  ], []);

  const handleSaveNations = async () => {
    if (Object.values(validationErrors).some((error) => !!error)) return;

    try {
      await Promise.all(
        Object.values(editedNations).map(async (nation) => {
          const sanitizedNation = {
            natcod: nation.natcod,
            natlib: nation.natlib,
          };
          await axios.post('https://localhost:7189/api/Pays', sanitizedNation, { headers });
        })
      );
      setEditedNations({});
      refetch();
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement :', error);
    }
  };

  const handleEditNations = async () => {
    try {
      await Promise.all(
        Object.values(editedNations).map(async (nation) => {
          const sanitizedNation = {
            natcod: nation.natcod,
            natlib: nation.natlib,
          };
          await axios.put('https://localhost:7189/api/Pays', sanitizedNation, { headers });
        })
      );
      setEditedNations({});
      refetch();
    } catch (error) {
      console.error('Erreur mise à jour pays:', error);
    }
  };

  const table = useMaterialReactTable({
    columns,
    data: nations,
    createDisplayMode: 'row',
    enableClickToCopy: true,
    enableEditing: true,
    enableRowActions: true,
    editDisplayMode: 'cell',
    getRowId: (row) => row.natcod,

    muiToolbarAlertBannerProps: isError
      ? {
          color: 'error',
          children: 'Erreur de chargement',
        }
      : undefined,
    muiTableContainerProps: {
      sx: {
        minHeight: '85px',
        maxHeight: '400px',
        overflowY: 'auto',
      },
    },
    muiTableBodyCellProps: {
      sx: { padding: 0 },
    },
    onCreatingRowCancel: () => setValidationErrors({}),
    onCreatingRowSave: handleSaveNations,
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '1rem' }}>
        <Tooltip title={t('common.delete')}>
          <IconButton color="error" onClick={() => openDeleteConfirmModal(row)}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    renderBottomToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <IconButton
          color="success"
          onClick={handleEditNations}
          disabled={Object.keys(editedNations).length === 0}
        >
          {isLoading ? <CircularProgress size={25} /> : <SaveIcon />}
        </IconButton>
      </Box>
    ),
    renderTopToolbarCustomActions: ({ table }) => (
      <Tooltip title="Créer un nouveau pays">
        <IconButton
          color="primary"
          onClick={() => {
            table.setCreatingRow(true);
          }}
        >
          <AddIcon />
        </IconButton>
      </Tooltip>
    ),
    initialState: {
      columnPinning: {
        right: ['mrt-row-actions'],
      },
    },
    state: {
      isLoading,
      showAlertBanner: isError,
      showProgressBars: isLoading,
    },
  });

  return (
    <Box ml={5} width={'95vw'} height={'90vh'}>
      <BreadcrumbNavigation />
      <MaterialReactTable table={table} />
    </Box>
  );
};

const queryClient = new QueryClient();

const Pays = () => (
  <QueryClientProvider client={queryClient}>
    <Nation />
  </QueryClientProvider>
);

export default Pays;
