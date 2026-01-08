import { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  InputLabel,
  Typography,
  IconButton,
  Input,
  Button,
  Alert,
  Snackbar,
} from '@mui/material';
import SaveIcon from "@mui/icons-material/Save";
import './DemCongeInputs.css'
import SelectInputComponent from '../../../SelectInputComponent/SelectInputComponent';
import InputComponent from '../../../Inputs/Input';
import CheckboxComponent from '../../../CheckboxComponent/CheckboxComponent';
import RadioGroupComponent, { FormControlLabelComponent } from '../../../RadioGroupComponent/RadioGroupComponent';
import useGetAbsencesLibs from '../../../../hooks/absenceHooks/useGetAbsenceLibs';
import useGetEmployee from '../../../../hooks/employeHooks/useGetEmployee';
import useAddDemConge from '../../../../hooks/congeHooks/useAddDemConge';
import useGetDemConges from '../../../../hooks/congeHooks/useGetDemConges';
import { useCongeContext } from '../../../helper/CongeContext';
import useUpdateDemConge from '../../../../hooks/congeHooks/useUpdateConge';
import { Conge } from '../../../../models/Conge';
import { getDatePartFromDate } from '../../../helper/TimeConverter/ExtractDateOnly';
import { useAuth } from '../../../helper/AuthProvider';
import generateNumeroOrdre from '../../../helper/GenerateNumOrdre';

export default function CongeForm() {
  const { selectedConge } = useCongeContext();
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const { soccod } = useAuth();
  const [empcod, setEmploye] = useState('');
  const [concod, setOrdre] = useState(generateNumeroOrdre());

  // Valeur par défaut: date d'aujourd'hui
  const [condat, setDate] = useState<Date | string>(getTodayDate());
  const [conref, setReference] = useState('');
  // Valeur par défaut: date d'aujourd'hui
  const [condep, setDateDepart] = useState<Date | string>(getTodayDate());
  const [conamdep, setApresMidiDepart] = useState(false);
  // Valeur par défaut: date d'aujourd'hui
  const [conret, setDateReprise] = useState<Date | string>(getTodayDate());
  const [conamret, setApresMidiReprise] = useState(false);
  const [conadr, setImputationAdresse] = useState('');
  const [contel, setTelephones] = useState('');
  const [conjour, setTimePeriod] = useState('J'); // Valeur par défaut: 'J' (Toute la Journée)
  const [abscod, setAbscod] = useState('');
  const [connbjour, setConnbjour] = useState(0);
  const [mode,setMode] = useState('save');
  const { data:absences = [] } = useGetAbsencesLibs();
  const { data:employeOptions = [] } = useGetEmployee();
  const { refetch } = useGetDemConges();
  const mutation = useAddDemConge();
  const { mutate: updateDemConge,isLoading:updateLoading} = useUpdateDemConge();
  const [writable,setWritable] = useState(true)
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'error'|'success'>('success');
  
  useEffect(() => {
    if (selectedConge) {
      setEmploye(selectedConge.empcod);
      setAbscod(selectedConge.abscod);
      setReference(selectedConge.conref);
      setTelephones(selectedConge.contel);
      setDateReprise(getDatePartFromDate(selectedConge.conret));
      setDate(getDatePartFromDate(selectedConge.condat));
      setDateDepart(getDatePartFromDate(selectedConge.condep));
      setApresMidiDepart(selectedConge.conamdep === '1');
      setTimePeriod(selectedConge.conjour);
      setConnbjour(selectedConge.connbjour);
      setOrdre(selectedConge.concod);
      setImputationAdresse(selectedConge.conadr);
      setApresMidiReprise(selectedConge.conamret === '1');
      setWritable(false);
      setMode('edit');
    }
  }, [selectedConge]);
  

  // Effect to calculate number of days between condep and conret
  useEffect(() => {
    if (condep && conret) {
      const dateDepart = new Date(condep);
      const dateReprise = new Date(conret);
      const differenceInTime = dateReprise.getTime() - dateDepart.getTime();
      const daysDifference = differenceInTime / (1000 * 3600 * 24); // Convert from ms to days
      setConnbjour(daysDifference);
    }

  }, [condep, conret]);

  const handleSubmit = (event:any) => {
    event.preventDefault();
    const congeData:Conge = {
      soccod:soccod || '', // already aligned with 'Soccod'
      empcod, // already aligned with 'Empcod'
      concod, // already aligned with 'Concod'
      condat: condat ? new Date(condat) : null, // Convert string date to DateTime format
      conref, // already aligned with 'Conref'
      condep: condep ? new Date(condep) : null, // Convert string date to DateTime format
      conamdep: conamdep ? '1' : '0', // Convert boolean to string '1' or '0'
      conret: conret ? new Date(conret) : null, // Convert string date to DateTime format
      conamret: conamret ? '1' : '0', // Convert boolean to string '1' or '0'
      conadr, // already aligned with 'Conadr'
      contel, // already aligned with 'Contel'
      connbjour, // already aligned with 'Connbjour'
      conjour, // already aligned with 'Conjour' (string)
      abscod ,
      emplib: null,
      condg: '',
      conrefus: '',
      consolde: 0
    };
    if(mode === 'save'){
      mutation.mutate(congeData, {
        onSuccess: () => {
            handleSnackbarOpening("Demande de congé ajoutée avec succées",'success');
            resetForm();
          },
          onError: () => {
            handleSnackbarOpening("Echéc d'ajout de la demande de congé",'error');
          },
        });
      }else if(mode === 'edit'){
        updateDemConge(congeData,{
        onSuccess() {
          handleSnackbarOpening("Demande de congé modifiée avec succées",'success');
          resetForm();
        },
        onError() {
          handleSnackbarOpening("Echéc de modification de la demande de congé",'error');
        },
      })
    }

  };

  const resetForm = () => {
    setEmploye('');
    setAbscod('');
    setReference('');
    setTelephones('');
    setDateReprise(new Date());
    setApresMidiDepart(false);
    setTimePeriod('J');
    setConnbjour(0);
    setOrdre('');
    setImputationAdresse('');
    setDate(new Date());
    setApresMidiReprise(false);
    setDateDepart(new Date());
    setWritable(true);
    setMode('save');
    refetch();
  }

  
  const handleSnackbarOpening = (message:string,severity:'error'|'success') => {
    setMessage(message);
    setSeverity(severity);
    setIsSnackbarOpen(true);
  };
  const handleSnackbarClose = () => {
    setIsSnackbarOpen(false);
  };

  return (
    <Box component="form" sx={{ maxWidth: 1200, mx: 'auto', p: 3 }} onSubmit={handleSubmit}>
      <Typography variant="h6" textAlign="center" color={'primary'} fontWeight={'bold'} mb={2}>
        Demande de Congés
      </Typography>
      <Grid container spacing={2}>
        {/* Employe Selection */}
        <Grid item xs={1.5}>
          <SelectInputComponent label='Employé' value={empcod} setValue={setEmploye} maplist={employeOptions} />
        </Grid>

        {/* N° Ordre */}
        <Grid item xs={1} sm={1}>
          <InputComponent readOnly={!writable} type='text' label='N° Ordre' value={concod} setValue={setOrdre} />
        </Grid>

        {/* Date (as TextField) */}
        <Grid item xs={1.5} sm={2}>
          <InputComponent type='date' label='Date' value={condat} setValue={setDate} />
        </Grid>

        {/* Réf */}
        <Grid item xs={1}>
          <InputComponent type='text' label='Réf' value={conref} setValue={setReference} />
        </Grid>

        {/* Date Départ (as TextField) */}
        <Grid item xs={1.5} sm={2}>
          <InputComponent type='date' label='Date Départ' value={condep} setValue={setDateDepart} />
        </Grid>

        {/* Checkbox Après-Midi (Date Départ) */}
        <Grid item xs={1.3} sm={1.5} mt={2}>
          <CheckboxComponent label='Après-Midi' value={conamdep} setValue={setApresMidiDepart} />
        </Grid>

        {/* Date Reprise (as TextField) */}
        <Grid item xs={1.5} sm={2}>
          <InputComponent type='date' label='Date Retour' value={conret} setValue={setDateReprise} />
        </Grid>

        {/* Checkbox Après-Midi (Date Reprise) */}
        <Grid item xs={1.5} sm={1.3} mt={2}>
          <CheckboxComponent label='Après-Midi' value={conamret} setValue={setApresMidiReprise} />
        </Grid>

        <Grid  item xs={1.5} mt={0.5}>
          <SelectInputComponent label='Imputation' value={abscod} setValue={setAbscod} maplist={absences} />
        </Grid>

        {/* Checkbox Imputation Adresse Durant le Congé */}
        <Grid item xs={2}>
          <InputComponent type='text' label='Adresse de congé' value={conadr} setValue={setImputationAdresse} />
        </Grid>

        {/* Téléphones */}
        <Grid item xs={1.5}>
        <InputComponent type='tel' label='Téléphone' value={contel} setValue={setTelephones} />
        </Grid>

        {/* Radio Buttons for Time Period */}
        <Grid marginTop={'20px'} item xs={4.3}>
        <RadioGroupComponent value={conjour} setValue={setTimePeriod}>
            <FormControlLabelComponent radioValue="J" label="Toute la Journée" />
            <FormControlLabelComponent radioValue="M" label="Les Matinées" />
            <FormControlLabelComponent radioValue="A" label="Les Après-Midi" />
        </RadioGroupComponent>
        </Grid>

        {/* Calculated Days (Read-Only) */}
        <Grid item xs={1}>

        <InputLabel shrink>Nb.Jours</InputLabel>

          <Input
            size="small"
            fullWidth
            value={connbjour}
            readOnly
          />
        </Grid>

        {/* Submit Button */}
        <Grid item mt={2}>
          <IconButton color="primary" aria-label="save" onClick={handleSubmit} disabled={updateLoading}>
            <SaveIcon />
          </IconButton>
          <Button onClick={resetForm} color='secondary'>Nouveau</Button>
        </Grid>
      </Grid>
       <Snackbar open={isSnackbarOpen} autoHideDuration={1500} onClose={handleSnackbarClose}>
            <Alert onClose={handleSnackbarClose} severity={severity}>
              {message}
            </Alert>
        </Snackbar>
    </Box>
  );
}
