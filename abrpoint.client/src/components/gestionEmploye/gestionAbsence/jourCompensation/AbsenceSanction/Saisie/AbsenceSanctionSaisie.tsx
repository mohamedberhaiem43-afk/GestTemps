import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Grid,
  Card,
  CardContent,
  Snackbar,
  Typography,
  CircularProgress,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
} from '@mui/material';
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from '@mui/icons-material/Refresh';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import InfoIcon from '@mui/icons-material/Info';
import './AbsSanc.css';
import InputComponent from '../../../../../Inputs/Input';
import SelectInputComponent from '../../../../../SelectInputComponent/SelectInputComponent';
import CheckboxComponent from '../../../../../CheckboxComponent/CheckboxComponent';
import useGetAbsencesLibs from '../../../../../../hooks/absenceHooks/useGetAbsenceLibs';
import useGetEmployee from '../../../../../../hooks/employeHooks/useGetEmployee';
import useAddSanction from '../../../../../../hooks/sanctionHooks/useAddSanction';
import useGetSanctions from '../../../../../../hooks/sanctionHooks/useGetSanctions';
import { useSanctionContext } from '../../../../../helper/SanctionContext';
import useUpdateSanction from '../../../../../../hooks/sanctionHooks/useUpdateSanction';
import { Sanction } from '../../../../../../models/Sanction';
import getDatePart from '../../../../../helper/TimeConverter/ExtractDateOnly';
import generateNumeroOrdre from '../../../../../helper/GenerateNumOrdre';
import { useAuth } from '../../../../../helper/AuthProvider';

export default function AbsenceSanctionSaisie() {
  const { selectedSanction } = useSanctionContext();
  const { soccod } = useAuth();
  const { t } = useTranslation();
  
  const [empcod, setEmploye] = useState('');
  const [concod, setOrdre] = useState(generateNumeroOrdre());
  const [condat, setDate] = useState<Date | string>();
  const [conref, setReference] = useState('');
  const [condep, setDateDepart] = useState<Date | string>();
  const [conamdep, setApresMidiDepart] = useState(false);
  const [conret, setDateReprise] = useState<Date | string>();
  const [conamret, setApresMidiReprise] = useState(false);
  const [conjour, setTimePeriod] = useState('J');
  const [abscod, setAbscod] = useState('');
  const [connbjour, setConnbjour] = useState(0);
  const [mode, setMode] = useState('save');
  const [writable, setWritable] = useState(true);
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'success' | 'error'>('success');
  const [isLoading, setIsLoading] = useState(false);

  const { data: absences = [] } = useGetAbsencesLibs();
  const { data: employeOptions = [] } = useGetEmployee();
  const { refetch } = useGetSanctions(soccod);
  const { mutate: addSanction } = useAddSanction();
  const { mutate: updateSanction } = useUpdateSanction();

  useEffect(() => {
    if (selectedSanction) {
      setEmploye(selectedSanction?.empcod || '');
      setOrdre(selectedSanction?.concod || '');
      setDate(getDatePart(selectedSanction?.condat?.toString() || ''));
      setReference(selectedSanction?.conref || '');
      setDateDepart(getDatePart(selectedSanction?.condep?.toString() || ''));
      setApresMidiDepart(selectedSanction?.conamdep === "1");
      setDateReprise(getDatePart(selectedSanction?.conret?.toString() || ''));
      setApresMidiReprise(selectedSanction?.conamret === "1");
      setTimePeriod(selectedSanction?.conjour || 'J');
      setAbscod(selectedSanction?.abscod || '');
      setConnbjour(selectedSanction?.connbjour || 0);
      setWritable(false);
      setMode('edit');
    }
  }, [selectedSanction]);

  // Effect to calculate number of days between condep and conret
  useEffect(() => {
    if (condep && conret) {
      const dateDepart = new Date(condep);
      const dateReprise = new Date(conret);
      const differenceInTime = dateReprise.getTime() - dateDepart.getTime();
      const daysDifference = differenceInTime / (1000 * 3600 * 24);
      setConnbjour(daysDifference);
    }
  }, [condep, conret]);

  const handleSubmit = (event: any) => {
    event.preventDefault();
    setIsLoading(true);

    let sanctionData: Sanction = {
      soccod,
      empcod,
      concod,
      condat: condat ? new Date(condat) : null,
      conref,
      condep: condep ? new Date(condep) : null,
      conamdep: conamdep ? '1' : '0',
      conret: conret ? new Date(conret) : null,
      conamret: conamret ? '1' : '0',
      connbjour,
      conjour,
      abscod,
    };

    if (mode === 'save') {
      addSanction(sanctionData, {
        onSuccess() {
          handleSnackbarOpening("Ajout de sanction avec succès", 'success');
          resetForm();
          setIsLoading(false);
        },
        onError() {
          handleSnackbarOpening("Échec d'ajout de sanction", 'error');
          setIsLoading(false);
        },
      });
    } else if (mode === 'edit') {
      updateSanction(sanctionData, {
        onSuccess() {
          handleSnackbarOpening("Modification de sanction avec succès", 'success');
          resetForm();
          setIsLoading(false);
        },
        onError() {
          handleSnackbarOpening("Problème lors de modification de sanction", 'error');
          setIsLoading(false);
        },
      });
    }
  };

  const resetForm = () => {
    setEmploye('');
    setOrdre(generateNumeroOrdre());
    setDate(new Date());
    setReference('');
    setDateDepart(new Date());
    setApresMidiDepart(false);
    setDateReprise(new Date());
    setApresMidiReprise(false);
    setTimePeriod('J');
    setAbscod('');
    setConnbjour(0);
    setWritable(true);
    setMode('save');
    refetch();
  };

  const handleSnackbarOpening = (message: string, severity: 'success' | 'error') => {
    setMessage(message);
    setSeverity(severity);
    setIsSnackbarOpen(true);
  };

  const handleSnackbarClose = () => {
    setIsSnackbarOpen(false);
  };

  return (
    <Box component="form" sx={{ mx: 'auto' }} onSubmit={handleSubmit}>
      
      {/* En-tête avec Actions */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            onClick={resetForm}
            color="secondary"
            startIcon={<RefreshIcon />}
          >
            {t('common.new')}
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
                    <InputComponent
                      readOnly={!writable}
                      type='text'
                      label={t('common.orderNumber')}
                      value={concod}
                      setValue={setOrdre}
                    />
                  </Grid>
                  <Grid item xs={6} mt={1}>
                    <SelectInputComponent
                      label={t('common.employee')}
                      value={empcod}
                      setValue={setEmploye}
                      maplist={employeOptions}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <InputComponent
                      type='date'
                      label={t('common.date')}
                      value={condat}
                      setValue={setDate}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <InputComponent
                      type='text'
                      label={t('common.ref')}
                      value={conref}
                      setValue={setReference}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Grid>

            {/* Section 2: Période de Sanction */}
            <Grid item xs={4}>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#666', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarTodayIcon fontSize="small" /> Période de Sanction
                </Typography>
                <Grid container spacing={2}>
                  {/* Date Départ */}
                  <Grid item xs={6}>
                    <InputComponent
                      type='date'
                      label={t('common.dateStart')}
                      value={condep}
                      setValue={setDateDepart}
                    />
                  </Grid>
                  <Grid item xs={6} mt={2} sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckboxComponent
                      label={t('common.afternoon')}
                      value={conamdep}
                      setValue={setApresMidiDepart}
                    />
                  </Grid>

                  {/* Date Reprise */}
                  <Grid item xs={6}>
                    <InputComponent
                      type='date'
                      label={t('common.dateEnd')}
                      value={conret}
                      setValue={setDateReprise}
                    />
                  </Grid>
                  <Grid item xs={3} mt={2} sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckboxComponent
                      label={t('common.afternoon')}
                      value={conamret}
                      setValue={setApresMidiReprise}
                    />
                  </Grid>

                  {/* Nombre de jours calculé */}
                  <Grid item xs={3} mt={2}>
                    <TextField
                      label={t('common.nbDays')}
                      size="small"
                      fullWidth
                      value={connbjour}
                      InputProps={{
                        readOnly: true,
                        sx: {
                          backgroundColor: '#f5f5f5',
                          fontWeight: 600,
                          fontSize: '1rem',
                          color: '#1976d2'
                        }
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Grid>

            {/* Section 3: Type et Période */}
            <Grid item xs={4}>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#666', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InfoIcon fontSize="small" /> Type et Période
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <SelectInputComponent
                      label={t('common.imputation')}
                      value={abscod}
                      setValue={setAbscod}
                      maplist={absences}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl component="fieldset" fullWidth>
                      <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1 }}>
                        Période
                      </FormLabel>
                      <RadioGroup
                        value={conjour}
                        onChange={(e) => setTimePeriod(e.target.value)}
                      >
                        <FormControlLabel
                          value="J"
                          control={<Radio size="small" />}
                          label={<Typography fontSize="small">{t('common.wholeDay')}</Typography>}
                        />
                        <FormControlLabel
                          value="M"
                          control={<Radio size="small" />}
                          label={<Typography fontSize="small">{t('common.morning')}</Typography>}
                        />
                        <FormControlLabel
                          value="A"
                          control={<Radio size="small" />}
                          label={<Typography fontSize="small">{t('common.afternoon')}</Typography>}
                        />
                      </RadioGroup>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>
            </Grid>

          </Grid>

        </CardContent>
      </Card>

      {/* Snackbar */}
      <Snackbar open={isSnackbarOpen} autoHideDuration={1500} onClose={handleSnackbarClose}>
        <Alert onClose={handleSnackbarClose} severity={severity}>
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}