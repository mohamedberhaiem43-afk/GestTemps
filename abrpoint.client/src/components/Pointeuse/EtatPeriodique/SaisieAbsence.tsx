import {
  Alert,
  Box,
  Button,
  Grid,
  IconButton,
  Snackbar,
} from '@mui/material';
import SaveIcon from "@mui/icons-material/Save";
import CheckboxComponent from '../../CheckboxComponent/CheckboxComponent'
import InputComponent from '../../Inputs/Input'
import RadioGroupComponent, { FormControlLabelComponent } from '../../RadioGroupComponent/RadioGroupComponent'
import SelectInputComponent from '../../SelectInputComponent/SelectInputComponent'
import useGetAbsencesLibs from '../../../hooks/absenceHooks/useGetAbsenceLibs'
import {useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next';
import useAddSanction from '../../../hooks/sanctionHooks/useAddSanction';
import { Sanction } from '../../../models/Sanction';
import generateNumeroOrdre from '../../helper/GenerateNumOrdre';
import { useAuth } from '../../helper/AuthProvider';

function SaisieAbsence({empcod,date}: { empcod: string, date: string }) {
      
  const { t } = useTranslation();
  const [concod, setOrdre] = useState(generateNumeroOrdre());
  const [condat, setDate] = useState(() => {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString();
});
  const [conref, setReference] = useState('');
const [condep, setDateDepart] = useState(() => {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString();
});  
  const [conamdep, setApresMidiDepart] = useState(false);
  const [conret, setDateReprise] = useState(() => {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 2);
    return tomorrow.toISOString();
  });
      const { soccod } = useAuth();
      const [conamret, setApresMidiReprise] = useState(false);
      const [conjour, setTimePeriod] = useState('J');
      const [abscod, setAbscod] = useState('');
      const [connbjour, setConnbjour] = useState(0); // State for the number of days
      const {data:absences = []} = useGetAbsencesLibs();
      const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
      const [message, setMessage] = useState<string | null>(null);
      const [severity, setSeverity] = useState<'success' | 'error'>('success');
      const { mutate } = useAddSanction();

  // Initialize the form with the employee code and date
        const handleSubmit = (event: any) => {
    event.preventDefault();
    const sanctionData : Sanction = {
      soccod: soccod,
      empcod,
      concod,
      condat: condat ? new Date(condat) : undefined,
      conref,
      condep: condep ? new Date(condep) : undefined,
      conamdep: conamdep ? '1' : '0',
      conret: conret ? new Date(conret) : undefined,
      conamret: conamret ? '1' : '0',
      connbjour,
      conjour,
      abscod,
    };
    if(sanctionData.consanc){
      // Send a POST request to insert the sanction data
      mutate(sanctionData,{
        onSuccess() {
          handleSnackbarOpening(t('sanction.addSuccess'),'success');
          //resetForm();
        },
        onError() {
          handleSnackbarOpening(t('sanction.addError'),'error');
        },
      })
    }else{
      handleSnackbarOpening(t('sanction.fillImputation'),'error');
    }
    
  }
  const handleSnackbarOpening = (message: string, severity: 'success' | 'error') => {
    setMessage(message);
    setSeverity(severity);
    setIsSnackbarOpen(true);
  };
    function handleSnackbarClose(): void {
        setIsSnackbarOpen(false);
    }
  useEffect(() => {
  if (condep && conret) {
    const startDate = new Date(condep);
    const endDate = new Date(conret);
    const timeDiff = endDate.getTime() - startDate.getTime();
    const dayDiff = timeDiff / (1000 * 3600 * 24); // Convert milliseconds to days
    setConnbjour(dayDiff >= 0 ? dayDiff : 0); // Ensure it's not negative and include both start and end days
  }
}, [condep, conret]);
    function resetForm(event: React.MouseEvent<HTMLButtonElement>): void {
        event?.preventDefault();
        setOrdre(generateNumeroOrdre());
        // setDate('');
        setReference('');
        // setDateDepart('');
        setApresMidiDepart(false);
        // setDateReprise('');
        setApresMidiReprise(false);
        setTimePeriod('J');
        setAbscod('');
    }
    

  return (
      <Box component="form" sx={{ maxWidth: 1200, mx: 'auto', p: 1 }} onSubmit={handleSubmit}>
      <Grid container spacing={1.5}>

        {/* N° Ordre */}
        <Grid item xs={1} sm={1}>
          <InputComponent type='text' label={t('common.orderNumber')} value={concod} setValue={setOrdre} />
        </Grid>

        {/* Date (as TextField) */}
        <Grid item xs={1.5} sm={2}>
          <InputComponent
            label={t('common.date')}
            type="date"
            value={condat.split('T')[0]}
            setValue={setDate}
            />
        </Grid>

        {/* Réf */}
        <Grid item xs={1}>
          <InputComponent type='text' label={t('common.ref')} value={conref} setValue={setReference} />
        </Grid>

        {/* Date Départ (as TextField) */}
        <Grid item xs={1.5} sm={2}>
          <InputComponent
                      label={t('common.dateStart')}
                      type="date"
                      value={condep.split('T')[0]}
                      setValue={setDateDepart}
          />
        </Grid>

        {/* Checkbox Après-Midi (Date Départ) */}
        <Grid item xs={1.5} sm={1.5} mt={2}>
          <CheckboxComponent label={t('common.afternoon')} value={conamdep} setValue={setApresMidiDepart} />
        </Grid>

        {/* Date Reprise (as TextField) */}
        <Grid item xs={1.5} sm={2}>
          <InputComponent
                      label={t('common.dateEnd')}
                      type="date"
                      value={conret.split('T')[0]}
                      setValue={setDateReprise}
          />
        </Grid>

        {/* Checkbox Après-Midi (Date Reprise) */}
        <Grid item xs={1.5} sm={1.4} mt={2}>
          <CheckboxComponent label={t('common.afternoon')} value={conamret} setValue={setApresMidiReprise} />
        </Grid>

        {/* Imputation */}
        <Grid  item xs={1.5}>
          <SelectInputComponent label={t('common.imputation')} value={abscod} setValue={setAbscod} maplist={absences} />
        </Grid>

        

        {/* Radio Buttons for Time Period */}
        <Grid marginTop={'20px'} item xs={4.5}>
          <RadioGroupComponent value={conjour} setValue={setTimePeriod}>
            <FormControlLabelComponent radioValue='J' label={t('common.wholeDay')} />
            <FormControlLabelComponent radioValue='M' label={t('common.mornings')} />
            <FormControlLabelComponent radioValue='A' label={t('common.afternoons')} />
          </RadioGroupComponent>
        </Grid>

        {/* Calculated Days (Read-Only) */}
        <Grid item xs={1}>
          <InputComponent type='number' label={t('common.nbDays')} value={connbjour} setValue={setConnbjour} />
        </Grid>

        {/* Submit Button */}
        <Grid item xs={3} display={'flex'} justifyContent={'space-around'} mt={2.5}>
          <IconButton color="primary" aria-label={t('common.save')} onClick={handleSubmit}>
            <SaveIcon />
          </IconButton>
          <Button onClick={resetForm} color='secondary'>{t('common.new')}</Button>
        </Grid>
      </Grid>
      <Snackbar open={isSnackbarOpen} autoHideDuration={1500} onClose={handleSnackbarClose}>
            <Alert onClose={handleSnackbarClose} severity={severity}>
                {message}
            </Alert>
      </Snackbar>
    </Box>
  )
}

export default SaisieAbsence