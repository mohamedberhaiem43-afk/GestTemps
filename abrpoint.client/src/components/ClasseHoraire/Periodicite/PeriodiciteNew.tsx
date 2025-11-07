import { DataGrid, GridColDef, GridRowModel } from '@mui/x-data-grid';
import useGetLcategories from '../../../hooks/lcategoriesHooks/useGetLcategories';
import { useClasseHoraireContext } from '../../helper/ClasseHoraireContext';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { Box, Checkbox } from '@mui/material';
import useGetPostesData from '../../../hooks/posteHooks/useGetPostesData';
import { PosteHoraire } from '../../../models/PosteHoraire';

const LcategorieList = () => {
  const { selectedClasseHoraire, setSelectedClasseHoraire, frequence, setFrequence } = useClasseHoraireContext();
  const { data = [] } = useGetLcategories(frequence || 'N');
  const { data: posteData = {} as PosteHoraire } = useGetPostesData(
    selectedClasseHoraire?.codposte ?? '',
    selectedClasseHoraire?.catcod ?? ''
  );
  // 🔹 Local state for editable rows
  const [rows, setRows] = useState<PosteHoraire[]>([]);

  // Update rows when API data changes
  useEffect(() => {
    setRows(
      data.map((item: any) => ({
        ...item,
        id: `${item.catcod || ''}-${item.codposte || ''}-${item.soccod || ''}`,
        catdu: item.catdu ? new Date(item.catdu) : null,
        catau: item.catau ? new Date(item.catau) : null,
      }))
    );
  }, [data]);


  // 🔹 Handle row click: merge with posteData
  const handleRowClick = (params: any) => {
    const row = params.row as Partial<PosteHoraire>;

    const completeRow: PosteHoraire = {
      ...posteData,
      ...row,
      cathsup: row.cathsup ?? posteData.cathsup ?? '0', // ✅ priorité à la ligne
    };

    setSelectedClasseHoraire(completeRow);
    setFrequence(row.catperiode);
  };


  // 🔹 Handle cell edit commit
  const processRowUpdate = useCallback(
    (newRow: GridRowModel) => {
      const updatedRow = { ...newRow } as PosteHoraire;

      setRows((prevRows) =>
        prevRows.map((row:any) => (row.id === newRow.id ? updatedRow : row))
      );

      // Optionally call API to save
      // await updatePosteHoraire(updatedRow);

      return updatedRow;
    },
    []
  );

  // 🔹 Define editable columns
  const columns = useMemo<GridColDef<PosteHoraire>[]>(
    () => [
{
        field: 'catdu',
        headerName: 'Du',
        width: 120,
        editable: true,
        renderCell: (params) => {
          const val = params.value;
          if (!val) return '';

          // If it's already a Date
          if (val instanceof Date) {
            return val.toLocaleDateString();
          }

          // If it's a string like "2099-08-31T00:00:00"
          if (typeof val === 'string') {
            const [year, month, day] = val.split('T')[0].split('-');
            return `${day}/${month}/${year}`;
          }

          // Fallback
          return '';
        },
      },
      {
        field: 'catau',
        headerName: 'Au',
        width: 120,
        editable: true,
        renderCell: (params) => {
          const val = params.value;
          if (!val) return '';

          if (val instanceof Date) {
            return val.toLocaleDateString();
          }

          if (typeof val === 'string') {
            const [year, month, day] = val.split('T')[0].split('-');
            return `${day}/${month}/${year}`;
          }

          return '';
        },
      },

      {
        field: 'catfixe',
        headerName: 'Fixe ?',
        width: 80,
        editable: true,
        renderCell: (params) => (
          <Checkbox size="small" checked={params.value === '1'} disabled />
        ),
      },
      {
        field: 'codposte',
        headerName: 'Code Post',
        width: 120,
        editable: true,
      },
      {
        field: 'catlib',
        headerName: 'Désignation',
        width: 200,
        flex: 1,
        editable: true,
      },
    ],
    []
  );

  return (
    <Box sx={{ height: 400, width: '100%' }}>
      <DataGrid
        rows={rows}
        columns={columns}
        processRowUpdate={processRowUpdate}
        onProcessRowUpdateError={(error) => console.error(error)}
        initialState={{
          pagination: {
            paginationModel: { pageSize: 4, page: 0 },
          },
        }}
        pageSizeOptions={[4, 8, 16]}
        checkboxSelection
        disableRowSelectionOnClick={false}
        onRowClick={handleRowClick}
        sx={{
          '& .MuiDataGrid-row': {
            cursor: 'pointer',
            '&:hover': { backgroundColor: '#f0f0f0' },
          },
          '& .MuiDataGrid-cell': { padding: '0px 8px' },
          '& .MuiDataGrid-columnHeader': {
            fontSize: '0.7rem',
            padding: '0px 8px',
          },
        }}
      />
    </Box>
  );
};

export default LcategorieList;
