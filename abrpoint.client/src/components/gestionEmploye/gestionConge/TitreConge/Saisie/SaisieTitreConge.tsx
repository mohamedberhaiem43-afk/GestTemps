import { useEffect, useState } from 'react';
import { Box, Typography, Grid, IconButton, Button, Snackbar, Alert, Collapse } from '@mui/material';
import SaveIcon from "@mui/icons-material/Save";
import InputComponent from '../../../../Inputs/Input';
import SelectInputComponent from '../../../../SelectInputComponent/SelectInputComponent';
import CheckboxComponent from '../../../../CheckboxComponent/CheckboxComponent';
import RadioGroupComponent, { FormControlLabelComponent } from '../../../../RadioGroupComponent/RadioGroupComponent';
import CheckboxListSecondary from '../../../../CheckboxList/CheckboxListSecondary';
import useGetAbsencesLibs from '../../../../../hooks/absenceHooks/useGetAbsenceLibs';
import useGetEmployee from '../../../../../hooks/employeHooks/useGetEmployee';
import useAddConge from '../../../../../hooks/congeHooks/useAddConge';
import useGetTitreConge from '../../../../../hooks/congeHooks/useGetTitreConge';
import useGetTitreCongeById from '../../../../../hooks/congeHooks/useGetTitreCongeById';
import useAddBulkConges from '../../../../../hooks/congeHooks/useAddBulkConges';
import useGetEtatConge from '../../../../../hooks/employeHooks/useGetEtatConge';
import { useCongeContext } from '../../../../helper/CongeContext';
import useUpdateTitreConge from '../../../../../hooks/congeHooks/useUpdateTitreConge';
import { Conge } from '../../../../../models/Conge';
import EtatConge from '../../../../../models/EtatConge';
import getDatePart from '../../../../helper/TimeConverter/ExtractDateOnly';


export default function TitreCongeForm({ titre }:{titre:string}) {
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const [condep, setDateDepart] = useState<string | null>(getTodayDate());
  const [conret, setDateReprise] = useState<string | null>(getTodayDate());
  const [empcod, setEmploye] = useState('');
  const [concod, setOrdre] = useState('');
  const [condat, setDate] = useState<string | null>(getTodayDate());
  const [conref, setReference] = useState('');
  const [conamdep, setApresMidiDepart] = useState(false);
  const [conamret, setApresMidiReprise] = useState(false);
  const [conadr, setImputationAdresse] = useState('');
  const [contel, setTelephones] = useState('');
  const [condg, setTimePeriod] = useState('J');
  const [conjour, setConjour] = useState('J');
  const [abscod, setAbscod] = useState('');
  const [connbjour, setNbJour] = useState(0);
  const [showExceptionList, setShowExceptionList] = useState(false);
  const [checkedEmployees, setCheckedEmployees] = useState<number[]>([]); // State to manage checked employees
  const soccod =sessionStorage.getItem('soccod');

const moisdeb = condep ? new Date(condep).getMonth() + 1 : null; // Months are 0-based, add 1
const moisfin = conret ? new Date(conret).getMonth() + 1 : null;
const annee = condep ? new Date(condep).getFullYear() : null; // Use year from condep
  
const [showEtatConge, setShowEtatConge] = useState(false);
const [etatCongeError, setEtatCongeError] = useState('');
const { data: etatConge = {} as EtatConge, refetch: refetchEtatConge } = useGetEtatConge(soccod, empcod, moisdeb, moisfin, annee);
const { mutate:updateConge } = useUpdateTitreConge();


useEffect(() => {
  if (empcod && moisdeb && moisfin && annee) {
    refetchEtatConge();
    setShowEtatConge(true);
  }
}, [empcod, moisdeb, moisfin, annee, refetchEtatConge]);

// Checking if anciennete is less than 0
useEffect(() => {
  if (etatConge?.anciennete < 0) {
    setEtatCongeError("L'employé n'est pas embauché dans le date spécifié.");
  } else {
    setEtatCongeError('');
  }
}, [etatConge]);


  const generateUniqueConcod = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters[randomIndex];
    }
    return result;
  };
  const { data:emp = [] } = useGetEmployee();
  const { data:absences = [] } = useGetAbsencesLibs();
  const { mutate: addConge } = useAddConge();
  const { mutate: addBulkConge } = useAddBulkConges();
  const { selectedConge } = useCongeContext();
  const { data: congeToEdit = [] } = useGetTitreCongeById(selectedConge?.concod || '');
  const [mode,setMode] = useState('save');
  const [writable,setWritable] = useState(true)
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'success' | 'error'>('success');

  const {refetch} = useGetTitreConge()
  useEffect(() => {
    if (congeToEdit.concod && titre != "Titre de Congés Génerale") {
      setEmploye(congeToEdit?.empcod || '');
      setOrdre(congeToEdit?.concod || '');
      setDate(getDatePart(congeToEdit?.condat) || null);
      setDateDepart(getDatePart(congeToEdit?.condep) || null);
      setDateReprise(getDatePart(congeToEdit?.conret) || null);
      setReference(congeToEdit?.conref || '');
      setApresMidiDepart(congeToEdit?.conamdep === '1');
      setApresMidiReprise(congeToEdit?.conamret ==='1');
      setImputationAdresse(congeToEdit?.conadr || '');
      setTelephones(congeToEdit?.contel || '');
      setTimePeriod(congeToEdit?.condg || 'J');
      setConjour(congeToEdit?.conjour || 'J');
      setAbscod(congeToEdit?.abscod || '');
      setNbJour(congeToEdit?.connbjour || 0);
      setWritable(false);
      setMode('edit');
    }
  }, [congeToEdit]);

useEffect(() => {
  if (condep && conret) {
    const startDate = new Date(condep);
    const endDate = new Date(conret);

    if (endDate < startDate) {
      setNbJour(0);
      return;
    }

    const timeDiff = endDate.getTime() - startDate.getTime();
    const fullDaysBetween = timeDiff / (1000 * 3600 * 24) - 1; // jours entre début et fin, excluant les extrémités
    let totalDays = 0;

    // 🔹 Premier jour
    totalDays += conamdep ? 0.5 : 1;

    // 🔹 Dernier jour
    totalDays += conamret ? 0.5 : 1;

    // 🔹 Jours intermédiaires
    if (fullDaysBetween > 0) {
      if (conjour === 'J') {
        totalDays += fullDaysBetween;
      } else {
        totalDays += fullDaysBetween * 0.5;
      }
    }

    setNbJour(Number(totalDays.toFixed(2)) - 1);
  }
}, [condep, conret, conamdep, conamret, conjour]);


  const handleToggle = (value: number) => () => {
    const currentIndex = checkedEmployees.indexOf(value);
    const newChecked = [...checkedEmployees];

    if (currentIndex === -1) {
      newChecked.push(value);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    setCheckedEmployees(newChecked);
  };
  const handleSnackbarClose = () => {
    setIsSnackbarOpen(false);
  };
  const handleSubmit = () => {
    if (titre === "Titre de Congés Génerale") {
      const employeesArray = Object.entries(emp);
      const employeesToSubmit = employeesArray.filter(([], index) => !checkedEmployees.includes(index));
  
      const congeDataArray = employeesToSubmit.map(([empcod]) => ({
        empcod,
        concod: generateUniqueConcod(),
        condat,
        conref,
        condep,
        conamdep:conamdep ? '1' : '0',
        conret,
        conamret:conamret ? '1' : '0',
        conadr,
        contel,
        condg,
        connbjour,
        abscod,
        soccod: sessionStorage.getItem('soccod')
      }));

      
      addBulkConge(congeDataArray, {
        onSuccess: () => {
          handleSnackbarOpening("Conges sont ajoutées avec succées",'success');
          resetForm();
        },
        onError: () => {
          handleSnackbarOpening("Echéc lors l'ajout des Congés",'error');
          resetForm();
        }
      });
    } else {
      const congeData:Conge = {
        soccod: soccod || "01",
        empcod,
        concod,
        condat:new Date(condat || ''),
        conref,
        condep:new Date(condep || ''),
        conamdep: conamdep ? '1' : '0',
        conret:new Date(conret || ''),
        conamret: conamdep ? '1' : '0',
        conadr,
        contel,
        condg,
        connbjour,
        abscod,
        conjour: conjour,
        conrefus: '',
        consolde: 0,
        emplib: null
      };
      if(congeData.empcod=='' && congeData.concod==''){
        handleSnackbarOpening("Veuillez remplir tous les champs obligatoires",'error');
        return;
      }
      if(mode === 'save'){
        addConge(congeData, {
          onSuccess: () => {
            handleSnackbarOpening("Congé ajouté avec succées",'success');
            resetForm();
          },
          onError: () => {
            handleSnackbarOpening("Echéc lors l'ajout de congé",'error');
          }
        });
      }else if (mode === 'edit'){
        updateConge(congeData,{
          onSuccess() {
            handleSnackbarOpening("Congé modifié avec succées",'success');
            resetForm();
          },
          onError() {
            handleSnackbarOpening("Echéc lors de la modification de congé",'error');
          },
        })
      }
      
    }
  };
  

  const toggleExceptionList = () => {
    setShowExceptionList(prev => !prev);
  };
  const handleSnackbarOpening = (message:string,severity:'error'|'success') => {
    setMessage(message);
    setSeverity(severity);
    setIsSnackbarOpen(true);
  };
  
  const resetForm = () => {
    setEmploye('');
    setAbscod('');
    setReference('');
    setTelephones('');
    setDateReprise(null);
    setApresMidiDepart(false);
    setTimePeriod('');
    setNbJour(0);
    setOrdre('');
    setImputationAdresse('');
    setDate(null);
    setApresMidiReprise(false);
    setWritable(true);
    setMode('save');
    setShowEtatConge(false);
    refetch();
  }

  
  return (
    <Box component="form" sx={{ mx: 'auto', p: 3 }}>
      <Typography variant="h6" textAlign="center" color={'primary'} fontWeight={'bold'} mb={2}>
        {titre}
      </Typography>
      <Grid container spacing={2.8}>
      {titre === "Titre de Congés" && (  
        <Grid item xs={1.5}>
          <SelectInputComponent label="Employé" value={empcod} setValue={setEmploye} maplist={emp} />
        </Grid>
        )}

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
        <Grid item xs={1.7} sm={2.1}>
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
          setValue={(val: string) => setDateReprise(val)}
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

        {titre === "Titre de Congés Génerale" && (
          <Grid item>
            <Button variant='outlined' color='secondary' onClick={toggleExceptionList}>
              Exception
            </Button>
          </Grid>
        )}

        {/* Show Checkbox List if Exception button is clicked */}
        {showExceptionList && (
          <Grid item xs={12}>
            <CheckboxListSecondary 
              employees={emp} 
              checked={checkedEmployees} 
              handleToggle={handleToggle} 
            />
          </Grid>
        )}

        {/* Save Button */}
        <Grid item mt={2}>
          <IconButton color="primary" aria-label="save" onClick={handleSubmit} >
            <SaveIcon />
          </IconButton>
          <Button onClick={resetForm} color='secondary'>Nouveau</Button>
        </Grid>
      </Grid>
      {/* Conditionally display Etat Conge */}
      {showEtatConge && etatCongeError && (
        <Grid width={550} position={'fixed'} zIndex={20} left={430} bottom={315} textAlign={'start'} >
            <Alert severity="error">{etatCongeError}</Alert>
          </Grid>
        )}
      
      {showEtatConge && !etatCongeError && (
        <Grid width={850} position={'sticky'} zIndex={10} left={430} mb={-11.5} textAlign={'start'} >

        <Collapse in={showEtatConge}>
          <Alert
            // icon={<InfoIcon fontSize="large" />}
            severity="info"
            variant="outlined"
            sx={{
              mt: 2,
              p: 2,
              backgroundColor: "#e3f2fd",
              borderColor: "#90caf9",
              borderRadius: 2,
              color: "#0d47a1",
            }}
          >
            <Box display={'flex'} gap={2} >
            <Typography variant="body1">
              <strong>Droit Mensuelle:</strong> {etatConge.droitMensuelle}
            </Typography>
            <Typography variant="body1">
              <strong>Ancienneté:</strong> {etatConge.anciennete}
            </Typography>
            <Typography variant="body1">
              <strong>Solde Antérieur:</strong> {etatConge.soldeAnterieur}
            </Typography>
            <Typography variant="body1">
                <strong>Nouveau Solde:</strong> {(etatConge.soldeAnterieur - connbjour).toFixed(4)}
            </Typography>
            <Typography variant="body1">
              <strong>Droit Congé:</strong> {etatConge.droitConge}
            </Typography>
            </Box>
          </Alert>
        </Collapse>
        </Grid>
      )}
      <Snackbar open={isSnackbarOpen} autoHideDuration={1000} onClose={handleSnackbarClose}>
            <Alert onClose={handleSnackbarClose} severity={severity}>
              {message}
            </Alert>
        </Snackbar>
      
    </Box>
  );
}

