import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Grid,
  Button,
  Alert,
  Snackbar,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Typography,
  Radio,
  RadioGroup,
  FormControl,
  FormControlLabel,
  FormLabel,
} from '@mui/material';
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from '@mui/icons-material/Refresh';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import './Allaitement.css';
import useGetAllaitement from '../../../hooks/allaitementHooks/useGetAllaitement';
import AllaitementModel from '../../../models/Allaitement';
import useAddAllaitement from '../../../hooks/allaitementHooks/useAddAllaitement';
import useGetFemmeLibs from '../../../hooks/employeHooks/useGetFemmeLibs';
import { useAllaitementContext } from '../../helper/AllaitementContext';
import useUpdateAllaitement from '../../../hooks/allaitementHooks/useUpdateAllaitement';
import SelectInputComponent from '../../SelectInputComponent/SelectInputComponent';
import InputComponent from '../../Inputs/Input';
import ForbiddenMessage from '../../AlertModal/ForbiddenMessage';
import { useAuth } from '../../helper/AuthProvider';
import { getDatePart1 } from '../../helper/TimeConverter/ExtractDateOnly';
import generateNumeroOrdre from '../../helper/GenerateNumOrdre';
import getTodayDate from '../../helper/TimeConverter/TodayDate';
import { useTranslation } from 'react-i18next';

export default function AllaitementSaisie() {
  const { selectedAllaitement, setSelectedAllaitement } = useAllaitementContext();
  const { t } = useTranslation();
  const { soccod } = useAuth();
  
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'success' | 'error'>('error');
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);
  const [forbiddenPutError, setForbiddenPutError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { control, reset, handleSubmit, watch } = useForm<AllaitementModel>({
    defaultValues: {
      empcod: '',
      concod: generateNumeroOrdre(),
      condat: getTodayDate(),
      condep: getTodayDate(),
      conret: getTodayDate(),
      conjour: 'J',
      lundi: 0,
      mardi: 0,
      mercredi: 0,
      jeudi: 0,
      vendredi: 0,
      samedi: 0,
    },
  });

  const { refetch } = useGetAllaitement();
  const { mutate: addAllaitement } = useAddAllaitement();
  const { mutate: updateAllaitement } = useUpdateAllaitement();
  const { data: employes = [] } = useGetFemmeLibs();

  // Update form values when selectedAllaitement changes
  useEffect(() => {
    if (selectedAllaitement) {
      reset({
        concod: selectedAllaitement.concod || generateNumeroOrdre(),
        empcod: selectedAllaitement.empcod || '',
        condat: getDatePart1(selectedAllaitement.condat),
        condep: getDatePart1(selectedAllaitement.condep),
        conret: getDatePart1(selectedAllaitement.conret),
        lundi: Number(selectedAllaitement.lundi),
        mardi: Number(selectedAllaitement.mardi),
        mercredi: Number(selectedAllaitement.mercredi),
        jeudi: Number(selectedAllaitement.jeudi),
        vendredi: Number(selectedAllaitement.vendredi),
        samedi: Number(selectedAllaitement.samedi),
        conjour: selectedAllaitement.conjour || 'J',
      });
      setIsEditMode(true);
    } else {
      resetForm();
    }
  }, [selectedAllaitement, reset]);

  const onSubmit = async (data: AllaitementModel) => {
    setForbiddenError(null);
    setForbiddenPutError(null);
    setIsLoading(true);

    const payload: AllaitementModel = {
      ...data,
      soccod: soccod || '',
    };

    if (!isEditMode) {
      addAllaitement(payload, {
        onSuccess: () => {
          handleSnackbarOpening('Allaitement ajoutée avec succès', 'success');
          resetForm();
          setIsLoading(false);
        },
        onError: (error: any) => {
          setIsLoading(false);
          if (error?.response?.status === 403) {
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
          resetForm();
          setIsLoading(false);
        },
        onError(error: any) {
          setIsLoading(false);
          if (error?.response?.status === 403) {
            setForbiddenPutError("Vous n'avez pas l'autorisation de modifier une allaitement.");
          } else {
            handleSnackbarOpening("Échec lors de la modification de l'allaitement", 'error');
          }
        },
      });
    }
  };

  const resetForm = () => {
    reset({
      concod: generateNumeroOrdre(),
      empcod: '',
      condat: getTodayDate(),
      condep: getTodayDate(),
      conret: getTodayDate(),
      conjour: 'J',
      lundi: 0,
      mardi: 0,
      mercredi: 0,
      jeudi: 0,
      vendredi: 0,
      samedi: 0,
    });
    setIsEditMode(false);
    setSelectedAllaitement(null);
    refetch();
  };

  const handleSnackbarOpening = (message: string, severity: 'error' | 'success') => {
    refetch();
    setMessage(message);
    setSeverity(severity);
    setIsSnackbarOpen(true);
  };

  const handleSnackbarClose = () => {
    setIsSnackbarOpen(false);
  };

  return (
    <Box component="form" sx={{ mx: 'auto' }} onSubmit={handleSubmit(onSubmit)}>
      {/* En-tête avec Actions */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            onClick={resetForm}
            color="secondary"
            startIcon={<RefreshIcon />}
          >
            Nouveau
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            Enregistrer
          </Button>
        </Box>
      </Box>

      {/* Card principale */}
      <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          {/* Les 3 sections en ligne */}
          <Grid container spacing={2} sx={{ mb: 3 }} wrap="nowrap" alignItems="flex-start">
            
            {/* Section 1: Informations Générales */}
            <Grid item xs={4}>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#666', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssignmentIcon fontSize="small" /> Informations Générales
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Controller
                      name="concod"
                      control={control}
                      render={({ field }) => (
                        <InputComponent
                          readOnly={isEditMode}
                          type="text"
                          label={t('allaitement.form.order') || 'N° Ordre'}
                          value={field.value}
                          setValue={field.onChange}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={6} mt={1}>
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
                  <Grid item xs={12}>
                    <Controller
                      name="condat"
                      control={control}
                      render={({ field }) => (
                        <InputComponent
                          type="date"
                          label={t('allaitement.form.date') || 'Date'}
                          value={field.value}
                          setValue={field.onChange}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Grid>

            {/* Section 2: Période */}
            <Grid item xs={4}>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#666', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarTodayIcon fontSize="small" /> Période
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Controller
                      name="condep"
                      control={control}
                      render={({ field }) => (
                        <InputComponent
                          type="date"
                          label={t('allaitement.form.startDate') || 'Date Départ'}
                          value={field.value}
                          setValue={field.onChange}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Controller
                      name="conret"
                      control={control}
                      render={({ field }) => (
                        <InputComponent
                          type="date"
                          label={t('allaitement.form.endDate') || 'Date Retour'}
                          value={field.value}
                          setValue={field.onChange}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl component="fieldset" fullWidth>
                      <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1 }}>
                        Type de période
                      </FormLabel>
                      <Controller
                        name="conjour"
                        control={control}
                        render={({ field }) => (
                          <RadioGroup {...field} row>
                            <FormControlLabel
                              value="J"
                              control={<Radio size="small" />}
                              label={<Typography fontSize="small">Journée</Typography>}
                            />
                            <FormControlLabel
                              value="M"
                              control={<Radio size="small" />}
                              label={<Typography fontSize="small">Matin</Typography>}
                            />
                            <FormControlLabel
                              value="A"
                              control={<Radio size="small" />}
                              label={<Typography fontSize="small">Après-midi</Typography>}
                            />
                            <FormControlLabel
                              value="S"
                              control={<Radio size="small" />}
                              label={<Typography fontSize="small">Sans présence</Typography>}
                            />
                          </RadioGroup>
                        )}
                      />
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>
            </Grid>

            {/* Section 3: Heures par jour */}
            <Grid item xs={4}>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#666', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccessTimeIcon fontSize="small" /> Heures par jour
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Controller
                      name="lundi"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          type="number"
                          label={t('allaitement.form.monday') || 'Lundi'}
                          size="small"
                          fullWidth
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Controller
                      name="mardi"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          type="number"
                          label={t('allaitement.form.tuesday') || 'Mardi'}
                          size="small"
                          fullWidth
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Controller
                      name="mercredi"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          type="number"
                          label={t('allaitement.form.wednesday') || 'Mercredi'}
                          size="small"
                          fullWidth
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Controller
                      name="jeudi"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          type="number"
                          label={t('allaitement.form.thursday') || 'Jeudi'}
                          size="small"
                          fullWidth
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Controller
                      name="vendredi"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          type="number"
                          label={t('allaitement.form.friday') || 'Vendredi'}
                          size="small"
                          fullWidth
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Controller
                      name="samedi"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          type="number"
                          label={t('allaitement.form.saturday') || 'Samedi'}
                          size="small"
                          fullWidth
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Snackbar open={isSnackbarOpen} autoHideDuration={1500} onClose={handleSnackbarClose}>
        <Alert onClose={handleSnackbarClose} severity={severity}>
          {message}
        </Alert>
      </Snackbar>

      {forbiddenError && (
        <ForbiddenMessage message={forbiddenError} autoHideDuration={6000} />
      )}
      {forbiddenPutError && (
        <ForbiddenMessage message={forbiddenPutError} autoHideDuration={6000} />
      )}
    </Box>
  );
}