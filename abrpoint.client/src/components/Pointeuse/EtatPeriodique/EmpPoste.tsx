import { Box, CircularProgress, Grid } from '@mui/material';
import InputComponent from '../../Inputs/Input';
import useGetEmployePoste from '../../../hooks/posteHooks/useGetEmployePoste';
import CheckboxComponent from '../../CheckboxComponent/CheckboxComponent';
import { PosteDto } from '../../../models/PosteDto';
import { useContext } from 'react';
import { EmployeeContext } from './EmployeeContext';

const EmpPoste = () => {
  const {selectedEmpPoste} = useContext(EmployeeContext);
  const { data, isLoading } = useGetEmployePoste(selectedEmpPoste?.codposte || '', selectedEmpPoste?.day || '');
  if (isLoading) return <CircularProgress />;

  const poste = (data) as PosteDto | undefined;

  return (
    <Box sx={{ p: 1, border: '1px solid #ccc', borderRadius: 2 }}>
      <Box sx={{ display: 'flex', gap: 4, mb: 2 }}>

        {/* Table: Entrée / Sortie */}
        <Box sx={{ display: 'table', width: '100%', maxWidth: 250, border: '1px solid #ccc', borderRadius: 1 }}>
          <Box sx={{ display: 'table-row', bgcolor: '#f0f0f0' }}>
            <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold' }}></Box>
            <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold' }}>Entrée</Box>
            <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold' }}>Sortie</Box>
          </Box>

          {/* Matin */}
          <Box sx={{ display: 'table-row' }}>
            <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold', color: 'primary.main' }}>Matin</Box>
            <Box sx={{ display: 'table-cell', p: 1 }}>
              <InputComponent type="text" label="" value={poste?.jourhdmat ?? ''} setValue={undefined} />
            </Box>
            <Box sx={{ display: 'table-cell', p: 1 }}>
              <InputComponent type="text" label="" value={poste?.jourhfmat ?? ''} setValue={undefined} />
            </Box>
          </Box>

          {/* Après-midi */}
          <Box sx={{ display: 'table-row' }}>
            <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold', color: 'primary.main' }}>A.Midi</Box>
            <Box sx={{ display: 'table-cell', p: 1 }}>
              <InputComponent type="text" label="" value={poste?.jourhdam ?? ''} setValue={undefined} />
            </Box>
            <Box sx={{ display: 'table-cell', p: 1 }}>
              <InputComponent type="text" label="" value={poste?.jourhfam ?? ''} setValue={undefined} />
            </Box>
          </Box>
        </Box>

        {/* Table: Tolérance */}
        <Box sx={{ display: 'table', width: '100%', maxWidth: 310, border: '1px solid #ccc', borderRadius: 1 }}>
          <Box sx={{ display: 'table-row', bgcolor: '#f0f0f0' }}>
            <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold' }}></Box>
            <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold' }}>Tolérance Entrée</Box>
            <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold' }}>Tolérance Sortie</Box>
          </Box>

          <Box sx={{ display: 'table-row' }}>
            <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold', color: 'primary.main' }}>Avant</Box>
            <Box sx={{ display: 'table-cell', p: 1 }}>
              <InputComponent type='text' label='' value={poste?.avantent?.toString() ?? ''} setValue={undefined} />
            </Box>
            <Box sx={{ display: 'table-cell', p: 1 }}>
              <InputComponent type='text' label='' value={poste?.avantsort?.toString() ?? ''} setValue={undefined} />
            </Box>
          </Box>

          <Box sx={{ display: 'table-row' }}>
            <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold', color: 'primary.main' }}>Après</Box>
            <Box sx={{ display: 'table-cell', p: 1 }}>
              <InputComponent type='text' label='' value={poste?.apresent?.toString() ?? ''} setValue={undefined} />
            </Box>
            <Box sx={{ display: 'table-cell', p: 1 }}>
              <InputComponent type='text' label='' value={poste?.apressort?.toString() ?? ''} setValue={undefined} />
            </Box>
          </Box>
        </Box>

        {/* Champs supplémentaires */}
        <Grid container spacing={2}>
          <Grid item xs={3}>
            <InputComponent type='text' label='Classe' value={poste?.soccod ?? ''} setValue={undefined} />
          </Grid>
          <Grid item xs={3}>
            <InputComponent type='text' label='Poste' value={poste?.codposte ?? ''} setValue={undefined} />
          </Grid>
          <Grid item xs={3}>
            <InputComponent type='text' label='Repas' value={poste?.jourrepas?.toString() ?? ''} setValue={undefined} />
          </Grid>
          <Grid item xs={2} mt={2}>
            <CheckboxComponent label="Repos" value={poste?.jourrepos === '1'} setValue={()=>poste?.jourrepos} />
          </Grid>
          <Grid item xs={2}>
            <InputComponent type='text' label='Arrondi' value={poste?.arrondi?.toString() ?? ''} setValue={undefined} />
          </Grid>
          {/* <Grid item xs={2}>
            <InputComponent type='text' label='Douche' value={'0'} setValue={undefined} />
          </Grid> */}
        </Grid>
      </Box>
    </Box>
  );
};

export default EmpPoste;
