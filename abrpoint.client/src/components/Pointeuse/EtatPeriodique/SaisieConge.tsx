import { useEffect, useState } from 'react';
import { Box, Grid, IconButton, Button, Snackbar, Alert } from '@mui/material';
import SaveIcon from "@mui/icons-material/Save";
import useGetAbsencesLibs from '../../../hooks/absenceHooks/useGetAbsenceLibs';
import useAddConge from '../../../hooks/congeHooks/useAddConge';
import { Conge } from '../../../models/Conge';
import InputComponent from '../../Inputs/Input';
import SelectInputComponent from '../../SelectInputComponent/SelectInputComponent';
import CheckboxComponent from '../../CheckboxComponent/CheckboxComponent';
import RadioGroupComponent, { FormControlLabelComponent } from '../../RadioGroupComponent/RadioGroupComponent';
import formatDateForApi from '../../helper/TimeConverter/formatDateForApi';
import generateNumeroOrdre from '../../helper/GenerateNumOrdre';

export default function SaisieConge({ empcod,date }: { empcod: string,date:string }) {
const [concod, setOrdre] = useState(generateNumeroOrdre());
const [condat, setDate] = useState<string>(() => {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate());
  return formatDateForApi(tomorrow);
});
  const [conref, setReference] = useState('');
  const [condep, setDateDepart] = useState<string|null>(() => {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate());
    return formatDateForApi(tomorrow);
  });
    const [conamdep, setApresMidiDepart] = useState(false);
    const [conret, setDateReprise] = useState<string|null>(() => {
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

  const { data:absences = [] } = useGetAbsencesLibs();
  const { mutate: addConge } = useAddConge();
  const [writable,setWritable] = useState(true)
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'success' | 'error'>('success');



  useEffect(() => {
  if (condep && conret) {
    const startDate = new Date(condep);
    const endDate = new Date(conret);
    const timeDiff = endDate.getTime() - startDate.getTime();
    const dayDiff = timeDiff / (1000 * 3600 * 24); // Convert milliseconds to days
    setNbJour(dayDiff >= 0 ? dayDiff : 0); // Ensure it's not negative and include both start and end days
  }
}, [condep, conret]);

  const handleSnackbarClose = () => {
    setIsSnackbarOpen(false);
  };
  const handleSubmit = () => {
      const congeData:Conge = {
        soccod: soccod || "01",
        empcod,
        emplib:null,
        concod,
        condat:new Date(condat!),
        conref,
        condep:new Date(condep!),
        conamdep:conamdep?'1':'0',
        conret:new Date(conret!),
        conamret:conamret?'1':'0',
        conadr,
        contel,
        condg,
        connbjour,
        abscod,
        conjour: conjour,
        conrefus: '',
        consolde: 0
      };
      console.log(conamret)
      if(congeData.empcod=='' && congeData.concod==''){
        handleSnackbarOpening("Veuillez remplir tous les champs obligatoires",'error');
        return;
      }
        addConge(congeData, {
          onSuccess: () => {
            handleSnackbarOpening("Congé ajouté avec succées",'success');
            resetForm();
          },
          onError: () => {
            handleSnackbarOpening("Echéc lors l'ajout de congé",'error');
          }
        });
      
  };
 
  const handleSnackbarOpening = (message: string, severity: 'success' | 'error') => {
      setMessage(message);
      setSeverity(severity);
      setIsSnackbarOpen(true);
    };
  
  const resetForm = () => {
    setAbscod('');
    setReference('');
    setTelephones('');
    setDateReprise(null);
    setApresMidiDepart(false);
    setTimePeriod('');
    setNbJour(0);
    setOrdre('');
    setImputationAdresse('');
    setDate('');
    setApresMidiReprise(false);
    setDateDepart(null);
    setWritable(true);
  }

  
  return (
    <Box component="form" sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Grid container spacing={2.8}>
      <Grid item xs={1} sm={1.5}>
          <InputComponent readOnly={!writable} label="N° Ordre" type="text" value={concod} setValue={setOrdre} />
        </Grid>

        <Grid item xs={1.7} sm={2}>
          <InputComponent
            label="Date"
            type="date"
            value={condat}
            setValue={setDate}
          />
        </Grid>

        <Grid item xs={1}>
          <InputComponent label="Réf" type="text" value={conref} setValue={setReference} />
        </Grid>

        <Grid item xs={1.7} sm={2}>
          <InputComponent
            label="Date Départ"
            type="date"
            value={condep}
            setValue={setDateDepart}
          />
        </Grid>

        <Grid item xs={1.5} sm={2} mt={2}>
          <CheckboxComponent label="Après-Midi" value={conamdep} setValue={setApresMidiDepart} />
        </Grid>

        <Grid item xs={1.7} sm={2.1}>
          <InputComponent
            label="Date Retour"
            type="date"
            value={conret}
            setValue={setDateReprise}
          />
        </Grid>

        <Grid item xs={1.5} sm={2} mt={2}>
          <CheckboxComponent label="Après-Midi" value={conamret} setValue={setApresMidiReprise} />
        </Grid>

        <Grid item xs={1.5}>
          <SelectInputComponent label="Imputation" value={abscod} setValue={setAbscod} maplist={absences} />
        </Grid>

        <Grid item xs={2}>
          <InputComponent type='text' label='Adresse de congé' value={conadr} setValue={setImputationAdresse} />
        </Grid>

        <Grid item xs={1.5}>
          <InputComponent label="Téléphone" type="tel" value={contel} setValue={setTelephones} />
        </Grid>

        <Grid item xs={4.5} marginTop={2}>
          <RadioGroupComponent value={conjour} setValue={setConjour}>
            <FormControlLabelComponent radioValue="J" label="Toute la Journée" />
            <FormControlLabelComponent radioValue="M" label="Les Matinées" />
            <FormControlLabelComponent radioValue="A" label="Les Après-Midi" />
          </RadioGroupComponent>
        </Grid>

        <Grid item xs={1}>
          <InputComponent label="Nb.Jours" type="number" value={connbjour} setValue={setNbJour} readOnly />
        </Grid>

        
        {/* Save Button */}
        <Grid item mt={2}>
          <IconButton color="primary" aria-label="save" onClick={handleSubmit} >
            <SaveIcon />
          </IconButton>
          <Button onClick={resetForm} color='secondary'>Nouveau</Button>
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
