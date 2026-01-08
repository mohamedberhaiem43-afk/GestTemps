import {
  Alert,
    Box,
    Button,
    Grid,
    IconButton,
    Snackbar,
    Typography,
  } from "@mui/material";
  import { DatePicker, LocalizationProvider, TimePicker } from "@mui/x-date-pickers";
  import duration from "dayjs/plugin/duration";
  import dayjs, { Dayjs } from "dayjs";
  import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
  import { useEffect, useState } from "react";
  import SaveIcon from "@mui/icons-material/Save";
  import './SaisieAutSortie.css'
import CheckboxListSecondary from "../../../../../CheckboxList/CheckboxListSecondary";
import SelectInputComponent from "../../../../../SelectInputComponent/SelectInputComponent";
import InputComponent from "../../../../../Inputs/Input";
import useGetAbsencesLibs from "../../../../../../hooks/absenceHooks/useGetAbsenceLibs";
import useGetEmployee from "../../../../../../hooks/employeHooks/useGetEmployee";
import { useSortieGeneralContext } from "../../../../../helper/SortieGeneralContext";
import useAddSortie from "../../../../../../hooks/sortieHooks/useAddSortie";
import { Autoriser } from "../../../../../../models/Autoriser";
import useAddBulkSortie from "../../../../../../hooks/sortieHooks/useAddBulkSortie";
import useUpdateSortie from "../../../../../../hooks/sortieHooks/useUpdateSortie";
import useGetSortie from "../../../../../../hooks/sortieHooks/useGetSortie";
import generateNumeroOrdre from "../../../../../helper/GenerateNumOrdre";
  
interface SaisieAutSortieProps{
  type:string;
}
export default function SaisieAutSortie({ type }:SaisieAutSortieProps) {
    const { selectedSortieGeneral } = useSortieGeneralContext();
    const uticod = localStorage.getItem('Uticod');
    const soccod = sessionStorage.getItem('soccod')||'';
    const [empcod, setEmpcod] = useState<string|null>("");
    const [concod, setConcod] = useState<string>(generateNumeroOrdre());
    const [conmotif, setConmotif] = useState<string|null>("");
    const [abscod, setAbscod] = useState<string|null>("");
    const [conref, setConref] = useState<string|null>("");
    const [condat, setCondat] = useState<[Dayjs | null, Dayjs | null]>([dayjs(), dayjs()]);
    const [showExceptionList, setShowExceptionList] = useState(false);
    const [checkedEmployees, setCheckedEmployees] = useState<number[]>([]); // State to manage checked employees
    const [mode,setMode] = useState('save');
    const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [severity, setSeverity] = useState<'success' | 'error'>('success');
    const [writable,setWritable] = useState(true);
    const toggleExceptionList = () => {
      setShowExceptionList(prev => !prev);
    };
    const generateUniqueConcod = () => {
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 10; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
      }
      return result;
    };
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
      const {data:absences = []} = useGetAbsencesLibs();
      const {data:employes = []} = useGetEmployee();
      const { mutate:addSortie } = useAddSortie();
      const { mutate:addBulkSortie } = useAddBulkSortie();
      const { mutate:updateSortie } = useUpdateSortie();
      const { refetch } = useGetSortie(uticod);
      useEffect(() => {
        if (selectedSortieGeneral) {
          setAbscod(selectedSortieGeneral?.abscod);
          setConcod(selectedSortieGeneral?.concod);
          setConmotif(selectedSortieGeneral?.conmotif);
      
          // Parse the start and end datetime values from `selectedSortieGeneral`
          const startDate = dayjs(selectedSortieGeneral?.condep);
          const endDate = dayjs(selectedSortieGeneral?.conret);
      
          setCondat([startDate, endDate]);
          setConref(selectedSortieGeneral?.conref);
          setEmpcod(selectedSortieGeneral?.empcod);
          setWritable(false);
          setMode('edit');
        }
      }, [selectedSortieGeneral]);
      
      // Function to handle saving the compensation data
      const handleSave = async () => {
      if(type=='generale' && mode==='save')
      {
        const employeesArray = Object.entries(employes);
        // Employees who are not checked in the exception list
        const employeesToSubmit = employeesArray.filter(([], index) => !checkedEmployees.includes(index));
        
        // Create multiple conge objects for these employees
        const SortieDataArray: Autoriser[] = employeesToSubmit.map(([empcod]) => ({
        empcod: empcod || null, // Handle potential undefined
        concod: generateUniqueConcod(),
        condat: condat[0]?.format('YYYY-MM-DD') || undefined,
        condep: `${condat[0]?.format('YYYY-MM-DD')}T${condat[0]?.format('HH:mm:ss')}`,
        conret: `${condat[1]?.format('YYYY-MM-DD')}T${condat[1]?.format('HH:mm:ss')}`,
        connbjour: parseFloat(hoursDifference.toFixed(2)), // Use correct lowercase property name
        abscod: abscod || null,
        soccod: soccod, // Now matches the nullable type
        conmotif: conmotif || null,
        conref: conref || null
        }));
          addBulkSortie(SortieDataArray,{
            onSuccess() {
              handleSnackbarOpening("Autorisations de Sortie sont ajoutées avec sucées",'success');
              resetForm();
            },
            onError() {
              handleSnackbarOpening("Echéc d'ajout les autorisations de sortie",'error');

            },
          })
      }
      else{
        const data: Autoriser = {
          empcod: empcod,
          concod: concod,
          abscod: abscod,
          conref: conref,
          conmotif: conmotif,
          condat: condat[0]?.format('YYYY-MM-DD'),
          condep: `${condat[0]?.format('YYYY-MM-DD')}T${condat[0]?.format('HH:mm:ss')}`,
          conret: `${condat[1]?.format('YYYY-MM-DD')}T${condat[1]?.format('HH:mm:ss')}`,
          connbjour: parseFloat(hoursDifference.toFixed(2)),
          soccod: soccod ||'01',
        };
        let payload:Autoriser={} as Autoriser
        payload = {
          ...data,
          conmotif: data.conmotif,
          conref: data.conref,
        };
        
        
        if(mode === 'save'){
          addSortie(payload,{
            onSuccess() {
              handleSnackbarOpening("Autorisation de Sortie ajoutée avec sucées",'success');
              resetForm();
            },
            onError() {
              handleSnackbarOpening("Echéc d'ajout l'autorisation de sortie",'error');
            },
          })
        }else if(mode === 'edit'){
          
          updateSortie(payload,{
            onSuccess:()=>{
              handleSnackbarOpening("Autorisation de Sortie modifiée avec sucées",'success');
              resetForm();
            },
            onError() {
              handleSnackbarOpening("Echéc lors de modification de l'autorisation de sortie",'error');
            },
          })
        }

      
      }
      };
      
      dayjs.extend(duration);

   // Calculate the difference in hours
   const calculateTimeDifference = (start: Dayjs | null, end: Dayjs | null) => {
     if (start && end) {
       // Get only the time component (hours and minutes)
       const startHour = start.hour();
       const startMinute = start.minute();
       const endHour = end.hour();
       const endMinute = end.minute();
   
       // Convert hours and minutes to total minutes
       const startInMinutes = startHour * 60 + startMinute;
       const endInMinutes = endHour * 60 + endMinute;
   
       // Calculate the difference in minutes
       let differenceInMinutes = endInMinutes - startInMinutes;
   
       // If the difference is negative (e.g., time wraps around midnight), adjust it
       if (differenceInMinutes < 0) {
         differenceInMinutes += 24 * 60; // Add 24 hours in minutes
       }
   
       // Convert the difference back to hours
       return dayjs.duration(differenceInMinutes, "minutes").asHours();
     }
     return 0;
   };
    const hoursDifference = calculateTimeDifference(condat[0], condat[1]);
  
   
  const resetForm = () => {
    setAbscod('');
    setConcod('');
    setConmotif('');
    setCondat([dayjs(), dayjs()]);
    setConref('');
    setEmpcod('');
    setWritable(true);
    setMode('save');
    refetch();
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
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="fr">
        <Box className="saisie-compensation-container" component="form" sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
          <Grid container alignItems="center" direction="row">
            {/* First box: Inputs */}
            <Grid item xs={7}>
              <Grid container spacing={2} alignItems="center" direction="row">
                {type=='speciale'&&(
                <Grid item xs={3}>
                  <SelectInputComponent label='Employé' value={empcod} setValue={setEmpcod} maplist={employes} />
                </Grid>
                )}
                <Grid item xs={2}>
                  <InputComponent readOnly={!writable} type='text' label='N° Ordre' value={concod} setValue={setConcod} />
                </Grid>
  
                <Grid item xs={1.5}>
                <InputComponent type='text' label='Réf' value={conref} setValue={setConref} />
                </Grid>
  
                <Grid item xs={2}>
                  <SelectInputComponent label='Imputation' value={abscod} setValue={setAbscod} maplist={absences} />
                </Grid>
                <Grid item xs={3}>
                <InputComponent type='text' label='Motif' value={conmotif} setValue={setConmotif} />
                </Grid>
                {type === "generale" && (
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
              employees={employes} 
              checked={checkedEmployees} 
              handleToggle={handleToggle} 
            />
          </Grid>
        )}
              </Grid>
            </Grid>
  
            <Grid item xs={5}>
              <Box component="fieldset" id="date-sortie" sx={{ height: "100%" }}>
                <legend>Date</legend>
                <Grid container item xs={5}>
                <DatePicker
                    label="Date"
                    value={condat[0]}  // This ensures the selected date is displayed
                    onChange={(newDate) => setCondat([newDate, condat[1]])}  // This updates the selected date in state
                    format="DD/MM/YYYY"  // Enforce the desired format

                  />
                </Grid>
                <Grid container item xs={4.5}>
                <TimePicker
                  views={['hours', 'minutes', 'seconds']}
                  label="Start Time"
                  value={condat[0]} // This refers to the start date with time
                  onChange={(newValue) => setCondat([newValue, condat[1]])} // Update only the start time
                  
                />
                </Grid>
                <Grid container item xs={4.5}>
                <TimePicker
                    views={['hours', 'minutes', 'seconds']}
                    label="End Time"
                    value={condat[1]} // This refers to the end date with time
                    onChange={(newValue) => setCondat([condat[0], newValue])} // Update only the end time
                  />
                </Grid>
                {/* Display the difference in hours */}
                <Typography variant="h6" sx={{ mt: 2 }}>
                {hoursDifference.toFixed(2)} <span className="heures-span"> Heures </span>
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={2} mt={-4} display={'flex'} justifyContent={'space-around'}>
              <IconButton color="primary" aria-label="save" onClick={handleSave}>
                <SaveIcon />
              </IconButton>
              <Button onClick={resetForm} color="secondary">Nouveau</Button>
            </Grid>
          </Grid>
          <Snackbar open={isSnackbarOpen} autoHideDuration={1500} onClose={handleSnackbarClose}>
                      <Alert onClose={handleSnackbarClose} severity={severity}>
                          {message}
                      </Alert>
          </Snackbar>
        </Box>
      </LocalizationProvider>
    );
  }


  