import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Radio,
  RadioGroup,
  FormControl,
  FormControlLabel,
  Typography,
  FormLabel,
  Grid,
  Input,
  InputLabel,
  Button,
  Snackbar,
  Alert,
  Box,
} from '@mui/material';
import SaveIcon from "@mui/icons-material/Save";
import './Allaitement.css';
import useGetAllaitement from '../../../hooks/allaitementHooks/useGetAllaitement';
import { AllaitementDto } from '../../../models/Allaitement';
import useAddAllaitement from '../../../hooks/allaitementHooks/useAddAllaitement';
import useGetFemmeLibs from '../../../hooks/employeHooks/useGetFemmeLibs';
import { useAllaitementContext } from '../../helper/AllaitementContext';
import useUpdateAllaitement from '../../../hooks/allaitementHooks/useUpdateAllaitement';
import SelectInputComponent from '../../SelectInputComponent/SelectInputComponent';


// Helper function to format the date
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-CA'); // Format as 'YYYY-MM-DD' in local time
};


export default function AllaitementSaisie() {
  const { selectedAllaitement,setSelectedAllaitement } = useAllaitementContext();  // Using context to get selected Allaitement and hoursData
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [emp,setEmp] = useState<string>('');
  const [severity, setSeverity] = useState<'success'|'error'>('error');
  const soccod = sessionStorage.getItem('soccod')||'';
  const { control, reset, handleSubmit } = useForm<AllaitementDto>({
    defaultValues: {
      soccod: soccod || "01",
      empcod: '',
      concod: '',
      condat: '',
      condep: '',
      conret: '',
      conjour: 'touteLaJournee',
      lundi:0,
      mardi:0,
      mercredi:0,
      jeudi:0,
      vendredi:0,
      samedi:0
    },
  });
  const {refetch} = useGetAllaitement(soccod);
  const {mutate: addAllaitement} = useAddAllaitement();
  const [isEditMode, setIsEditMode] = useState(false);
  const {mutate:updateAllaitement} = useUpdateAllaitement();

  const {data : employes = []} = useGetFemmeLibs();

  // Function to handle form submission
  const onSubmit = async (data: AllaitementDto) => {
      // Prepare payload with hoursData merged
      const payload:AllaitementDto = {
        ...data,
        soccod: soccod || "01", // Include `soccod` in the payload
      };
  
      if(!isEditMode){
        addAllaitement(payload, {
          onSuccess: () => {
              handleSnackbarOpening('Allaitement ajoutée avec succées','success');
              reset();
          },
          onError: () => {
            handleSnackbarOpening("Echéc lors l'ajout d'allaitement",'error');
          },
        });
      }else{
        updateAllaitement(payload,{
          onSuccess() {
            handleSnackbarOpening('Allaitement modifiée avec succées','success');
            setSelectedAllaitement(null);
            reset();
          },
          onError() {
            handleSnackbarOpening("Echéc lors la modification de l'allaitement",'error');
          },
        })
      }

  };
  const handleSnackbarOpening = (message:string,severity:string) => {
    refetch();
    setMessage(message);
    severity=='error'||severity=='success'&& setSeverity(severity);
    setIsSnackbarOpen(true);
  }

  // Update form values when selectedAllaitement changes
  useEffect(() => {
    if (selectedAllaitement) {
      reset({
        empcod: selectedAllaitement.empcod || '',
        concod: selectedAllaitement.concod || '',
        condat: formatDate(selectedAllaitement.condat), // Format the date
        condep: formatDate(selectedAllaitement.condep), // Format the date
        conret: formatDate(selectedAllaitement.conret), // Format the date
        lundi:selectedAllaitement.lundi,
        mardi:selectedAllaitement.mardi,
        mercredi:selectedAllaitement.mercredi,
        jeudi:selectedAllaitement.jeudi,
        vendredi:selectedAllaitement.vendredi,
        samedi:selectedAllaitement.samedi,
        conjour: selectedAllaitement.conjour || 'J',
      });
      setIsEditMode(true); // Switch to edit mode if an Allaitement is selected
    } else {
      reset({
        empcod: '',
        concod: '',
        condat: '',
        condep: '',
        conret: '',
        conjour: 'J',
      });
      setIsEditMode(false); // Switch to save mode if no Allaitement is selected
    }
  }, [selectedAllaitement, reset]);

  return (
    <Box component={'form'} onSubmit={handleSubmit(onSubmit)} >
      <Grid container spacing={2}>

        {/* Left side (Form fields) */}
        <Grid item xs={8}>
            <Grid container spacing={2}>
              {/* Employee Select */}
              <Grid item xs={2} mt={1}>
                <SelectInputComponent label={'Employé'} value={emp} setValue={setEmp} maplist={employes} />
              </Grid>

              {/* N° Ordre */}
              <Grid item xs={1.5} mt={0.5}>
                <InputLabel shrink>N° Ordre</InputLabel>
                <Controller
                  name="concod"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="N°Ordre"
                      size='small'
                      fullWidth
                      {...field}
                      disabled={isEditMode}  // Disable editing of the "concod" in edit mode
                      required
                    />
                  )}
                />
              </Grid>

              {/* Date */}
              <Grid item xs={2.5}>
                <InputLabel shrink>Date</InputLabel>
                <Controller
                  name="condat"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="date"
                      fullWidth
                      required
                    />
                  )}
                />
              </Grid>

              {/* Date Départ */}
              <Grid item xs={2.5}>
                <InputLabel shrink>Date Départ</InputLabel>
                <Controller
                  name="condep"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="date"
                      fullWidth
                      required
                    />
                  )}
                />
              </Grid>

              {/* Date Retour */}
              <Grid item xs={2.5}>
                <InputLabel shrink>Date Retour</InputLabel>
                <Controller
                  name="conret"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="date"
                      fullWidth
                      required
                    />
                  )}
                />
              </Grid>
              {/* N° Ordre */}
              <Grid item xs={1.5} mt={0.5}>
                <InputLabel shrink>Lundi</InputLabel>
                <Controller
                  name="lundi"
                  control={control}
                  render={({ field }) => (
                    <Input
                    type='number'
                      id="lundi"
                      size='small'
                      fullWidth
                      {...field}
                      required
                    />
                  )}
                />
              </Grid>
              <Grid item xs={1.5} mt={0.5}>
                <InputLabel shrink>Mardi</InputLabel>
                <Controller
                  name="mardi"
                  control={control}
                  render={({ field }) => (
                    <Input
                    id='mardi'
                      type="number"
                      size='small'
                      fullWidth
                      {...field}
                      required
                    />
                  )}
                />
              </Grid>
              <Grid item xs={1.5} mt={0.5}>
                <InputLabel shrink>Mercredi</InputLabel>
                <Controller
                  name="mercredi"
                  control={control}
                  render={({ field }) => (
                    <Input
                    id='mercredi'
                      type="number"
                      size='small'
                      fullWidth
                      {...field}
                      required
                    />
                  )}
                />
              </Grid>
              <Grid item xs={1.5} mt={0.5}>
                <InputLabel shrink>Jeudi</InputLabel>
                <Controller
                  name="jeudi"
                  control={control}
                  render={({ field }) => (
                    <Input
                      type="number"
                      size='small'
                      fullWidth
                      {...field}
                      required
                    />
                  )}
                />
              </Grid>
              <Grid item xs={1.5} mt={0.5}>
                <InputLabel shrink>Vendredi</InputLabel>
                <Controller
                  name="vendredi"
                  control={control}
                  render={({ field }) => (
                    <Input
                      type="number"
                      size='small'
                      fullWidth
                      {...field}
                      required
                    />
                  )}
                />
              </Grid>
              <Grid item xs={1.5} mt={0.5}>
                <InputLabel shrink>Samedi</InputLabel>
                <Controller
                  name="samedi"
                  control={control}
                  render={({ field }) => (
                    <Input
                      type="number"
                      size='small'
                      fullWidth
                      {...field}
                      required
                    />
                  )}
                />
              </Grid>

              {/* Save Button */}
              <Grid item  mt={3} sx={{ textAlign: 'center' }} display={'flex'} gap={3} justifyContent={'space around'}>
                <Button
                  type="submit"
                  variant="outlined"
                  color="primary"
                  startIcon={<SaveIcon />}
                >
                  {/* Switch between 'Save' and 'Update' */}
                </Button>
                <Button   onClick={() => {
                          reset(); 
                          setIsEditMode(false); 
                          setSelectedAllaitement(null);
                        }} color='secondary'>Nouveau
                </Button>
              </Grid>
            </Grid>
        </Grid>

        {/* Right side (Période Radio Buttons) */}
        <Grid item xs={2.5} >
            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend">Période</FormLabel>
              <Controller
                name="conjour"
                control={control}
                render={({ field }) => (
                  <RadioGroup {...field}>
                    <FormControlLabel
                      value="J"
                      control={<Radio size='small' />}
                      label={<Typography fontSize="small">Toute la journée</Typography>}
                    />
                    <FormControlLabel
                      value="M"
                      control={<Radio size='small' />}
                      label={<Typography fontSize="small">Les matinées</Typography>}
                    />
                    <FormControlLabel
                      value="A"
                      control={<Radio size='small' />}
                      label={<Typography fontSize="small">Les après-midi</Typography>}
                    />
                    <FormControlLabel
                      value="S"
                      control={<Radio size='small' />}
                      label={<Typography fontSize="small">Sans jours de présence</Typography>}
                    />
                  </RadioGroup>
                )}
              />
            </FormControl>
        </Grid>
      </Grid>
      <Snackbar open={isSnackbarOpen} autoHideDuration={6000} onClose={() => setIsSnackbarOpen(false)}>
      <Alert onClose={() => setIsSnackbarOpen(false)} severity={severity}>
        {message}
      </Alert>
    </Snackbar>

    </Box>
  );
}
