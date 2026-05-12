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
} from "@mui/material";
import { DatePicker, LocalizationProvider, TimePicker } from "@mui/x-date-pickers";
import duration from "dayjs/plugin/duration";
import dayjs, { Dayjs } from "dayjs";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from '@mui/icons-material/Refresh';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import InfoIcon from '@mui/icons-material/Info';
import PeopleIcon from '@mui/icons-material/People';
import './SaisieAutSortie.css';
import CheckboxListSecondary from "../../../../../CheckboxList/CheckboxListSecondary";
import SelectInputComponent from "../../../../../SelectInputComponent/SelectInputComponent";
import InputComponent from "../../../../../Inputs/Input";
// Avant : useGetAbsencesLibs (toutes les natures) → l'opérateur pouvait sélectionner
// un congé / une mission par erreur sur une autorisation de sortie. On bascule sur
// useGetAutorisationLibs (filtre Abscng='B' côté backend) pour ne lister que les
// natures d'absence de type "Autorisation", en cohérence avec DemandeAutorisation.
import useGetAutorisationLibs from "../../../../../../hooks/absenceHooks/useGetAutorisationLibs";
import useGetEmployee from "../../../../../../hooks/employeHooks/useGetEmployee";
import { useSortieGeneralContext } from "../../../../../helper/SortieGeneralContext";
import useAddSortie from "../../../../../../hooks/sortieHooks/useAddSortie";
import { Autoriser } from "../../../../../../models/Autoriser";
import useAddBulkSortie from "../../../../../../hooks/sortieHooks/useAddBulkSortie";
import useUpdateSortie from "../../../../../../hooks/sortieHooks/useUpdateSortie";
import useGetSortie from "../../../../../../hooks/sortieHooks/useGetSortie";
import generateNumeroOrdre from "../../../../../helper/GenerateNumOrdre";
import { useAuth } from "../../../../../helper/AuthProvider";

interface SaisieAutSortieProps {
  type: string;
}

export default function SaisieAutSortie({ type }: SaisieAutSortieProps) {
  const { t } = useTranslation();
  const { selectedSortieGeneral } = useSortieGeneralContext();
  const { soccod, uticod } = useAuth();
  
  const [empcod, setEmpcod] = useState<string | null>("");
  const [concod, setConcod] = useState<string>(generateNumeroOrdre());
  const [conmotif, setConmotif] = useState<string | null>("");
  const [abscod, setAbscod] = useState<string | null>("");
  const [conref, setConref] = useState<string | null>("");
  const [condat, setCondat] = useState<[Dayjs | null, Dayjs | null]>([dayjs(), dayjs()]);
  const [showExceptionList, setShowExceptionList] = useState(false);
  const [checkedEmployees, setCheckedEmployees] = useState<number[]>([]);
  const [mode, setMode] = useState('save');
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'success' | 'error'>('success');
  const [writable, setWritable] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const { data: absences = [] } = useGetAutorisationLibs();
  const { data: employes = [] } = useGetEmployee();
  const { mutate: addSortie } = useAddSortie();
  const { mutate: addBulkSortie } = useAddBulkSortie();
  const { mutate: updateSortie } = useUpdateSortie();
  const { refetch } = useGetSortie(uticod);

  const toggleExceptionList = () => {
    setShowExceptionList(prev => !prev);
  };

  const generateUniqueConcod = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters[randomIndex];
    }
    return result;
  };

  const handleToggle = (value: number) => () => {
    const currentIndex = checkedEmployees.indexOf(value);
    const newChecked = [...checkedEmployees];

    if (currentIndex === -1) {
      newChecked.push(value);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    setCheckedEmployees(newChecked);
  };

  useEffect(() => {
    if (selectedSortieGeneral) {
      setAbscod(selectedSortieGeneral?.abscod);
      setConcod(selectedSortieGeneral?.concod);
      setConmotif(selectedSortieGeneral?.conmotif);

      const startDate = dayjs(selectedSortieGeneral?.condep);
      const endDate = dayjs(selectedSortieGeneral?.conret);

      setCondat([startDate, endDate]);
      setConref(selectedSortieGeneral?.conref);
      setEmpcod(selectedSortieGeneral?.empcod);
      setWritable(false);
      setMode('edit');
    }
  }, [selectedSortieGeneral]);

  dayjs.extend(duration);

  const calculateTimeDifference = (start: Dayjs | null, end: Dayjs | null) => {
    if (start && end) {
      const startHour = start.hour();
      const startMinute = start.minute();
      const endHour = end.hour();
      const endMinute = end.minute();

      const startInMinutes = startHour * 60 + startMinute;
      const endInMinutes = endHour * 60 + endMinute;

      let differenceInMinutes = endInMinutes - startInMinutes;

      if (differenceInMinutes < 0) {
        differenceInMinutes += 24 * 60;
      }

      return dayjs.duration(differenceInMinutes, "minutes").asHours();
    }
    return 0;
  };

  const hoursDifference = calculateTimeDifference(condat[0], condat[1]);

  const handleSave = async () => {
    setIsLoading(true);

    if (type == 'generale' && mode === 'save') {
      const employeesArray = Object.entries(employes);
      const employeesToSubmit = employeesArray.filter(([], index) => !checkedEmployees.includes(index));

      const SortieDataArray: Autoriser[] = employeesToSubmit.map(([empcod]) => ({
        empcod: empcod || null,
        concod: generateUniqueConcod(),
        condat: condat[0]?.format('YYYY-MM-DD') || undefined,
        condep: `${condat[0]?.format('YYYY-MM-DD')}T${condat[0]?.format('HH:mm:ss')}`,
        conret: `${condat[1]?.format('YYYY-MM-DD')}T${condat[1]?.format('HH:mm:ss')}`,
        connbjour: parseFloat(hoursDifference.toFixed(2)),
        abscod: abscod || null,
        soccod: soccod,
        conmotif: conmotif || null,
        conref: conref || null
      }));

      addBulkSortie(SortieDataArray, {
        onSuccess() {
          handleSnackbarOpening("Autorisations de Sortie sont ajoutées avec succès", 'success');
          resetForm();
          setIsLoading(false);
        },
        onError() {
          handleSnackbarOpening("Échec d'ajout les autorisations de sortie", 'error');
          setIsLoading(false);
        },
      });
    } else {
      const data: Autoriser = {
        empcod: empcod,
        concod: concod,
        abscod: abscod,
        conref: conref,
        conmotif: conmotif,
        condat: condat[0]?.format('YYYY-MM-DD'),
        condep: `${condat[0]?.format('YYYY-MM-DD')}T${condat[0]?.format('HH:mm:ss')}`,
        conret: `${condat[1]?.format('YYYY-MM-DD')}T${condat[1]?.format('HH:mm:ss')}`,
        connbjour: parseFloat(hoursDifference.toFixed(2)),
        soccod: soccod || '01',
      };

      let payload: Autoriser = {} as Autoriser;
      payload = {
        ...data,
        conmotif: data.conmotif,
        conref: data.conref,
      };

      if (mode === 'save') {
        addSortie(payload, {
          onSuccess() {
            handleSnackbarOpening("Autorisation de Sortie ajoutée avec succès", 'success');
            resetForm();
            setIsLoading(false);
          },
          onError() {
            handleSnackbarOpening("Échec d'ajout l'autorisation de sortie", 'error');
            setIsLoading(false);
          },
        });
      } else if (mode === 'edit') {
        updateSortie(payload, {
          onSuccess: () => {
            handleSnackbarOpening("Autorisation de Sortie modifiée avec succès", 'success');
            resetForm();
            setIsLoading(false);
          },
          onError() {
            handleSnackbarOpening("Échec lors de modification de l'autorisation de sortie", 'error');
            setIsLoading(false);
          },
        });
      }
    }
  };

  const resetForm = () => {
    setAbscod('');
    setConcod(generateNumeroOrdre());
    setConmotif('');
    setCondat([dayjs(), dayjs()]);
    setConref('');
    setEmpcod('');
    setWritable(true);
    setMode('save');
    setCheckedEmployees([]);
    setShowExceptionList(false);
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
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="fr">
      <Box component="form" sx={{ mx: "auto" }}>
        
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
              variant="contained"
              onClick={handleSave}
              disabled={isLoading}
              startIcon={isLoading ? <CircularProgress size={20} /> : <SaveIcon />}
            >
              Enregistrer
            </Button>
            {type === "generale" && (
              <Button
                variant="outlined"
                color="secondary"
                onClick={toggleExceptionList}
                startIcon={<PeopleIcon />}
              >
                Exception
              </Button>
            )}
          </Box>
        </Box>

        {/* Liste d'exceptions (si activée) */}
        {showExceptionList && (
          <Card sx={{ mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#666' }}>
                Liste des exceptions
              </Typography>
              <CheckboxListSecondary
                employees={employes}
                checked={checkedEmployees}
                handleToggle={handleToggle}
              />
            </CardContent>
          </Card>
        )}

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
                        setValue={setConcod}
                      />
                    </Grid>
                    {type === 'speciale' && (
                      <Grid item xs={6} mt={1}>
                        <SelectInputComponent
                          label={t('common.employee')}
                          value={empcod}
                          setValue={setEmpcod}
                          maplist={employes}
                        />
                      </Grid>
                    )}
                    <Grid item xs={12}>
                      <InputComponent
                        type='text'
                        label={t('common.ref')}
                        value={conref}
                        setValue={setConref}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Grid>

              {/* Section 2: Horaires de Sortie */}
              <Grid item xs={4}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#666', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccessTimeIcon fontSize="small" /> Horaires de Sortie
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <DatePicker
                        label={t('common.date')}
                        value={condat[0]}
                        onChange={(newDate) => setCondat([newDate, condat[1]])}
                        format="DD/MM/YYYY"
                        slotProps={{ textField: { size: 'small', fullWidth: true } }}
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <TimePicker
                        views={['hours', 'minutes', 'seconds']}
                        label={t('common.startTime')}
                        value={condat[0]}
                        onChange={(newValue) => setCondat([newValue, condat[1]])}
                        slotProps={{ textField: { size: 'small', fullWidth: true } }}
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <TimePicker
                        views={['hours', 'minutes', 'seconds']}
                        label={t('common.endTime')}
                        value={condat[1]}
                        onChange={(newValue) => setCondat([condat[0], newValue])}
                        slotProps={{ textField: { size: 'small', fullWidth: true } }}
                      />
                    </Grid>
                    <Grid item xs={3}>
                      <TextField
                        label="Durée"
                        size="small"
                        fullWidth
                        value={`${hoursDifference.toFixed(2)} heures`}
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

              {/* Section 3: Type et Motif */}
              <Grid item xs={4}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#666', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfoIcon fontSize="small" /> Type et Motif
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
                      <InputComponent
                        type='text'
                        label={t('common.reason')}
                        value={conmotif}
                        setValue={setConmotif}
                      />
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
    </LocalizationProvider>
  );
}