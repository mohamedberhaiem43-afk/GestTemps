import {
  Alert,
  Box,
  Button,
  Grid,
  IconButton,
  Snackbar,
  Typography,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useEffect, useState } from "react";
import SaveIcon from "@mui/icons-material/Save";
import "./SaisieJourCompensation.css";
import useAddCompensation from "../../../../../hooks/compensationHooks/useAddCompensation";
import useGetCompensations from "../../../../../hooks/compensationHooks/useGetCompensations";
import useGetAbsencesLibs from "../../../../../hooks/absenceHooks/useGetAbsenceLibs";
import useGetEmployee from "../../../../../hooks/employeHooks/useGetEmployee";
import { useCompensationContext } from "../../../../helper/CompensationContext";
import useUpdateCompensation from "../../../../../hooks/compensationHooks/useUpdateCompensation";
import InputComponent from "../../../../Inputs/Input";
import SelectInputComponent from "../../../../SelectInputComponent/SelectInputComponent";
import { Compenser } from "../../../../../Compense";
import DateTimeRangeInput from "./DateTimeRangeInput";


const calculateHourDifference = (start: Dayjs | null, end: Dayjs | null) => {
  if (dayjs.isDayjs(start) && dayjs.isDayjs(end)) {
    return end.diff(start, "hour", true); // Use true for fractional hours
  }
  return 0; // Default to 0 if invalid
};
export default function SaisieJourCompensation() {
  const { selectedCompensation } = useCompensationContext();
  const [empcod, setEmpcod] = useState("");
  const [concod, setConcod] = useState("");
  const [conmotif, setConmotif] = useState("");
  const [connbheures, setConnbheures] = useState(0);
  const [abscod, setAbscod] = useState("");
  const [ref, setRef] = useState("");
  const [condat, setCondat] = useState<[Dayjs, Dayjs]>([dayjs(), dayjs()]);
  const addCompensation = useAddCompensation();
  const soccod = sessionStorage.getItem("soccod");
  const {refetch} = useGetCompensations(soccod);
  const{data:absences = []} = useGetAbsencesLibs();
  const{data:employes = []} = useGetEmployee();
  const { mutate:updateCompensation } = useUpdateCompensation();
  const [mode,setMode] = useState('save');
  const [writable,setWritable] = useState(true)
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'success' | 'error'>('success');
  

  useEffect(() => {
    if (selectedCompensation) {
      setAbscod(selectedCompensation.abscod || "");
      setConcod(selectedCompensation.concod || "");
      setRef(selectedCompensation.conref || "");
      setConmotif(selectedCompensation.conmotif || "");
      setEmpcod(selectedCompensation.empcod || "");
      setConnbheures(selectedCompensation.connbjour || 0);
  
      // Map condep and conret to condat
      if (selectedCompensation.condep && selectedCompensation.conret) {
        const startDate = dayjs(selectedCompensation.condep);
        const endDate = dayjs(selectedCompensation.conret);
        setCondat([startDate.isValid() ? startDate : dayjs(), endDate.isValid() ? endDate : dayjs()]);
      } else {
        setCondat([dayjs(), dayjs()]);
      }
      setWritable(false);
      setMode("edit");
    }
  }, [selectedCompensation]);
  




  useEffect(()=>{
    const x = calculateHourDifference(condat[0], condat[1])
    setConnbheures(x);
  },[condat])

  const handleSave = async (event:React.FormEvent) => {
    event.preventDefault();
  if (!condat[0] || !condat[1]) {
    handleSnackbarOpening("Please select valid dates", "error");
    return;
  }
    const data: Compenser = {
    soccod: soccod || "",
    empcod: empcod,
    concod: concod,
    abscod: abscod,
    conref: ref,
    conmotif: conmotif,
    condat: condat[0].format("YYYY-MM-DD"),
    condep: condat[0].toISOString(),
    conret: condat[1].toISOString(),
    connbjour: connbheures,
  };
    
      if(mode === 'save'){
        addCompensation.mutate(data,{
          onSuccess() {
            handleSnackbarOpening("Compensation ajoutée avec succées",'success');
            refetch();
            resetForm();
          },
          onError(){
            alert("echec d'ajout");
          }
        })
      }else if(mode === 'edit'){
        updateCompensation(data,{
          onSuccess: () => {
            handleSnackbarOpening("Compensation modifiée avec succées",'success');
            resetForm();
            refetch();
            setMode('save');
          },
          onError() {
            handleSnackbarOpening("Erreur lors de modification de la compensation.",'error');
          },
        })
    }
  }

  const resetForm = () => {
    setAbscod('');
    setConcod('');
    setConmotif('');
    setRef('');
    setEmpcod('');
    setCondat([dayjs(), dayjs()]);
    setWritable(true);
    setMode('save');
  }


  const handleSnackbarOpening = (message:string,severity:'success'|'error') => {
    setMessage(message);
    setSeverity(severity);
    setIsSnackbarOpen(true);
  };
  const handleSnackbarClose = () => {
    setIsSnackbarOpen(false);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box component="form" onSubmit={handleSave} sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
        <Grid container alignItems="center" direction="row">
          <Grid item xs={7}>
            <Grid container spacing={3} alignItems="center" direction="row">
              <Grid item xs={2.5}>
                <SelectInputComponent label='Employé' value={empcod} setValue={setEmpcod} maplist={employes} />
              </Grid>
              <Grid item xs={2}>
              <InputComponent readOnly={!writable} type='text' label='N° Ordre' value={concod} setValue={setConcod} />
              </Grid>

              <Grid item xs={1.5}>
              <InputComponent type='text' label='Réf' value={ref} setValue={setRef} />
              </Grid>

              <Grid item xs={2}>
                <SelectInputComponent label='Imputation' value={abscod} setValue={setAbscod} maplist={absences} />
              </Grid>
              <Grid item xs={3}>
                <InputComponent type='text' label='Motif' value={conmotif} setValue={setConmotif} />
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={5}>
            <Box component="fieldset" id="update-classe-horaire" sx={{ height: "100%" }}>
              <legend>
                <Typography color={'error'}>Journée à Compenser</Typography>
              </legend>
              <Grid container>
              <DateTimeRangeInput
                value={[condat[0].format("YYYY-MM-DDTHH:mm"), condat[1].format("YYYY-MM-DDTHH:mm")]}
                onChange={(newRange) => setCondat([dayjs(newRange[0]), dayjs(newRange[1])])}
                disabled={!writable}
              />


              </Grid>
              {/* Display the difference in hours */}
              <Typography variant="h6" sx={{ mt: 2 }}>
                {connbheures.toFixed(2)} <span className="heures-span"> Heures </span>
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={2} display={'flex'} gap={3} mt={-2}>
            <IconButton color="primary" aria-label="save" type="submit">
              <SaveIcon />
            </IconButton>
            <Button onClick={resetForm} color="secondary">Nouveau</Button>
          </Grid>
        </Grid>
        {/* Snackbar */}
      </Box>
              <Snackbar open={isSnackbarOpen} autoHideDuration={1500} onClose={handleSnackbarClose}>
                <Alert onClose={handleSnackbarClose} severity={severity}>
                  {message}
                </Alert>
              </Snackbar>
    </LocalizationProvider>
  );
}
