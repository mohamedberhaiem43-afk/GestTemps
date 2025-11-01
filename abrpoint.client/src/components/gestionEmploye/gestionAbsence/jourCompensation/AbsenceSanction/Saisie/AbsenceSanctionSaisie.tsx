import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Grid,
  IconButton,
  Snackbar,
} from '@mui/material';
import SaveIcon from "@mui/icons-material/Save";
import './AbsSanc.css'
import InputComponent from '../../../../../Inputs/Input';
import RadioGroupComponent, { FormControlLabelComponent } from '../../../../../RadioGroupComponent/RadioGroupComponent';
import SelectInputComponent from '../../../../../SelectInputComponent/SelectInputComponent';
import CheckboxComponent from '../../../../../CheckboxComponent/CheckboxComponent';
import useGetAbsencesLibs from '../../../../../../hooks/absenceHooks/useGetAbsenceLibs';
import useGetEmployee from '../../../../../../hooks/employeHooks/useGetEmployee';
import useAddSanction from '../../../../../../hooks/sanctionHooks/useAddSanction';
import useGetSanctions from '../../../../../../hooks/sanctionHooks/useGetSanctions';
import { useSanctionContext } from '../../../../../helper/SanctionContext';
import useUpdateSanction from '../../../../../../hooks/sanctionHooks/useUpdateSanction';
import { Sanction } from '../../../../../../models/Sanction';

export default function AbsenceSanctionSaisie() {
  const { selectedSanction } = useSanctionContext();
  const soccod = sessionStorage.getItem('soccod')
  const [empcod, setEmploye] = useState('');
  const [concod, setOrdre] = useState('');
  const [condat, setDate] = useState<Date|null>();
  const [conref, setReference] = useState('');
  const [condep, setDateDepart] = useState<Date|null>();
  const [conamdep, setApresMidiDepart] = useState(false);
  const [conret, setDateReprise] = useState<Date|null>();
  const [conamret, setApresMidiReprise] = useState(false);
  const [conjour, setTimePeriod] = useState('touteLaJournee');
  const [abscod, setAbscod] = useState('');
  const [connbjour, setConnbjour] = useState(0); // State for the number of days
  const [mode,setMode] = useState('save');
  const {data:absences = []} = useGetAbsencesLibs();
  const {data:employeOptions = []} = useGetEmployee();
  const {refetch} = useGetSanctions(soccod);
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'success' | 'error'>('success');
  
  const{mutate:addSanction} = useAddSanction();
  const { mutate: updateSanction } = useUpdateSanction();
  useEffect(()=>{
    if(selectedSanction){
      setEmploye(selectedSanction?.empcod || '');
      setOrdre(selectedSanction?.concod || '');
      setDate(selectedSanction?.condat);
      setReference(selectedSanction?.conref || '');
      setDateDepart(selectedSanction?.condep) ;
      setApresMidiDepart(selectedSanction?.conamdep === "1");
      setDateReprise(selectedSanction?.conret);
      setApresMidiReprise(selectedSanction?.conamret === "1");
      setTimePeriod(selectedSanction?.conjour || 'J');
      setAbscod(selectedSanction?.abscod || '');
      setConnbjour(selectedSanction?.connbjour || 0);

      setMode('edit');
    }

  },[selectedSanction])
  // Effect to calculate number of days between condep and conret
  useEffect(() => {
    if (condep && conret) {
      const dateDepart = new Date(condep);
      const dateReprise = new Date(conret);
      const differenceInTime = dateReprise.getTime() - dateDepart.getTime();
      const daysDifference = differenceInTime / (1000 * 3600 * 24); // Convert from ms to days
      setConnbjour(daysDifference );
    }

  }, [condep, conret]);

  const handleSubmit = (event: any) => {
    event.preventDefault();
    let sanctionData:Sanction
    sanctionData = {
      soccod,
      empcod,
      concod,
      condat: condat ? new Date(condat) : null,
      conref,
      condep: condep ? new Date(condep) : null,
      conamdep: conamdep ? '1' : '0',
      conret: conret ? new Date(conret) : null,
      conamret: conamret ? '1' : '0',
      connbjour,
      conjour,
      abscod,
    };
    if(mode === 'save'){
        // Send a POST request to insert the sanction data
        addSanction(sanctionData,{
          onSuccess() {
            refetch();
            handleSnackbarOpening("Ajout de sanction avec sucées",'success');
            resetForm();
          },
          onError() {
            handleSnackbarOpening("Echec d'ajout de sanction",'error');
          },
        })
    }else if(mode === 'edit'){
      updateSanction(sanctionData,{
        onSuccess() {
          handleSnackbarOpening("Modification de sanction avec sucées",'success');
          resetForm();
          refetch();
        },
        onError() {
          handleSnackbarOpening("Probléme lors de modification de sanction",'error');
        },
      })
    }
  }
  const resetForm = () => {
    setEmploye('');
    setOrdre('');
    setDate(new Date());
    setReference('');
    setDateDepart(new Date());
    setApresMidiDepart(false);
    setDateReprise(new Date());
    setApresMidiReprise(false);
    setTimePeriod('J');
    setAbscod('');
    setConnbjour(0);

    setMode('save');
  }
  const handleSnackbarOpening = (message:string,severity:'success'|'error') => {
    setMessage(message);
    setSeverity(severity);
    setIsSnackbarOpen(true);
  };
  const handleSnackbarClose = () =>{
    setIsSnackbarOpen(false);
  }
  return (
    <Box component="form" sx={{ maxWidth: 1200, mx: 'auto', p: 1 }} onSubmit={handleSubmit}>
      <Grid container spacing={1.5}>
        {/* Employe Selection */}
        <Grid item xs={1.5}>
          <SelectInputComponent label='Employé' value={empcod} setValue={setEmploye} maplist={employeOptions} />
        </Grid>

        {/* N° Ordre */}
        <Grid item xs={1} sm={1}>
          <InputComponent type='text' label='N° Ordre' value={concod} setValue={setOrdre} />
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
        <Grid item xs={1.5} sm={1.5} mt={2}>
          <CheckboxComponent label='Après-Midi' value={conamdep} setValue={setApresMidiDepart} />
        </Grid>

        {/* Date Reprise (as TextField) */}
        <Grid item xs={1.5} sm={2}>
          <InputComponent type='date' label='Date Retour' value={conret} setValue={setDateReprise} />
        </Grid>

        {/* Checkbox Après-Midi (Date Reprise) */}
        <Grid item xs={1.5} sm={1.4} mt={2}>
          <CheckboxComponent label='Après-Midi' value={conamret} setValue={setApresMidiReprise} />
        </Grid>

        {/* Imputation */}
        <Grid  item xs={1.5}>
          <SelectInputComponent label='Imputation' value={abscod} setValue={setAbscod} maplist={absences} />
        </Grid>

        

        {/* Radio Buttons for Time Period */}
        <Grid marginTop={'20px'} item xs={4.5}>
          <RadioGroupComponent value={conjour} setValue={setTimePeriod}>
            <FormControlLabelComponent radioValue='J' label='Toute la Journée' />
            <FormControlLabelComponent radioValue='M' label='Les Matinées' />
            <FormControlLabelComponent radioValue='A' label='Les Aprés-Midi' />
          </RadioGroupComponent>
        </Grid>

        {/* Calculated Days (Read-Only) */}
        <Grid item xs={1}>
          <InputComponent type='number' label='Nb.Jours' value={connbjour} setValue={setConnbjour} />
        </Grid>

        {/* Submit Button */}
        <Grid item xs={3} display={'flex'} justifyContent={'space-around'} mt={2.5}>
          <IconButton color="primary" aria-label="save" onClick={handleSubmit}>
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
