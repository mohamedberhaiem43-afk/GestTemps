import React, { useEffect, useState, useCallback } from 'react';
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
  InputAdornment,
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
import getTodayDate from '../../helper/TimeConverter/TodayDate';
import apiInstance from '../../API/apiInstance';
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
  const [nbHeures, setNbHeures] = useState<number>(0);

  const { control, reset, handleSubmit, setValue } = useForm<AllaitementModel>({
    defaultValues: {
      empcod: '',
      concod: '',
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

  // Fetch next concod from server
  const fetchNextConcod = useCallback(async (): Promise<string> => {
    try {
      const res = await apiInstance.get(`/Allaitements/get-next-concod/${soccod}`);
      return res.data?.concod || res.data || '';
    } catch {
      // Fallback: generate client-side
      const year = new Date().getFullYear().toString().slice(-2);
      const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
      return `00${year}${month}01`;
    }
  }, [soccod]);

  // Convert object or array to array of { code, lib } for mapping
  const employesList = React.useMemo(() => {
    if (!employesData) return [];
    if (Array.isArray(employesData)) return employesData;
    if (typeof employesData === 'object') {
      return Object.entries(employesData).map(([code, lib]) => ({ code, lib }));
    }
    return [];
  }, [employesData]);

  // Load next concod on mount (add mode)
  useEffect(() => {
    if (!selectedAllaitement) {
      fetchNextConcod().then(concod => {
        reset({
          concod,
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
      });
    }
  }, []);

  useEffect(() => {
    if (selectedAllaitement) {
      reset({
        concod: selectedAllaitement.concod || '',
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
      // Set nbHeures to the max day value for reference
      const dayValues = [
        Number(selectedAllaitement.lundi),
        Number(selectedAllaitement.mardi),
        Number(selectedAllaitement.mercredi),
        Number(selectedAllaitement.jeudi),
        Number(selectedAllaitement.vendredi),
        Number(selectedAllaitement.samedi),
      ];
      setNbHeures(Math.max(...dayValues));
      setIsEditMode(true);
    } else {
      resetForm();
    }
  }, [selectedAllaitement, reset]);

  // Distribute nbHeures to all days
  const handleNbHeuresChange = (value: number) => {
    setNbHeures(value);
    const days: (keyof AllaitementModel)[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    days.forEach(day => setValue(day, value));
  };

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
    setNbHeures(0);
    setIsEditMode(false);
    setSelectedAllaitement(null);
    // Fetch fresh concod from server
    fetchNextConcod().then(concod => {
      reset({
        concod,
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
    });
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

  const labelSx = {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05rem',
    color: '#515f74',
    mb: 0.5,
  };

  const inputSx = {
    backgroundColor: '#f2f4f6',
    borderRadius: '8px',
    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
    '&:hover': { backgroundColor: '#ffffff' },
    '&.Mui-focused': { backgroundColor: '#ffffff' },
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
            <Typography sx={labelSx}>
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
                    sx={inputSx}
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

          {/* N° Ordre (auto-generated) */}
          <Box>
            <Typography sx={labelSx}>
              {t('allaitement.form.order') || 'N° Allaitement'}
            </Typography>
            <Controller
              name="concod"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  size="small"
                  fullWidth
                  InputProps={{ readOnly: true }}
                  sx={{
                    ...inputSx,
                    '& .MuiInputBase-input': { color: '#0040a1', fontWeight: 700, fontFamily: 'monospace' },
                  }}
                />
              )}
            />
          </Box>

          {/* Date Range */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Box>
              <Typography sx={labelSx}>
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
                    sx={inputSx}
                  />
                )}
              />
            </Box>
            <Box>
              <Typography sx={labelSx}>
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
                    sx={inputSx}
                  />
                )}
              />
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Hours Configuration Card — Hebdo only */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(25,28,30,0.08)',
          backgroundColor: '#ffffff',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <ScheduleIcon sx={{ color: '#0040a1', fontSize: '20px' }} />
          <Typography
            sx={{ fontWeight: 700, fontFamily: 'Manrope, sans-serif', fontSize: '1rem' }}
          >
            Heures d'Allaitement
          </Typography>
        </Box>

        {/* Nb Heures field — distributes to all days */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={labelSx}>
            Nb Heures / Jour
          </Typography>
          <TextField
            type="number"
            size="small"
            fullWidth
            value={nbHeures || ''}
            onChange={(e) => handleNbHeuresChange(Number(e.target.value) || 0)}
            placeholder="Ex: 1"
            InputProps={{
              endAdornment: <InputAdornment position="end">h/jour</InputAdornment>,
              inputProps: { min: 0, max: 24, step: 0.5 },
            }}
            sx={{
              '& .MuiOutlinedInput-root': { borderRadius: '8px' },
            }}
          />
          <Typography sx={{ fontSize: '10px', color: '#8896a8', mt: 0.5, fontStyle: 'italic' }}>
            Saisissez le nombre d'heures — il sera appliqué à chaque jour automatiquement.
          </Typography>
        </Box>

        {/* Daily hours grid (read-only display of distributed hours) */}
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
                  onChange={(e) => {
                    f.onChange(Number(e.target.value));
                  }}
                  InputProps={{
                    inputProps: { min: 0, max: 24, step: 0.5 },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': { borderRadius: '8px' },
                    '& .MuiInputLabel-root': { fontSize: '11px' },
                  }}
                />
              )}
            />
          ))}
        </Box>

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