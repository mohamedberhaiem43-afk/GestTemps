import { useEffect, useMemo, useState } from 'react';
import {
  MaterialReactTable,
  MRT_Row,
  type MRT_ColumnDef,
} from 'material-react-table';
import { Box, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import apiInstance from '../../API/apiInstance';
import './Section.css';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';

interface SectionModel {
  seccod: string;
  soccod: string;
  seclib?: string;
  sectype?: string;
  effectif?: number;
}

const SectionTable = () => {
  const [sections, setSections] = useState<SectionModel[]>([]);
  const [editedSections, setEditedSections] = useState<Record<string, SectionModel>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const soccod = sessionStorage.getItem('soccod') || '01';

  const fetchSections = async () => {
    try {
      const response = await apiInstance.get<SectionModel[]>(`/Sections/${soccod}`);
      setSections(response.data);
    } catch (err) {
      console.error(err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, [soccod]);

  const columns = useMemo<MRT_ColumnDef<SectionModel>[]>(
    () => [
      {
        accessorKey: 'seccod',
        header: 'Code',
      },
      {
        accessorKey: 'soccod',
        header: 'Societe',
      },
      {
        accessorKey: 'seclib',
        header: 'Libellé',
      },
      {
        accessorKey: 'sectype',
        header: 'Type',
      },
      {
        accessorKey: 'effectif',
        header: 'Effectif',
      },
    ],
    []
  );

  const openDeleteConfirmModal = (row: MRT_Row<SectionModel>) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette section ?')) {
      apiInstance.delete(`/Sections/${row.original.soccod}/${row.original.seccod}`)
        .then(() => {
          setSections((prev) => prev.filter((section) => section.seccod !== row.original.seccod));
        })
        .catch((err) => {
          console.error('Erreur lors de la suppression :', err);
        });
    }
  };

  const handleSaveNewRow = async (values: SectionModel) => {
    try {
      const response = await apiInstance.post('/Sections', values);
      setSections((prev) => [...prev, response.data]);
    } catch (err) {
      console.error('Erreur lors de la création :', err);
    }
  };

  const handleSaveEditedRows = async () => {
    try {
      await Promise.all(
        Object.values(editedSections).map(async (edited) => {
          await apiInstance.put(`/Sections/${edited.soccod}/${edited.seccod}`, edited);
        })
      );
      setEditedSections({});
      fetchSections();
    } catch (err) {
      console.error('Erreur lors de la mise à jour :', err);
    }
  };

  return (
    <Box width={'95vw'} height={'90vh'}>
      <BreadcrumbNavigation />
      <MaterialReactTable
        columns={columns}
        data={sections}
        enableEditing
        onEditingRowSave={(params) => {
          const value = params.values as SectionModel;
          setEditedSections((prev) => ({
            ...prev,
            [params.row.id]: value,
          }));
          return Promise.resolve();
        }}
        onCreatingRowSave={async ({ exitCreatingMode, values }) => {
          const section = values as SectionModel;
          await handleSaveNewRow(section);
          exitCreatingMode();
        }}
        enableRowActions
        renderRowActions={({ row }) => (
          <Box sx={{ display: 'flex', gap: '1rem' }}>
            <Tooltip title='Delete'>
              <IconButton color='error' onClick={() => openDeleteConfirmModal(row)}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        )}
        renderTopToolbarCustomActions={({ table }) => (
          <Tooltip title='Nouvelle section'>
            <IconButton color='primary' onClick={() => table.setCreatingRow(true)}>
              <AddIcon />
            </IconButton>
          </Tooltip>
        )}
        renderBottomToolbarCustomActions={() => (
          <Box sx={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <IconButton
              color='success'
              onClick={handleSaveEditedRows}
              disabled={Object.keys(editedSections).length === 0}
            >
              {isLoading ? <CircularProgress size={25} /> : <SaveIcon />}
            </IconButton>
          </Box>
        )}
        state={{ isLoading, showAlertBanner: isError, showProgressBars: isLoading }}
      />
    </Box>
  );
};

const queryClient = new QueryClient();

const Section = () => (
  <QueryClientProvider client={queryClient}>
    <SectionTable />
  </QueryClientProvider>
);

export default Section;
