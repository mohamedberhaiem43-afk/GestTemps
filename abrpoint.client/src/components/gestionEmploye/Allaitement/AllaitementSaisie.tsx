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
import AllaitementModel from '../../../models/Allaitement';
import useAddAllaitement from '../../../hooks/allaitementHooks/useAddAllaitement';
import useGetFemmeLibs from '../../../hooks/employeHooks/useGetFemmeLibs';
import { useAllaitementContext } from '../../helper/AllaitementContext';
import useUpdateAllaitement from '../../../hooks/allaitementHooks/useUpdateAllaitement';
import SelectInputComponent from '../../SelectInputComponent/SelectInputComponent';
import ForbiddenMessage from '../../AlertModal/ForbiddenMessage';
import { useAuth } from '../../helper/AuthProvider';
import { getDatePart1 } from '../../helper/TimeConverter/ExtractDateOnly';
import generateNumeroOrdre from '../../helper/GenerateNumOrdre';
import getTodayDate from '../../helper/TimeConverter/TodayDate';
import { useTranslation } from 'react-i18next';

export default function AllaitementSaisie() {
  const { selectedAllaitement,setSelectedAllaitement } = useAllaitementContext();  // Using context to get selected Allaitement and hoursData
  const { t } = useTranslation();
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [empcod,setEmpcod] = useState<string>('');
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);
  const [forbiddenPutError, setForbiddenPutError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'success'|'error'>('error');
  const { soccod } = useAuth();
  const { control, reset, handleSubmit } = useForm<AllaitementModel>({
    defaultValues: {
      empcod: empcod,
      concod: generateNumeroOrdre(),
      condat: getTodayDate(),
      condep: getTodayDate(),
      conret: getTodayDate(),
      conjour: 'touteLaJournee',
      lundi:0,
      mardi:0,
      mercredi:0,
      jeudi:0,
      vendredi:0,
      samedi:0
    },
  });
  const {refetch} = useGetAllaitement();
  const {mutate: addAllaitement} = useAddAllaitement();
  const [isEditMode, setIsEditMode] = useState(false);
  const {mutate:updateAllaitement} = useUpdateAllaitement();

  const {data : employes = []} = useGetFemmeLibs();

  // Function to handle form submission
const onSubmit = async (data: AllaitementModel) => {
  // clear forbidden msg before new submit
  setForbiddenError(null);
  const payload: AllaitementModel = {
    ...data,
  };
  payload.empcod = data.empcod;
  payload.soccod = soccod || '';

  if (!isEditMode) {
    addAllaitement(payload, {
      onSuccess: () => {
        handleSnackbarOpening('Allaitement ajoutée avec succès', 'success');
        reset();
      },
      onError: (error: any) => {
        if (error?.response?.status === 403) {
          // Show forbidden message
          setForbiddenError("Vous n'avez pas l'autorisation d'effectuer cette action.");
        } else {
          handleSnackbarOpening("Échec lors de l'ajout d'allaitement", 'error');
        }
      },
    });
  } else {
    updateAllaitement(payload, {
      onSuccess() {
        handleSnackbarOpening('Allaitement modifiée avec succès', 'success');
        setSelectedAllaitement(null);
        reset();
      },
      onError(error: any) {
        if (error?.response?.status === 403) {
          // Show forbidden message
          setForbiddenPutError("Vous n'avez pas l'autorisation de modifier une allaitement.");
        } else {
          handleSnackbarOpening("Échec lors de la modification de l'allaitement", 'error');
        }
      },
    });
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
        concod: selectedAllaitement.concod || generateNumeroOrdre(),
        empcod: selectedAllaitement.empcod || '',
        condat: getDatePart1(selectedAllaitement.condat), // Format the date
        condep: getDatePart1(selectedAllaitement.condep), // Format the date
        conret: getDatePart1(selectedAllaitement.conret), // Format the date
        lundi:Number(selectedAllaitement.lundi),
        mardi:Number(selectedAllaitement.mardi),
        mercredi:Number(selectedAllaitement.mercredi),
        jeudi:Number(selectedAllaitement.jeudi),
        vendredi:Number(selectedAllaitement.vendredi),
        samedi:Number(selectedAllaitement.samedi),
        conjour: selectedAllaitement.conjour || 'J',
      });
      setEmpcod(selectedAllaitement.empcod || '')
      setIsEditMode(true); // Switch to edit mode if an Allaitement is selected
    } else {
      reset({
        concod: generateNumeroOrdre(),
        empcod: '',
        condat: getTodayDate(),
        condep: getTodayDate(),
        conret: getTodayDate(),
        conjour: 'J',
      });
      setEmpcod('')
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
              <Controller
                name="empcod"
                control={control}
                render={({ field }) => (
                  <SelectInputComponent
                    label={t('allaitement.form.employee') || 'Employé'}
                    value={field.value}
                    setValue={field.onChange}
                    maplist={employes}
                  />
                )}
              />
            </Grid>


              {/* N° Ordre */}
              <Grid item xs={1.5} mt={0.5}>
                <InputLabel shrink>{t('allaitement.form.order') || 'N° Ordre'}</InputLabel>
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
                <InputLabel shrink>{t('allaitement.form.date') || 'Date'}</InputLabel>
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
                <InputLabel shrink>{t('allaitement.form.startDate') || 'Date Départ'}</InputLabel>
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
                <InputLabel shrink>{t('allaitement.form.endDate') || 'Date Retour'}</InputLabel>
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
                <InputLabel shrink>{t('allaitement.form.monday') || 'Lundi'}</InputLabel>
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
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={1.5} mt={0.5}>
                <InputLabel shrink>{t('allaitement.form.tuesday') || 'Mardi'}</InputLabel>
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
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={1.5} mt={0.5}>
                <InputLabel shrink>{t('allaitement.form.wednesday') || 'Mercredi'}</InputLabel>
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
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={1.5} mt={0.5}>
                <InputLabel shrink>{t('allaitement.form.thursday') || 'Jeudi'}</InputLabel>
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
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={1.5} mt={0.5}>
                <InputLabel shrink>{t('allaitement.form.friday') || 'Vendredi'}</InputLabel>
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
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={1.5} mt={0.5}>
                <InputLabel shrink>{t('allaitement.form.saturday') || 'Samedi'}</InputLabel>
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
                      onChange={(e) => field.onChange(Number(e.target.value))}
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
                <Button
                onClick={() => {
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
    {forbiddenError && (
      <ForbiddenMessage
        message={forbiddenError}
        autoHideDuration={6000}
      />
    )}
    {forbiddenPutError && (
      <ForbiddenMessage
        message={forbiddenPutError}
        autoHideDuration={6000}
      />
    )}
  

    </Box>
  );
}
