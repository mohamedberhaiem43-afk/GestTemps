import { Box, CircularProgress, Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';
import InputComponent from '../../Inputs/Input';
import useGetEmployePoste from '../../../hooks/posteHooks/useGetEmployePoste';
import CheckboxComponent from '../../CheckboxComponent/CheckboxComponent';
import { PosteDto } from '../../../models/PosteDto';
import { useContext } from 'react';
import { EmployeeContext } from './EmployeeContext';
import useGetEmpPosteByDate from '../../../hooks/employeHooks/useGetEmpPoste';

const EmpPoste = () => {
  const { selectedEmpPoste, date: contextDate,selectedEmp,arrondi,arrondisup } = useContext(EmployeeContext);
  const { t } = useTranslation();
  
  // Determine if we have a codposte or need to fetch it
  const hasCodePoste = selectedEmpPoste?.codposte && selectedEmpPoste.codposte.trim() !== '';
  
  // Use the appropriate hook based on whether we have a codposte
  const { data: dataFromPoste, isLoading: isLoadingPoste } = useGetEmployePoste(
    selectedEmpPoste?.codposte || '', 
    selectedEmpPoste?.day || '',
  );
  const { data: dataFromDate, isLoading: isLoadingDate } = useGetEmpPosteByDate(
    selectedEmp || '',
    contextDate || '',
    selectedEmpPoste?.day || '',
  );
  
  // Determine which data and loading state to use
  const data = hasCodePoste ? dataFromPoste : dataFromDate;
  const isLoading = hasCodePoste ? isLoadingPoste : isLoadingDate;
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const poste = data as PosteDto | null;

  return (
    <Box sx={{ p: 1, border: '1px solid #ccc', borderRadius: 2 }}>
      {poste ? (
        <Box sx={{ display: 'flex', gap: 4, mb: 2 }}>
          {/* Table Horaires */}
          <Box sx={{ display: 'table', width: '100%', maxWidth: 250, border: '1px solid #ccc', borderRadius: 1 }}>
            <Box sx={{ display: 'table-row', bgcolor: '#f0f0f0' }}>
              <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold' }}></Box>
              <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold' }}>{t('empEtatPeriodique.empPoste.entry')}</Box>
              <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold' }}>{t('empEtatPeriodique.empPoste.exit')}</Box>
            </Box>

            <Box sx={{ display: 'table-row' }}>
              <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold', color: 'primary.main' }}>{t('empEtatPeriodique.empPoste.morning')}</Box>
              <Box sx={{ display: 'table-cell', p: 1 }}>
                <InputComponent type="text" label="" value={poste.jourhdmat ?? ''} readOnly />
              </Box>
              <Box sx={{ display: 'table-cell', p: 1 }}>
                <InputComponent type="text" label="" value={poste.jourhfmat ?? ''} readOnly />
              </Box>
            </Box>

            <Box sx={{ display: 'table-row' }}>
              <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold', color: 'primary.main' }}>{t('empEtatPeriodique.empPoste.afternoon')}</Box>
              <Box sx={{ display: 'table-cell', p: 1 }}>
                <InputComponent type="text" label="" value={poste.jourhdam ?? ''} readOnly />
              </Box>
              <Box sx={{ display: 'table-cell', p: 1 }}>
                <InputComponent type="text" label="" value={poste.jourhfam ?? ''} readOnly />
              </Box>
            </Box>
          </Box>

          {/* Table Tolérances */}
          <Box sx={{ display: 'table', width: '100%', maxWidth: 310, border: '1px solid #ccc', borderRadius: 1 }}>
            <Box sx={{ display: 'table-row', bgcolor: '#f0f0f0' }}>
              <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold' }}></Box>
              <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold' }}>{t('empEtatPeriodique.empPoste.toleranceEntry')}</Box>
              <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold' }}>{t('empEtatPeriodique.empPoste.toleranceExit')}</Box>
            </Box>

            <Box sx={{ display: 'table-row' }}>
              <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold', color: 'primary.main' }}>{t('common.before')}</Box>
              <Box sx={{ display: 'table-cell', p: 1 }}>
                <InputComponent type='text' label='' value={poste.avantent?.toString() ?? ''} readOnly />
              </Box>
              <Box sx={{ display: 'table-cell', p: 1 }}>
                <InputComponent type='text' label='' value={poste.avantsort?.toString() ?? ''} readOnly />
              </Box>
            </Box>

            <Box sx={{ display: 'table-row' }}>
              <Box sx={{ display: 'table-cell', p: 1, fontWeight: 'bold', color: 'primary.main' }}>{t('common.after')}</Box>
              <Box sx={{ display: 'table-cell', p: 1 }}>
                <InputComponent type='text' label='' value={poste.apresent?.toString() ?? ''} readOnly />
              </Box>
              <Box sx={{ display: 'table-cell', p: 1 }}>
                <InputComponent type='text' label='' value={poste.apressort?.toString() ?? ''} readOnly />
              </Box>
            </Box>
          </Box>

          {/* Informations supplémentaires */}
          <Grid container spacing={2}>
            <Grid item xs={3}>
              <InputComponent type='text' label={t('empEtatPeriodique.empPoste.class')} value={poste.soccod ?? ''} readOnly />
            </Grid>
            <Grid item xs={3}>
              <InputComponent type='text' label={t('empEtatPeriodique.empPoste.post')} value={poste.codposte ?? ''} readOnly />
            </Grid>
            <Grid item xs={3}>
              <InputComponent type='text' label={t('empEtatPeriodique.empPoste.meal')} value={poste.jourrepas?.toString() ?? ''} readOnly />
            </Grid>
            <Grid item xs={2} mt={2}>
              <CheckboxComponent label={t('common.rest')} value={poste?.jourrepos === '1'} setValue={() => poste?.jourrepos} />
            </Grid>
            <Grid item xs={2}>
              <InputComponent type='text' label={t('empEtatPeriodique.empPoste.round')} value={arrondi} readOnly />
            </Grid>
            <Grid item xs={2}>
              <InputComponent type='text' label={t('empEtatPeriodique.empPoste.roundSup')} value={arrondisup} readOnly />
            </Grid>
          </Grid>
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', py: 4, color: 'gray' }}>
          Poste non défini pour ce jour.
        </Box>
      )}
    </Box>
  );
};

export default EmpPoste;