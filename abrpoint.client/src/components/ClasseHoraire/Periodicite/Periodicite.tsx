import { DataGrid, GridColDef } from '@mui/x-data-grid';
import useGetLcategories from '../../../hooks/lcategoriesHooks/useGetLcategories';
import { useClasseHoraireContext } from '../../helper/ClasseHoraireContext';
import { useMemo, useState, useEffect } from 'react';
import { Box, Checkbox } from '@mui/material';
import useGetPostesData from '../../../hooks/posteHooks/useGetPostesData';
import { PosteHoraire } from '../../../models/PosteHoraire';

const LcategorieList = () => {
  const { setSelectedClasseHoraire, frequence, setFrequence } = useClasseHoraireContext();
  const { data = [] } = useGetLcategories(frequence || 'N');
  
  // Store the clicked row temporarily
  const [clickedRow, setClickedRow] = useState<Partial<PosteHoraire> | null>(null);
  
  // Fetch poste data based on clicked row
  const { data: posteData = {} as PosteHoraire } = useGetPostesData(
    clickedRow?.codposte ?? '',
    clickedRow?.catcod ?? ''
  );

  // When posteData is loaded, merge and update context
  useEffect(() => {
    if (clickedRow && posteData && Object.keys(posteData).length > 0) {
      const completeRow: PosteHoraire = {
        ...posteData,
        ...clickedRow,
        cathsup: posteData.cathsup || '0',
      };
      
      setSelectedClasseHoraire(completeRow);
      setClickedRow(null); // Reset after processing
    }
  }, [posteData, clickedRow, setSelectedClasseHoraire]);

  // 🔹 When clicking a row, store it temporarily
  const handleRowClick = (params: any) => {
    const row = params.row as Partial<PosteHoraire>;
    setClickedRow(row);
    setFrequence(row.catperiode);
  };

  const columns = useMemo<GridColDef<PosteHoraire>[]>(
    () => [
      {
        field: 'catdu',
        headerName: 'Du',
        width: 120,
        renderCell: (params) => new Date(params.value as string | number | Date).toLocaleDateString(),
      },
      {
        field: 'catau',
        headerName: 'Au',
        width: 120,
        renderCell: (params) => new Date(params.value as string | number | Date).toLocaleDateString(),
      },
      {
        field: 'catfixe',
        headerName: 'Fixe ?',
        width: 80,
        renderCell: (params) => (
          <Checkbox
            size='small'
            checked={params.value === "1"}
            disabled
          />
        ),
      },
      {
        field: 'codposte',
        headerName: 'Code Post',
        width: 120,
      },
      {
        field: 'catlib',
        headerName: 'Désignation',
        width: 200,
        flex: 1,
      },
    ],
    [],
  );

  const rows = useMemo(
    () =>
      data.map((item: any) => ({
        ...item,
        id: `${item.catcod || ''}-${item.codposte || ''}-${item.soccod || ''}`,
      })),
    [data]
  );

  return (
    <Box sx={{ height: 400, width: '100%' }}>
      <DataGrid
        rows={rows}
        columns={columns}
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
            '&:hover': {
              backgroundColor: '#f0f0f0',
            },
          },
          '& .MuiDataGrid-cell': {
            padding: '0px 8px',
          },
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