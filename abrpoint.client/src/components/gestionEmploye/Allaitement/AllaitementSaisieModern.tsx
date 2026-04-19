import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
  TextField,
  Typography,
  MenuItem,
  Select,
  FormControl,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import useGetAllaitement from '../../../hooks/allaitementHooks/useGetAllaitement';
import AllaitementModel from '../../../models/Allaitement';
import useAddAllaitement from '../../../hooks/allaitementHooks/useAddAllaitement';
import useGetFemmeLibs from '../../../hooks/employeHooks/useGetFemmeLibs';
import { useAllaitementContext } from '../../helper/AllaitementContext';
import useUpdateAllaitement from '../../../hooks/allaitementHooks/useUpdateAllaitement';
import ForbiddenMessage from '../../AlertModal/ForbiddenMessage';
import { useAuth } from '../../helper/AuthProvider';
import { getDatePart1 } from '../../helper/TimeConverter/ExtractDateOnly';
import generateNumeroOrdre from '../../helper/GenerateNumOrdre';
import getTodayDate from '../../helper/TimeConverter/TodayDate';
import { useTranslation } from 'react-i18next';

export default function AllaitementSaisieModern() {
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
  const [hourMode, setHourMode] = useState<'fixe' | 'hebdo'>('fixe');

  const { control, reset, handleSubmit } = useForm<AllaitementModel>({
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
  const { data: employesData } = useGetFemmeLibs();
  
  // Convert object or array to array of { code, lib } for mapping
  const employesList = React.useMemo(() => {
    if (!employesData) return [];
    if (Array.isArray(employesData)) return employesData;
    if (typeof employesData === 'object') {
      return Object.entries(employesData).map(([code, lib]) => ({ code, lib }));
    }
    return [];
  }, [employesData]);

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
    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
      {/* Employee Picker & Dates Card */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(25,28,30,0.08)',
          backgroundColor: '#ffffff',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <PersonAddIcon sx={{ color: '#0040a1', fontSize: '20px' }} />
          <Typography
            sx={{ fontWeight: 700, fontFamily: 'Manrope, sans-serif', fontSize: '1rem' }}
          >
            {isEditMode ? 'Modifier la Période' : 'Nouvelle Période'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Employee Select */}
          <Box>
            <Typography
              sx={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05rem',
                color: '#515f74',
                mb: 0.5,
              }}
            >
              {t('allaitement.form.employee') || 'Employée'}
            </Typography>
            <Controller
              name="empcod"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth size="small">
                  <Select
                    {...field}
                    displayEmpty
                    sx={{
                      backgroundColor: '#f2f4f6',
                      borderRadius: '8px',
                      fontSize: '14px',
                      '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                      '&:hover': { backgroundColor: '#ffffff' },
                      '&.Mui-focused': { backgroundColor: '#ffffff' },
                    }}
                  >
                    <MenuItem value="" disabled>Choisir...</MenuItem>
                    {employesList.map((emp: any) => (
                      <MenuItem key={emp.code || emp.empcod} value={emp.code || emp.empcod}>
                        {emp.lib || emp.empnom || emp.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
          </Box>

          {/* N° Ordre and Type */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Box>
              <Typography
                sx={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05rem',
                  color: '#515f74',
                  mb: 0.5,
                }}
              >
                {t('allaitement.form.order') || 'N° Ordre'}
              </Typography>
              <Controller
                name="concod"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    size="small"
                    fullWidth
                    InputProps={{ readOnly: isEditMode }}
                    sx={{
                      backgroundColor: '#f2f4f6',
                      borderRadius: '8px',
                      '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                      '&:hover': { backgroundColor: '#ffffff' },
                      '&.Mui-focused': { backgroundColor: '#ffffff' },
                    }}
                  />
                )}
              />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05rem',
                  color: '#515f74',
                  mb: 0.5,
                }}
              >
                Type
              </Typography>
              <Controller
                name="conjour"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth size="small">
                    <Select
                      {...field}
                      sx={{
                        backgroundColor: '#f2f4f6',
                        borderRadius: '8px',
                        fontSize: '14px',
                        '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                        '&:hover': { backgroundColor: '#ffffff' },
                        '&.Mui-focused': { backgroundColor: '#ffffff' },
                      }}
                    >
                      <MenuItem value="J">Journée</MenuItem>
                      <MenuItem value="M">Matin</MenuItem>
                      <MenuItem value="A">Après-midi</MenuItem>
                      <MenuItem value="S">Sans présence</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Box>
          </Box>

          {/* Date Range */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Box>
              <Typography
                sx={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05rem',
                  color: '#515f74',
                  mb: 0.5,
                }}
              >
                {t('allaitement.form.startDate') || 'Date Début'}
              </Typography>
              <Controller
                name="condep"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="date"
                    size="small"
                    fullWidth
                    sx={{
                      backgroundColor: '#f2f4f6',
                      borderRadius: '8px',
                      '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                      '&:hover': { backgroundColor: '#ffffff' },
                      '&.Mui-focused': { backgroundColor: '#ffffff' },
                    }}
                  />
                )}
              />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05rem',
                  color: '#515f74',
                  mb: 0.5,
                }}
              >
                {t('allaitement.form.endDate') || 'Date Fin'}
              </Typography>
              <Controller
                name="conret"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="date"
                    size="small"
                    fullWidth
                    sx={{
                      backgroundColor: '#f2f4f6',
                      borderRadius: '8px',
                      '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                      '&:hover': { backgroundColor: '#ffffff' },
                      '&.Mui-focused': { backgroundColor: '#ffffff' },
                    }}
                  />
                )}
              />
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Hours Configuration Card */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(25,28,30,0.08)',
          backgroundColor: '#ffffff',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScheduleIcon sx={{ color: '#0040a1', fontSize: '20px' }} />
            <Typography
              sx={{ fontWeight: 700, fontFamily: 'Manrope, sans-serif', fontSize: '1rem' }}
            >
              Heures
            </Typography>
          </Box>
          <ToggleButtonGroup
            value={hourMode}
            exclusive
            onChange={(_, newMode) => newMode && setHourMode(newMode)}
            size="small"
            sx={{
              backgroundColor: '#f2f4f6',
              borderRadius: '8px',
              padding: '2px',
              '& .MuiToggleButton-root': {
                border: 'none',
                borderRadius: '6px !important',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: 'Manrope, sans-serif',
                textTransform: 'none',
                '&.Mui-selected': {
                  backgroundColor: '#ffffff',
                  color: '#0040a1',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                },
              },
            }}
          >
            <ToggleButton value="fixe">Fixe</ToggleButton>
            <ToggleButton value="hebdo">Hebdo</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {hourMode === 'fixe' ? (
          <Box
            sx={{
              p: 1.5,
              backgroundColor: 'rgba(0, 64, 161, 0.05)',
              borderRadius: '8px',
              border: '1px solid rgba(0, 64, 161, 0.1)',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: '#0040a1' }}>
                  Journée Type
                </Typography>
                <Typography sx={{ fontSize: '10px', color: '#515f74' }}>
                  Appliqué par défaut
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '9px', fontWeight: 700, color: '#515f74', textTransform: 'uppercase' }}>
                    Matin
                  </Typography>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#191c1e' }}>
                    10:00-10:30
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ height: '24px', alignSelf: 'center' }} />
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '9px', fontWeight: 700, color: '#515f74', textTransform: 'uppercase' }}>
                    Après-midi
                  </Typography>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#191c1e' }}>
                    15:30-16:00
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
            {([
              { field: 'lundi',    key: 'monday'    },
              { field: 'mardi',    key: 'tuesday'   },
              { field: 'mercredi', key: 'wednesday' },
              { field: 'jeudi',    key: 'thursday'  },
              { field: 'vendredi', key: 'friday'    },
              { field: 'samedi',   key: 'saturday'  },
            ] as const).map(({ field, key }) => (
              <Controller
                key={field}
                name={field as keyof AllaitementModel}
                control={control}
                render={({ field: f }) => (
                  <TextField
                    {...f}
                    type="number"
                    label={t(`allaitement.form.${key}`)}
                    size="small"
                    value={f.value || 0}
                    onChange={(e) => f.onChange(Number(e.target.value))}
                    sx={{
                      '& .MuiOutlinedInput-root': { borderRadius: '8px' },
                      '& .MuiInputLabel-root': { fontSize: '11px' },
                    }}
                  />
                )}
              />
            ))}
          </Box>
        )}

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={resetForm}
            startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            Nouveau
          </Button>
          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={16} /> : <SaveIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '13px',
              background: 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)',
              boxShadow: '0 2px 8px rgba(0, 64, 161, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #003380 0%, #0040a1 100%)',
              },
            }}
          >
            Enregistrer
          </Button>
        </Box>
      </Paper>

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