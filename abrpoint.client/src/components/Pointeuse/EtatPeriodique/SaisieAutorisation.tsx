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
  import { useState } from "react";
import { useTranslation } from 'react-i18next';
  import SaveIcon from "@mui/icons-material/Save";
import useGetAbsencesLibs from "../../../hooks/absenceHooks/useGetAbsenceLibs";
import useAddSortie from "../../../hooks/sortieHooks/useAddSortie";
import { Autoriser } from "../../../models/Autoriser";
import InputComponent from "../../Inputs/Input";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import generateNumeroOrdre from "../../helper/GenerateNumOrdre";
import { useAuth } from "../../helper/AuthProvider";
  

export default function SaisieAutorisation({date, empcod}: { date: string|undefined, empcod: string }) {
    const { soccod } = useAuth();
    const [concod, setConcod] = useState(generateNumeroOrdre());
    const [conmotif, setConmotif] = useState("");
    const [abscod, setAbscod] = useState("");
    const [ref, setRef] = useState("");
    const [condat, setCondat] = useState<[Dayjs | null, Dayjs | null]>([dayjs(date), dayjs(date)]);
    const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [severity, setSeverity] = useState<'success' | 'error'>('success');
    const [writable,setWritable] = useState(true);
    const { t } = useTranslation();

      const {data:absences = []} = useGetAbsencesLibs();
      const { mutate:addSortie } = useAddSortie();

      // Function to handle saving the compensation data
      const handleSave = async () => {
        if (concod === "") {
            const data: Autoriser = {
            empcod: empcod,
            concod: concod,
            abscod: abscod,
            conref: ref || null,
            conmotif: conmotif || null,
            condat: condat[0]?.format('YYYY-MM-DD'),
            condep: `${condat[0]?.format('YYYY-MM-DD')}T${condat[0]?.format('HH:mm:ss')}`,
            conret: `${condat[1]?.format('YYYY-MM-DD')}T${condat[1]?.format('HH:mm:ss')}`,
            connbjour: parseFloat(hoursDifference.toFixed(2)),
            soccod: soccod || '01',
        };
        
          addSortie(data,{
            onSuccess() {
              handleSnackbarOpening("Autorisation de Sortie ajoutée avec sucées",'success');
              resetForm();
            },
            onError() {
              handleSnackbarOpening("Echéc d'ajout l'autorisation de sortie",'error');
            },
          })
        

      
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
    setRef('');
    setWritable(true);
  }

  const handleSnackbarOpening = (message: string, severity: 'success' | 'error') => {
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
                <Grid item xs={2}>
                  <InputComponent readOnly={!writable} type='text' label={t('common.orderNumber')} value={concod} setValue={setConcod} />
                </Grid>
  
                <Grid item xs={1.5}>
                <InputComponent type='text' label={t('common.ref')} value={ref} setValue={setRef} />
                </Grid>
  
                <Grid item xs={2}>
                  <SelectInputComponent label={t('common.imputation')} value={abscod} setValue={setAbscod} maplist={absences} />
                </Grid>
                <Grid item xs={3}>
                <InputComponent type='text' label={t('common.reason')} value={conmotif} setValue={setConmotif} />
                </Grid>
              </Grid>
            </Grid>
  
            <Grid item xs={5}>
              <Box component="fieldset" id="date-sortie" sx={{ height: "100%" }}>
                <legend>Date</legend>
                <Grid container item xs={5}>
                <DatePicker
                    label={t('common.date')}
                    value={condat[0]}  // This ensures the selected date is displayed
                    onChange={(newDate) => setCondat([newDate, condat[1]])}  // This updates the selected date in state
                    format="DD/MM/YYYY"  // Enforce the desired format

                  />
                </Grid>
                <Grid container item xs={4.5}>
                <TimePicker
                  views={['hours', 'minutes', 'seconds']}
                  label={t('common.startTime')}
                  value={condat[0]} // This refers to the start date with time
                  onChange={(newValue) => setCondat([newValue, condat[1]])} // Update only the start time
                  
                />
                </Grid>
                <Grid container item xs={4.5}>
                <TimePicker
                    views={['hours', 'minutes', 'seconds']}
                    label={t('common.endTime')}
                    value={condat[1]} // This refers to the end date with time
                    onChange={(newValue) => setCondat([condat[0], newValue])} // Update only the end time
                  />
                </Grid>
                {/* Display the difference in hours */}
                <Typography variant="h6" sx={{ mt: 2 }}>
                {hoursDifference.toFixed(2)} <span className="heures-span">{t('common.hours')}</span>
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={2} mt={-4} display={'flex'} justifyContent={'space-around'}>
              <IconButton color="primary" aria-label={t('common.save')} onClick={handleSave}>
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


