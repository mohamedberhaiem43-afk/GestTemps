import { useMemo, useState } from 'react';
import {
  MaterialReactTable,
  type MRT_ColumnDef,
  MRT_Row,
  useMaterialReactTable,
} from 'material-react-table';
import { Box, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import './Ville.css';
import { VilleModel } from '../../../models/Ville';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';
import useGetVilles from '../../../hooks/villeHooks/useGetVilles';

const VilleTable = () => {
  const [validationErrors, setValidationErrors] = useState<Record<string, string | undefined>>({});
  const [editedVilles, setEditedVilles] = useState<Record<string, VilleModel>>({});
  const token = localStorage.getItem('authToken');

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const { data: villes = [], isLoading, isError, refetch } = useGetVilles();

  const openDeleteConfirmModal = (row: MRT_Row<VilleModel>) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette ville ?')) {
      axios
        .delete(`${import.meta.env.VITE_REACT_APP_API_URL}/Villes/${row.original.vilcod}`, { headers })
        .then(() => refetch())
        .catch((error) => console.error('Erreur suppression : ', error));
    }
  };

  const columns = useMemo<MRT_ColumnDef<VilleModel>[]>(() => [
    {
      accessorKey: 'vilcod',
      header: 'Code',
      size: 80,
      muiEditTextFieldProps: ({ cell }) => ({
        onBlur: (event) => {
          const rowId = cell.row.id;
          const updatedValue = event.target.value;
          setEditedVilles((prev) => ({
            ...prev,
            [rowId]: { ...prev[rowId], vilcod: updatedValue },
          }));
        },
      }),
    },
    {
      accessorKey: 'villib',
      header: 'Libellé',
      size: 200,
      muiEditTextFieldProps: ({ cell }) => ({
        onBlur: (event) => {
          const rowId = cell.row.id;
          const updatedValue = event.target.value;
          setEditedVilles((prev) => ({
            ...prev,
            [rowId]: { ...prev[rowId], villib: updatedValue },
          }));
        },
      }),
    },
  ], []);

  const handleSaveVilles = async () => {
    if (Object.values(validationErrors).some((error) => !!error)) return;

    try {
      await Promise.all(
        Object.values(editedVilles).map(async (ville) => {
          const newVille = {
            vilcod: ville.vilcod,
            villib: ville.villib,
          };
          await axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/Villes`, newVille, { headers });
        })
      );
      setEditedVilles({});
      refetch();
    } catch (error) {
      console.error('Erreur lors de l’ajout de ville :', error);
    }
  };

  const handleEditVilles = async () => {
    try {
      await Promise.all(
        Object.values(editedVilles).map(async (ville) => {
          const updatedVille = {
            vilcod: ville.vilcod,
            villib: ville.villib,
          };
          await axios.put(`${import.meta.env.VITE_REACT_APP_API_URL}/Villes/${ville.vilcod}`, updatedVille, { headers });
        })
      );
      setEditedVilles({});
      refetch();
    } catch (error) {
      console.error('Erreur lors de la modification :', error);
    }
  };

  const table = useMaterialReactTable({
    columns,
    data: villes,
    createDisplayMode: 'row',
    enableEditing: true,
    enableRowActions: true,
    editDisplayMode: 'cell',
    getRowId: (row) => row.vilcod,
    muiToolbarAlertBannerProps: isError ? {
      color: 'error',
      children: 'Erreur chargement des données',
    } : undefined,
    muiTableContainerProps: {
      sx: {
        minHeight: '85px',
        maxHeight: '400px',
        overflowY: 'auto',
      },
    },
    muiTableBodyCellProps: {
      sx: {
        padding: '0',
      },
    },
    onCreatingRowCancel: () => setValidationErrors({}),
    onCreatingRowSave: handleSaveVilles,
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
          onClick={handleEditVilles}
          disabled={Object.keys(editedVilles).length === 0}
        >
          {isLoading ? <CircularProgress size={25} /> : <SaveIcon />}
        </IconButton>
      </Box>
    ),
    renderTopToolbarCustomActions: ({ table }) => (
      <Tooltip title="Ajouter une ville">
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
    <Box ml={5} width={'90vw'} height={'90vh'}>
      <BreadcrumbNavigation />
      <MaterialReactTable table={table} />
    </Box>
  );
};

const queryClient = new QueryClient();

const Ville = () => (
  <QueryClientProvider client={queryClient}>
    <VilleTable />
  </QueryClientProvider>
);

export default Ville;
