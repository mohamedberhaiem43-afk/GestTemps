import { useEffect, useState } from 'react';
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
} from '@mui/material';
import SaveIcon from "@mui/icons-material/Save";
import './DemCongeInputs.css'
import SelectInputComponent from '../../../SelectInputComponent/SelectInputComponent';
import BreadcrumbNavigation from '../../../helper/BreadcrumbNavigation';
import InputComponent from '../../../Inputs/Input';
import CheckboxComponent from '../../../CheckboxComponent/CheckboxComponent';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh'
import useGetAbsencesLibs from '../../../../hooks/absenceHooks/useGetAbsenceLibs';
import useGetEmployee from '../../../../hooks/employeHooks/useGetEmployee';
import useAddDemConge from '../../../../hooks/congeHooks/useAddDemConge';
import useGetDemConges from '../../../../hooks/congeHooks/useGetDemConges';
import { useCongeContext } from '../../../helper/CongeContext';
import useUpdateDemConge from '../../../../hooks/congeHooks/useUpdateConge';
import { Conge } from '../../../../models/Conge';
import { getDatePartFromDate } from '../../../helper/TimeConverter/ExtractDateOnly';
import { useAuth } from '../../../helper/AuthProvider';
import generateNumeroOrdre from '../../../helper/GenerateNumOrdre';
import { useTranslation } from 'react-i18next';

export default function CongeForm() {
  const { selectedConge } = useCongeContext();
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const { soccod } = useAuth();
  const [empcod, setEmploye] = useState('');
  const [concod, setOrdre] = useState(generateNumeroOrdre());

  // Valeur par défaut: date d'aujourd'hui
  const [condat, setDate] = useState<Date | string>(getTodayDate());
  const [conref, setReference] = useState('');
  // Valeur par défaut: date d'aujourd'hui
  const [condep, setDateDepart] = useState<Date | string>(getTodayDate());
  const [conamdep, setApresMidiDepart] = useState(false);
  // Valeur par défaut: date d'aujourd'hui
  const [conret, setDateReprise] = useState<Date | string>(getTodayDate());
  const [conamret, setApresMidiReprise] = useState(false);
  const [conadr, setImputationAdresse] = useState('');
  const [contel, setTelephones] = useState('');
  const [conjour, setTimePeriod] = useState('J'); // Valeur par défaut: 'J' (Toute la Journée)
  const [abscod, setAbscod] = useState('');
  const [connbjour, setConnbjour] = useState(0);
  const [mode,setMode] = useState('save');
  const { data:absences = [] } = useGetAbsencesLibs();
  const { data:employeOptions = [] } = useGetEmployee();
  const { refetch } = useGetDemConges();
  const mutation = useAddDemConge();
  const { mutate: updateDemConge,isLoading:updateLoading} = useUpdateDemConge();
  const [writable,setWritable] = useState(true)
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'error'|'success'>('success');
  
  useEffect(() => {
    if (selectedConge) {
      setEmploye(selectedConge.empcod);
      setAbscod(selectedConge.abscod);
      setReference(selectedConge.conref);
      setTelephones(selectedConge.contel);
      setDateReprise(getDatePartFromDate(selectedConge.conret));
      setDate(getDatePartFromDate(selectedConge.condat));
      setDateDepart(getDatePartFromDate(selectedConge.condep));
      setApresMidiDepart(selectedConge.conamdep === '1');
      setTimePeriod(selectedConge.conjour);
      setConnbjour(selectedConge.connbjour);
      setOrdre(selectedConge.concod);
      setImputationAdresse(selectedConge.conadr);
      setApresMidiReprise(selectedConge.conamret === '1');
      setWritable(false);
      setMode('edit');
    }
  }, [selectedConge]);
  

  // Effect to calculate number of days between condep and conret
  useEffect(() => {
    if (condep && conret) {
      const dateDepart = new Date(condep);
      const dateReprise = new Date(conret);
      const differenceInTime = dateReprise.getTime() - dateDepart.getTime();
      const daysDifference = differenceInTime / (1000 * 3600 * 24); // Convert from ms to days
      setConnbjour(daysDifference);
    }

  }, [condep, conret]);

  const handleSubmit = (event:any) => {
    event.preventDefault();
    const congeData:Conge = {
      soccod:soccod || '', // already aligned with 'Soccod'
      empcod, // already aligned with 'Empcod'
      concod, // already aligned with 'Concod'
      condat: condat ? new Date(condat) : null, // Convert string date to DateTime format
      conref, // already aligned with 'Conref'
      condep: condep ? new Date(condep) : null, // Convert string date to DateTime format
      conamdep: conamdep ? '1' : '0', // Convert boolean to string '1' or '0'
      conret: conret ? new Date(conret) : null, // Convert string date to DateTime format
      conamret: conamret ? '1' : '0', // Convert boolean to string '1' or '0'
      conadr, // already aligned with 'Conadr'
      contel, // already aligned with 'Contel'
      connbjour, // already aligned with 'Connbjour'
      conjour, // already aligned with 'Conjour' (string)
      abscod ,
      emplib: null,
      condg: '',
      conrefus: '',
      consolde: 0
    };
    if(mode === 'save'){
      mutation.mutate(congeData, {
        onSuccess: () => {
            handleSnackbarOpening("Demande de congé ajoutée avec succées",'success');
            resetForm();
          },
          onError: () => {
            handleSnackbarOpening("Echéc d'ajout de la demande de congé",'error');
          },
        });
      }else if(mode === 'edit'){
        updateDemConge(congeData,{
        onSuccess() {
          handleSnackbarOpening("Demande de congé modifiée avec succées",'success');
          resetForm();
        },
        onError() {
          handleSnackbarOpening("Echéc de modification de la demande de congé",'error');
        },
      })
    }

  };

  const { t } = useTranslation();
  const resetForm = () => {
    setEmploye('');
    setAbscod('');
    setReference('');
    setTelephones('');
    setDateReprise(new Date());
    setApresMidiDepart(false);
    setTimePeriod('J');
    setConnbjour(0);
    setOrdre('');
    setImputationAdresse('');
    setDate(new Date());
    setApresMidiReprise(false);
    setDateDepart(new Date());
    setWritable(true);
    setMode('save');
    refetch();
  }

  
  const handleSnackbarOpening = (message:string,severity:'error'|'success') => {
    setMessage(message);
    setSeverity(severity);
    setIsSnackbarOpen(true);
  };
  const handleSnackbarClose = () => {
    setIsSnackbarOpen(false);
  };

  return (
<Box component="form" sx={{ mx: 'auto' }} onSubmit={handleSubmit}>
  <BreadcrumbNavigation />
  
  {/* En-tête avec N° Ordre et Actions */}
  <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button 
        variant="outlined" 
        onClick={resetForm} 
        color='secondary'
        startIcon={<RefreshIcon />}
      >
        Nouveau
      </Button>
      <Button
        variant="contained"
        onClick={handleSubmit}
        disabled={updateLoading}
        startIcon={updateLoading ? <CircularProgress size={20} /> : <SaveIcon />}
      >
        Enregistrer
      </Button>
    </Box>
  </Box>

  {/* Card principale */}
  <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2 }}>
    <CardContent sx={{ p: 3 }}>
      

      {/* Les 3 sections: Informations Générales + Période de Congé + Type de Congé (all in row) */}
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

        {/* Section 2: Période de Congé */}
        <Grid item xs={4}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#666', display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarTodayIcon fontSize="small" /> Période de Congé
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
              <Grid item xs={2} mt={2}>
                <TextField
                  label="Nb. Jours"
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

        {/* Section 3: Type de Congé et Contact */}
        <Grid item xs={4}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#666', display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoIcon fontSize="small" /> Type de Congé et Contact
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
              <Grid item xs={6}>
                <InputComponent 
                  type='text' 
                  label={t('common.address')} 
                  value={conadr} 
                  setValue={setImputationAdresse} 
                />
              </Grid>
              <Grid item xs={6}>
                <InputComponent 
                  type='tel' 
                  label={t('common.phone')} 
                  value={contel} 
                  setValue={setTelephones} 
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
</Box>
  );
}
