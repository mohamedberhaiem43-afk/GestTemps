import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Alert,
  Snackbar,
  TextField,
  Typography,
  MenuItem,
  Select,
  FormControl,
  Paper,
  CircularProgress,
} from '@mui/material';
import AddCardIcon from '@mui/icons-material/AddCard';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import apiInstance from '../../API/apiInstance';
import useGetEmployee from '../../../hooks/employeHooks/useGetEmployee';
import { useAuth } from '../../helper/AuthProvider';
import ForbiddenMessage from '../../AlertModal/ForbiddenMessage';
import getDatePart from '../../helper/TimeConverter/ExtractDateOnly';
import useUpdateContrat from '../../../hooks/contratHooks/useUpdateContrat';
// import { useTranslation } from 'react-i18next';
import generateNumeroOrdre from '../../helper/GenerateNumOrdre';
import getTodayDate from '../../helper/TimeConverter/TodayDate';
import { useQueryClient } from 'react-query';
import { Contrat } from '../../../models/Contrat';

interface SaisieContratModernProps {
  editingContract?: Contrat | null;
  setEditingContract?: (contract: Contrat | null) => void;
}

const contratTypes: Record<string, string> = {
  '0': 'CDD',
  '1': 'CDI',
  '2': 'Ouvrier',
  '3': 'CIVP',
};

const createInitialForm = () => ({
  numOrdre: generateNumeroOrdre(),
  dateDebut: getTodayDate(),
  dateFin: getTodayDate(),
  jours: '1',
  mois: '1',
  dateContrat: getTodayDate(),
  observations: '',
  typeContrat: '0',
  selectedEmployee: '',
});

const calculateMonths = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  return ((endDate.getFullYear() - startDate.getFullYear()) * 12) + endDate.getMonth() - startDate.getMonth() + 1;
};

const calculateDays = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff = endDate.getTime() - startDate.getTime();
  return diff >= 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) + 1 : 0;
};

const toApiDate = (value: string) => new Date(`${value}T00:00:00`);

const SaisieContratModern = ({ editingContract, setEditingContract }: SaisieContratModernProps) => {
  // const { t } = useTranslation();
  const { soccod } = useAuth();
  const sitcod = sessionStorage.getItem('sitcod');
  const queryClient = useQueryClient();
  const { data: employeesData } = useGetEmployee();
  const updateContrat = useUpdateContrat();

  // Convert employees data to array
  const employeesList = React.useMemo(() => {
    if (!employeesData) return [];
    if (Array.isArray(employeesData)) return employeesData;
    if (typeof employeesData === 'object') {
      return Object.entries(employeesData).map(([code, lib]) => ({ code, lib }));
    }
    return [];
  }, [employeesData]);

  const [isForbidden, setIsForbidden] = useState(false);
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'error' | 'success'>('success');
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState(createInitialForm());

  useEffect(() => {
    if (!editingContract) {
      return;
    }

    const editStartDate = editingContract.empemb ? getDatePart(editingContract.empemb) : getTodayDate();
    const editEndDate = editingContract.empsort ? getDatePart(editingContract.empsort) : getTodayDate();

    setForm({
      numOrdre: editingContract.concod || '',
      selectedEmployee: editingContract.empcod || '',
      dateContrat: editingContract.condat ? getDatePart(editingContract.condat) : getTodayDate(),
      typeContrat: editingContract.contype || '0',
      dateDebut: editStartDate,
      dateFin: editEndDate,
      mois: editingContract.conmois?.toString() || calculateMonths(editStartDate, editEndDate).toString(),
      jours: calculateDays(editStartDate, editEndDate).toString(),
      observations: editingContract.empmotif || '',
    });
  }, [editingContract]);

  useEffect(() => {
    setForm((current) => {
      const nextMonths = calculateMonths(current.dateDebut, current.dateFin).toString();
      const nextDays = calculateDays(current.dateDebut, current.dateFin).toString();

      if (current.mois === nextMonths && current.jours === nextDays) {
        return current;
      }

      return {
        ...current,
        mois: nextMonths,
        jours: nextDays,
      };
    });
  }, [form.dateDebut, form.dateFin]);

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetForm = () => {
    setForm(createInitialForm());
    setEditingContract?.(null);
  };

  const buildContractPayload = (): Contrat => ({
    soccod: soccod || '',
    concod: form.numOrdre,
    empcod: form.selectedEmployee,
    condat: toApiDate(form.dateContrat),
    contype: form.typeContrat.slice(0, 1),
    sitcod: sitcod || '',
    sercod: 'SR01',
    empreg: 'Y',
    catcod: '',
    vilcod: '',
    empadr: '',
    emppost: '',
    emptel: '',
    empemb: toApiDate(form.dateDebut),
    empsort: toApiDate(form.dateFin),
    condg: '',
    empmotif: form.observations,
    empdcin: toApiDate(form.dateFin),
    empacin: '',
    quacod: '',
    empech: '',
    empelon: '',
    empcat: '',
    empscat: '',
    cnscod: '',
    empsbase: '',
    empsbrut: '',
    socresp: '',
    dircod: '',
    empcontrat: '',
    conmois: parseFloat(form.mois),
  });

  const handleSuccess = (successMessage: string) => {
    setMessage(successMessage);
    setSeverity('success');
    setIsSnackbarOpen(true);
    queryClient.invalidateQueries(['contrats']);
    resetForm();
    setIsLoading(false);
  };

  const handleError = (error: any, fallbackMessage: string) => {
    setIsLoading(false);
    if (error?.response?.status === 403) {
      setIsForbidden(true);
      return;
    }
    setMessage(error?.response?.data?.message || fallbackMessage);
    setSeverity('error');
    setIsSnackbarOpen(true);
  };

  const saveContrat = () => {
    if (!form.selectedEmployee || !form.numOrdre || !form.dateContrat || !form.dateDebut || !form.dateFin) {
      setMessage('Veuillez remplir les informations obligatoires du contrat.');
      setSeverity('error');
      setIsSnackbarOpen(true);
      return;
    }

    setIsLoading(true);
    const contrat = buildContractPayload();

    if (editingContract) {
      updateContrat.mutate(contrat, {
        onSuccess: () => handleSuccess('Contrat modifié avec succès !'),
        onError: (error: any) => handleError(error, 'Erreur lors de la modification du contrat.'),
      });
      return;
    }

    apiInstance
      .post('/Contrats', contrat)
      .then((response) => {
        handleSuccess(response.data.message || 'Contrat enregistré avec succès !');
      })
      .catch((error) => {
        handleError(error, "Erreur lors de l'enregistrement du contrat.");
      });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    saveContrat();
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(25,28,30,0.08)',
          backgroundColor: '#ffffff',
          borderBottom: '3px solid #0040a1',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AddCardIcon sx={{ color: '#0040a1', fontSize: '20px' }} />
          <Typography
            sx={{ fontWeight: 700, fontFamily: 'Manrope, sans-serif', fontSize: '1rem' }}
          >
            {editingContract ? 'Modifier le Contrat' : 'Nouvelle Entrée'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Employee Select */}
          <Box>
            <Typography
              sx={{
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#515f74',
                mb: 0.5,
              }}
            >
              Employé
            </Typography>
            <FormControl fullWidth size="small">
              <Select
                value={form.selectedEmployee}
                onChange={(e) => updateField('selectedEmployee', e.target.value)}
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
                <MenuItem value="" disabled>Rechercher un employé...</MenuItem>
                {employeesList.map((emp: any) => (
                  <MenuItem key={emp.code || emp.empcod} value={emp.code || emp.empcod}>
                    {emp.lib || emp.empnom || emp.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* N° Contrat and Type */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Box>
              <Typography
                sx={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#515f74',
                  mb: 0.5,
                }}
              >
                N° Contrat
              </Typography>
              <TextField
                size="small"
                fullWidth
                value={form.numOrdre}
                onChange={(e) => updateField('numOrdre', e.target.value)}
                InputProps={{ readOnly: !!editingContract }}
                sx={{
                  backgroundColor: '#f2f4f6',
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '&:hover': { backgroundColor: '#ffffff' },
                  '&.Mui-focused': { backgroundColor: '#ffffff' },
                }}
              />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#515f74',
                  mb: 0.5,
                }}
              >
                Type
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={form.typeContrat}
                  onChange={(e) => updateField('typeContrat', e.target.value)}
                  sx={{
                    backgroundColor: '#f2f4f6',
                    borderRadius: '8px',
                    fontSize: '14px',
                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                    '&:hover': { backgroundColor: '#ffffff' },
                    '&.Mui-focused': { backgroundColor: '#ffffff' },
                  }}
                >
                  {Object.entries(contratTypes).map(([code, lib]) => (
                    <MenuItem key={code} value={code}>{lib}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>

          {/* Date Range */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Box>
              <Typography
                sx={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#515f74',
                  mb: 0.5,
                }}
              >
                Date Début
              </Typography>
              <TextField
                type="date"
                size="small"
                fullWidth
                value={form.dateDebut}
                onChange={(e) => updateField('dateDebut', e.target.value)}
                sx={{
                  backgroundColor: '#f2f4f6',
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '&:hover': { backgroundColor: '#ffffff' },
                  '&.Mui-focused': { backgroundColor: '#ffffff' },
                }}
              />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#515f74',
                  mb: 0.5,
                }}
              >
                Date Fin
              </Typography>
              <TextField
                type="date"
                size="small"
                fullWidth
                value={form.dateFin}
                onChange={(e) => updateField('dateFin', e.target.value)}
                sx={{
                  backgroundColor: '#f2f4f6',
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '&:hover': { backgroundColor: '#ffffff' },
                  '&.Mui-focused': { backgroundColor: '#ffffff' },
                }}
              />
            </Box>
          </Box>

          {/* Duration Info */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Box sx={{ p: 1.5, backgroundColor: '#f2f4f6', borderRadius: '8px' }}>
              <Typography sx={{ fontSize: '10px', color: '#515f74', mb: 0.5 }}>Jours</Typography>
              <Typography sx={{ fontSize: '14px', fontWeight: 700 }}>{form.jours}</Typography>
            </Box>
            <Box sx={{ p: 1.5, backgroundColor: '#f2f4f6', borderRadius: '8px' }}>
              <Typography sx={{ fontSize: '10px', color: '#515f74', mb: 0.5 }}>Mois</Typography>
              <Typography sx={{ fontSize: '14px', fontWeight: 700 }}>{form.mois}</Typography>
            </Box>
          </Box>

          {/* Observations */}
          <Box>
            <Typography
              sx={{
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#515f74',
                mb: 0.5,
              }}
            >
              Observations
            </Typography>
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={form.observations}
              onChange={(e) => updateField('observations', e.target.value)}
              placeholder="Notes complémentaires..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  backgroundColor: '#f2f4f6',
                  '& fieldset': { border: 'none' },
                  '&:hover': { backgroundColor: '#ffffff' },
                  '&.Mui-focused': { backgroundColor: '#ffffff' },
                },
              }}
            />
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
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
                backgroundColor: '#0040a1',
                boxShadow: '0 2px 8px rgba(0, 64, 161, 0.3)',
                '&:hover': { backgroundColor: '#003380' },
              }}
            >
              Enregistrer
            </Button>
          </Box>
        </Box>
      </Paper>

      <Snackbar open={isSnackbarOpen} autoHideDuration={4000} onClose={() => setIsSnackbarOpen(false)}>
        <Alert onClose={() => setIsSnackbarOpen(false)} severity={severity}>
          {message}
        </Alert>
      </Snackbar>

      {isForbidden && <ForbiddenMessage message="Vous n'êtes pas autorisé à effectuer cette action." />}
    </Box>
  );
};

export default SaisieContratModern;