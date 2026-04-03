import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import InputComponent from '../../../Inputs/Input';
import SelectInputComponent from '../../../SelectInputComponent/SelectInputComponent';
import { useTranslation } from 'react-i18next';

const InfoBasic = ({
  formData,
  handleChange,
}: {
  formData: { [key: string]: any };
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | 
       { target: { name: string; value: any } }
  ) => void;
}) => {
  const { t } = useTranslation();
  const genderOptions = {
    "M": t('employe.gender.male') || 'Masculin',
    "F": t('employe.gender.female') || 'Feminin',
  };

  // Function to convert date from dd/MM/yyyy to yyyy-MM-dd
  const formatDateForInput = (dateString: string | undefined) => {
    if (!dateString) return '';
    
    // Check if the date is already in yyyy-MM-dd format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Convert from dd/MM/yyyy to yyyy-MM-dd
    const parts = dateString.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    
    return dateString;
  };

  return (
    <Box sx={{ flexGrow: 1, margin: 'auto', padding: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={2}>
          <InputComponent
            type="text"
            label={t('employe.form.cin') || 'N° CIN'}
            name="empcin"
            value={formData?.empcin || ''}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={3}>
          <InputComponent
            type="text"
            label={t('employe.form.name') || 'Nom et Prénom'}
            name="emplib"
            value={formData?.emplib || ''}
            onChange={handleChange}
          />
        </Grid>

        <Grid item xs={2}>
          <InputComponent
            type="text"
            label={t('employe.form.badge') || 'N °Badge'}
            name="empcod"
            value={formData?.empcod || ''}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={2}>
          <InputComponent
            type="date"
            label={t('employe.form.birthDate') || 'Date Naissance'}
            name="empdnais"
            value={formatDateForInput(formData?.empdnais)}
            onChange={handleChange}
          />
        </Grid>

        <Grid item xs={2.3}>
          <InputComponent
            type="text"
            label={t('employe.form.birthPlace') || 'Lieu'}
            name="emplnais"
            value={formData?.emplnais || ''}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={2}>
          <InputComponent
            type="text"
            label={t('employe.form.matricule') || 'Matricule'}
            name="empmat"
            value={formData?.empmat || ''}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={2} mt={1}>
          <SelectInputComponent
            label={t('employe.form.sex') || 'Sexe'}
            value={formData?.empsexe || ''}
            setValue={(value: string) => handleChange({ target: { name: 'empsexe', value } })}
            maplist={genderOptions}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default InfoBasic;