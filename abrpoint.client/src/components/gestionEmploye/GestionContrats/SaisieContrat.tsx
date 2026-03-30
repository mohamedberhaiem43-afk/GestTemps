import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Grid,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import './GestionContrats.css';
import apiInstance from '../../API/apiInstance';
import SaveIcon from '@mui/icons-material/Save';
import SelectInputComponent from '../../SelectInputComponent/SelectInputComponent';
import InputComponent from '../../Inputs/Input';
import useGetEmployee from '../../../hooks/employeHooks/useGetEmployee';
import { useAuth } from '../../helper/AuthProvider';
import ForbiddenMessage from '../../AlertModal/ForbiddenMessage';
import getDatePart from '../../helper/TimeConverter/ExtractDateOnly';
import useUpdateContrat from '../../../hooks/contratHooks/useUpdateContrat';
import { useTranslation } from 'react-i18next';
import generateNumeroOrdre from '../../helper/GenerateNumOrdre';
import getTodayDate from '../../helper/TimeConverter/TodayDate';
import { useQueryClient } from 'react-query';
import { Contrat } from '../../../models/Contrat';

interface SaisieContratProps {
  editingContract?: Contrat | null;
  setEditingContract?: (contract: Contrat | null) => void;
}

const contratTypes = {
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

const SaisieContrat = ({ editingContract, setEditingContract }: SaisieContratProps) => {
  const { t } = useTranslation();
  const { soccod } = useAuth();
  const sitcod = sessionStorage.getItem('sitcod');
  const queryClient = useQueryClient();
  const { data: employees = [] } = useGetEmployee();
  const updateContrat = useUpdateContrat();

  const [isForbidden, setIsForbidden] = useState(false);
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'error' | 'success'>('success');
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

    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    empsbase: 0,
    empsbrut: 0,
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
  };

  const handleError = (error: any, fallbackMessage: string) => {
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

    const contrat = buildContractPayload();

    if (editingContract) {
      updateContrat.mutate(contrat, {
        onSuccess: () => handleSuccess('Contrat modifiï¿½ avec succï¿½s !'),
        onError: (error: any) => handleError(error, 'Erreur lors de la modification du contrat.'),
      });
      return;
    }

    apiInstance
      .post('/Contrats', contrat)
      .then((response) => {
        handleSuccess(response.data.message || 'Contrat enregistrï¿½ avec succï¿½s !');
      })
      .catch((error) => {
        handleError(error, 'Erreur lors de l enregistrement du contrat.');
      });
  };

  const handleSubmit = (event: any) => {
    event.preventDefault();
    saveContrat();
  };

  return (
    <>
      <Box component="form" onSubmit={handleSubmit} className="contract-form-shell">
        <Paper elevation={0} className="contract-form-panel">
          <Stack spacing={2}>

            <Grid container spacing={2}>
              <Grid item xs={6} md={6}>
                <Paper elevation={0} className="contract-section-card">
                  <Stack spacing={2}>
                    <Typography variant="subtitle1" fontWeight={700}>Identification</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6} md={6}>
                        <SelectInputComponent
                          label={t('common.employee')}
                          value={form.selectedEmployee}
                          setValue={(value: string) => updateField('selectedEmployee', value)}
                          maplist={employees}
                        />
                      </Grid>
                      <Grid item xs={6} md={6}>
                        <InputComponent
                          type="text"
                          label={t('contract.number')}
                          value={form.numOrdre}
                          setValue={(value: string) => updateField('numOrdre', value)}
                        />
                      </Grid>
                      <Grid item xs={6} md={6}>
                        <InputComponent
                          type="date"
                          label={t('contract.date')}
                          value={form.dateContrat}
                          setValue={(value: string) => updateField('dateContrat', value)}
                        />
                      </Grid>
                      <Grid item xs={6} md={6}>
                        <SelectInputComponent
                          label={t('contract.type')}
                          value={form.typeContrat}
                          setValue={(value: string) => updateField('typeContrat', value)}
                          maplist={contratTypes}
                        />
                      </Grid>
                    </Grid>
                  </Stack>
                </Paper>
              </Grid>

              <Grid item xs={6} md={6}>
                <Paper elevation={0} className="contract-section-card">
                  <Stack spacing={2}>
                    <Typography variant="subtitle1" fontWeight={700}>PÃ©riode du contrat</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6} md={6}>
                        <InputComponent
                          type="date"
                          label={t('common.dateStart')}
                          value={form.dateDebut}
                          setValue={(value: string) => updateField('dateDebut', value)}
                        />
                      </Grid>
                      <Grid item xs={6} md={6}>
                        <InputComponent
                          type="date"
                          label={t('common.dateEnd')}
                          value={form.dateFin}
                          setValue={(value: string) => updateField('dateFin', value)}
                        />
                      </Grid>
                      <Grid item xs={3} md={6}>
                        <InputComponent type="number" label={t('common.days')} value={form.jours} readOnly />
                      </Grid>
                      <Grid item xs={3} md={6}>
                        <InputComponent type="number" label={t('empEtatPeriodique.filters.month')} value={form.mois} readOnly />
                      </Grid>
                      <Grid item xs={6} md={6}>
                          <TextField
                            size="small"
                            label={t('empEtatPeriodique.headers.observation')}
                            fullWidth
                            multiline
                            minRows={2}
                            value={form.observations}
                            onChange={(event) => updateField('observations', event.target.value)}
                          />
                      </Grid>
                    </Grid>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>

       

            <Divider />

            <Box display="flex" justifyContent="flex-end" gap={1.5} flexWrap="wrap">
              {editingContract && (
                <Button variant="text" color="secondary" onClick={resetForm}>
                  Annuler
                </Button>
              )}
              <Button variant="contained" startIcon={<SaveIcon />} type="submit">
                {editingContract ? t('common.edit') : t('common.save')}
              </Button>
            </Box>
          </Stack>
        </Paper>

        {isForbidden && <ForbiddenMessage message="Vous n'Ã©tes pas autorisÃ© Ã  effectuer cette action." />}
      </Box>

      <Snackbar open={isSnackbarOpen} autoHideDuration={6000} onClose={() => setIsSnackbarOpen(false)}>
        <Alert onClose={() => setIsSnackbarOpen(false)} severity={severity}>
          {message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default SaisieContrat;


