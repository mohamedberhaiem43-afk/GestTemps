import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Grid, IconButton, Button, Snackbar, Alert, CircularProgress } from '@mui/material';
import SaveIcon from "@mui/icons-material/Save";
import useGetAbsencesLibs from '../../../hooks/absenceHooks/useGetAbsenceLibs';
import useAddConge from '../../../hooks/congeHooks/useAddConge';
import useGetCongeByDate from '../../../hooks/congeHooks/useGetCongeByDate';
import { Conge } from '../../../models/Conge';
import InputComponent from '../../Inputs/Input';
import SelectInputComponent from '../../SelectInputComponent/SelectInputComponent';
import CheckboxComponent from '../../CheckboxComponent/CheckboxComponent';
import RadioGroupComponent, { FormControlLabelComponent } from '../../RadioGroupComponent/RadioGroupComponent';
import formatDateForApi from '../../helper/TimeConverter/formatDateForApi';
import generateNumeroOrdre from '../../helper/GenerateNumOrdre';

export default function SaisieConge({ empcod, date }: { empcod: string; date: string }) {
  const { t } = useTranslation();
  const [concod, setOrdre] = useState(generateNumeroOrdre());
  const [condat, setDate] = useState<string>(() => {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate());
    return formatDateForApi(tomorrow);
  });
  const [conref, setReference] = useState('');
  const [condep, setDateDepart] = useState<string | null>(() => {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate());
    return formatDateForApi(tomorrow);
  });
  const [conamdep, setApresMidiDepart] = useState(false);
  const [conret, setDateReprise] = useState<string | null>(() => {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDateForApi(tomorrow);
  });
  const [conamret, setApresMidiReprise] = useState(false);
  const [conadr, setImputationAdresse] = useState('');
  const [contel, setTelephones] = useState('');
  const [condg, setTimePeriod] = useState('J');
  const [conjour, setConjour] = useState('J');
  const [abscod, setAbscod] = useState('1');
  const [connbjour, setNbJour] = useState(0);
  const soccod = sessionStorage.getItem('soccod');

  const { data: absences = [] } = useGetAbsencesLibs();
  const { data: existingConge, isLoading: isLoadingConge } = useGetCongeByDate(empcod, date);
  const { mutate: addConge } = useAddConge();
  const [writable, setWritable] = useState(true);
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'success' | 'error'>('success');
  const [isEditMode, setIsEditMode] = useState(false);

  // Load existing congé data when available
  useEffect(() => {
    if (existingConge && existingConge.concod) {
      setIsEditMode(true);
      setOrdre(existingConge.concod || generateNumeroOrdre());
      
      if (existingConge.condat) {
        setDate(formatDateForApi(new Date(existingConge.condat)));
      }
      
      setReference(existingConge.conref || '');
      
      if (existingConge.condep) {
        setDateDepart(formatDateForApi(new Date(existingConge.condep)));
      }
      
      setApresMidiDepart(existingConge.conamdep === '1');
      
      if (existingConge.conret) {
        setDateReprise(formatDateForApi(new Date(existingConge.conret)));
      }
      
      setApresMidiReprise(existingConge.conamret === '1');
      setImputationAdresse(existingConge.conadr || '');
      setTelephones(existingConge.contel || '');
      setTimePeriod(existingConge.condg || 'J');
      setConjour(existingConge.conjour || 'J');
      setAbscod(existingConge.abscod || '1');
      setNbJour(existingConge.connbjour || 0);
      setWritable(false); // Make it read-only for existing congé
    }
  }, [existingConge]);

  useEffect(() => {
    if (condep && conret) {
      const startDate = new Date(condep);
      const endDate = new Date(conret);
      const timeDiff = endDate.getTime() - startDate.getTime();
      const dayDiff = timeDiff / (1000 * 3600 * 24);
      setNbJour(dayDiff >= 0 ? dayDiff : 0);
    }
  }, [condep, conret]);

  const handleSnackbarClose = () => {
    setIsSnackbarOpen(false);
  };

  const handleSubmit = () => {
    const congeData: Conge = {
      soccod: soccod || "01",
      empcod,
      emplib: null,
      concod,
      condat: new Date(condat!),
      conref,
      condep: new Date(condep!),
      conamdep: conamdep ? '1' : '0',
      conret: new Date(conret!),
      conamret: conamret ? '1' : '0',
      conadr,
      contel,
      condg,
      connbjour,
      abscod,
      conjour: conjour,
      conrefus: '',
      consolde: 0
    };

    if (congeData.empcod === '' && congeData.concod === '') {
      handleSnackbarOpening(t('common.requiredFields'), 'error');
      return;
    }

    addConge(congeData, {
      onSuccess: () => {
        handleSnackbarOpening(t('conge.added'), 'success');
        resetForm();
      },
      onError: () => {
        handleSnackbarOpening(t('conge.addError'), 'error');
      }
    });
  };

  const handleSnackbarOpening = (message: string, severity: 'success' | 'error') => {
    setMessage(message);
    setSeverity(severity);
    setIsSnackbarOpen(true);
  };

  const resetForm = () => {
    setAbscod('1');
    setReference('');
    setTelephones('');
    setDateReprise(formatDateForApi(new Date(date)));
    setApresMidiDepart(false);
    setTimePeriod('J');
    setNbJour(0);
    setOrdre(generateNumeroOrdre());
    setImputationAdresse('');
    setDate(formatDateForApi(new Date(date)));
    setApresMidiReprise(false);
    setDateDepart(formatDateForApi(new Date(date)));
    setConjour('J');
    setWritable(true);
    setIsEditMode(false);
  };

  if (isLoadingConge) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress size={30} />
      </Box>
    );
  }

  return (
    <Box component="form" sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Grid container spacing={2.8}>
        <Grid item xs={1} sm={1.5}>
          <InputComponent readOnly={!writable} label={t('conge.orderNumber')} type="text" value={concod} setValue={setOrdre} />
        </Grid>

        <Grid item xs={1.7} sm={2}>
          <InputComponent
            label={t('common.date')}
            type="date"
            value={condat}
            setValue={setDate}
            readOnly={isEditMode}
          />
        </Grid>

        <Grid item xs={1}>
          <InputComponent label={t('common.ref')} type="text" value={conref} setValue={setReference} readOnly={isEditMode} />
        </Grid>

        <Grid item xs={1.7} sm={2}>
          <InputComponent
            label={t('common.dateStart')}
            type="date"
            value={condep}
            setValue={setDateDepart}
            readOnly={isEditMode}
          />
        </Grid>

        <Grid item xs={1.5} sm={2} mt={2}>
          <CheckboxComponent label={t('common.afternoon')} value={conamdep} setValue={setApresMidiDepart} />
        </Grid>

        <Grid item xs={1.7} sm={2.1}>
          <InputComponent
            label={t('common.dateEnd')}
            type="date"
            value={conret}
            setValue={setDateReprise}
            readOnly={isEditMode}
          />
        </Grid>

        <Grid item xs={1.5} sm={2} mt={2}>
          <CheckboxComponent label={t('common.afternoon')} value={conamret} setValue={setApresMidiReprise} />
        </Grid>

        <Grid item xs={1.5}>
          <SelectInputComponent 
            label={t('common.imputation')} 
            value={abscod} 
            setValue={setAbscod} 
            maplist={absences} 
          />
        </Grid>

        <Grid item xs={2}>
          <InputComponent type='text' label={t('conge.address')} value={conadr} setValue={setImputationAdresse} readOnly={isEditMode} />
        </Grid>

        <Grid item xs={1.5}>
          <InputComponent label={t('common.phone')} type="tel" value={contel} setValue={setTelephones} readOnly={isEditMode} />
        </Grid>

        <Grid item xs={4.5} marginTop={2}>
          <RadioGroupComponent value={conjour} setValue={setConjour} >
            <FormControlLabelComponent radioValue="J" label={t('common.wholeDay')} />
            <FormControlLabelComponent radioValue="M" label={t('common.mornings')} />
            <FormControlLabelComponent radioValue="A" label={t('common.afternoons')} />
          </RadioGroupComponent>
        </Grid>

        <Grid item xs={1}>
          <InputComponent label={t('common.nbDays')} type="number" value={connbjour} setValue={setNbJour} readOnly />
        </Grid>

        <Grid item mt={2}>
          {!isEditMode && (
            <>
              <IconButton color="primary" aria-label={t('common.save')} onClick={handleSubmit}>
                <SaveIcon />
              </IconButton>
              <Button onClick={resetForm} color='secondary'>{t('common.new')}</Button>
            </>
          )}
          {isEditMode && (
            <Button onClick={resetForm} color='primary'>{t('conge.createNew')}</Button>
          )} 
        </Grid>
      </Grid>
      <Snackbar open={isSnackbarOpen} autoHideDuration={1000} onClose={handleSnackbarClose}>
        <Alert onClose={handleSnackbarClose} severity={severity}>
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}