import { useEffect, useMemo, useState } from 'react';
import {
  MaterialReactTable,
  MRT_Row,
  type MRT_ColumnDef,
  useMaterialReactTable,
} from 'material-react-table';
import {
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import apiInstance from '../../API/apiInstance';
import { FonctionModel } from '../../../models/Fonction';
import { t } from 'i18next';

const FonctionTable = () => {
  const [fonctions, setFonctions] = useState<FonctionModel[]>([]);
  const [editedFonctions, setEditedFonctions] = useState<Record<string, FonctionModel>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const soccod = sessionStorage.getItem('soccod') || '';

  const fetchFonctions = async () => {
    try {
      const response = await apiInstance.get(`/Fonctions/${soccod}`);
      setFonctions(response.data);
    } catch (err) {
      console.error(err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFonctions();
  }, []);

  const foncTypeLabels: Record<string, string> = {
    "0": "Administratif",
    "1": "Production",
    "2": "Emballage",
    "3": "Qualité",
    "4": "Maintenance",
    "5": "Gardien",
    "6": "Commerciale",
    "7": "Marketing",
    "8": "Financier",
    "9": "Autre",
  };

  const columns = useMemo<MRT_ColumnDef<FonctionModel>[]>(() => [
    {
      accessorKey: 'foncod',
      header: 'Code',
      size: 60,
      muiEditTextFieldProps: ({ cell }) => ({
        onBlur: (e) => {
          const rowId = cell.row.id;
          setEditedFonctions((prev) => ({
            ...prev,
            [rowId]: {
              ...prev[rowId],
              foncod: e.target.value,
            },
          }));
        },
      }),
    },
    {
      accessorKey: 'fonlib',
      header: 'Fonction',
      size: 100,
      muiEditTextFieldProps: ({ cell }) => ({
        onBlur: (e) => {
          const rowId = cell.row.id;
          setEditedFonctions((prev) => ({
            ...prev,
            [rowId]: {
              ...prev[rowId],
              fonlib: e.target.value,
            },
          }));
        },
      }),
    },
    {
      accessorKey: 'fontype',
      header: 'Type',
      size: 100,
      Cell: ({ cell }) => foncTypeLabels[cell.getValue<string>()] ?? cell.getValue<string>(),
      muiEditTextFieldProps: ({ cell }) => ({
        onBlur: (e) => {
          const rowId = cell.row.id;
          setEditedFonctions((prev) => ({
            ...prev,
            [rowId]: {
              ...prev[rowId],
              fontype: e.target.value,
            },
          }));
        },
      }),
    },
  ], []);

  const openDeleteConfirmModal = (row: MRT_Row<FonctionModel>) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette fonction ?')) {
      apiInstance.delete(`/Fonctions/${row.original.foncod}`)
        .then(() => {
          setFonctions((prev) => prev.filter((f) => f.foncod !== row.original.foncod));
        })
        .catch((err) => {
          console.error("Erreur lors de la suppression :", err);
        });
    }
  };

  const handleSaveFonctions = async () => {
  const soccod = sessionStorage.getItem('soccod') || '01';

  try {
    await Promise.all(
      Object.values(editedFonctions).map(async (f) => {
        const sanitized = {
          foncod: f.foncod ?? '',
          soccod: soccod,
          fonlib: f.fonlib ?? '',
          fontype: f.fontype ?? '',
          fonpqual: '0',
          fonpchoix: '0',
        };


        const response = await apiInstance.post(
          `/Fonctions`,
          sanitized
        );

        setFonctions((prev) => [...prev, response.data]);
      })
    );

    setEditedFonctions({});
  } catch (err: any) {
    console.error('Erreur lors de la sauvegarde :', err.response?.data || err.message);
  }
};

  const handleEditFonctions = async () => {
    try {
      await Promise.all(
        Object.values(editedFonctions).map(async (f) => {
          await apiInstance.put(`/Fonctions/${f.foncod}`, f);
        })
      );
      setEditedFonctions({});
      fetchFonctions();
    } catch (err) {
      console.error('Erreur lors de la modification :', err);
    }
  };

  const table = useMaterialReactTable({
    columns,
    data: fonctions,
    createDisplayMode: 'row',
    enableEditing: true,
    editDisplayMode: 'cell',
    enableRowActions: true,
    getRowId: (row) => row.foncod,

    onCreatingRowSave: handleSaveFonctions,
    onCreatingRowCancel: () => setEditedFonctions({}),

    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '1rem' }}>
        <Tooltip title={t('common.delete')}>
          <IconButton color="error" onClick={() => openDeleteConfirmModal(row)}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),

    renderTopToolbarCustomActions: ({ table }) => (
      <Tooltip title="Nouvelle fonction">
        <IconButton color="primary" onClick={() => table.setCreatingRow(true)}>
          <AddIcon />
        </IconButton>
      </Tooltip>
    ),

    renderBottomToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <IconButton
          color="success"
          onClick={handleEditFonctions}
          disabled={Object.keys(editedFonctions).length === 0}
        >
          {isLoading ? <CircularProgress size={25} /> : <SaveIcon />}
        </IconButton>
      </Box>
    ),

    muiTableContainerProps: {
      sx: {
        minHeight: '85px',
        maxHeight: '400px',
        overflowY: 'auto',
      },
    },

    muiToolbarAlertBannerProps: isError
      ? {
          color: 'error',
          children: 'Erreur lors du chargement des données.',
        }
      : undefined,

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
    <Box width={'95vw'} height={'90vh'}>
      <MaterialReactTable table={table} />
    </Box>
  );
};

const queryClient = new QueryClient();

const Fonction = () => (
  <QueryClientProvider client={queryClient}>
    <FonctionTable />
  </QueryClientProvider>
);

export default Fonction;
