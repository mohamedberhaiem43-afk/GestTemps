import { useEffect, useState } from 'react';
import { Box, Grid, Button, Collapse, Typography, Card, CardContent, CircularProgress, Alert } from '@mui/material';
import { useFeedbackSnackbar } from '../../../../helper/FeedbackSnackbar';
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from "@mui/icons-material/Refresh";
import PeopleIcon from '@mui/icons-material/People';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import InfoIcon from '@mui/icons-material/Info';
import InputComponent from '../../../../Inputs/Input';
import SelectInputComponent from '../../../../SelectInputComponent/SelectInputComponent';
import CheckboxComponent from '../../../../CheckboxComponent/CheckboxComponent';
import CheckboxListSecondary from '../../../../CheckboxList/CheckboxListSecondary';
import useGetAbsencesLibs from '../../../../../hooks/absenceHooks/useGetAbsenceLibs';
import useGetEmployee from '../../../../../hooks/employeHooks/useGetEmployee';
import useAddConge from '../../../../../hooks/congeHooks/useAddConge';
import useGetTitreConge from '../../../../../hooks/congeHooks/useGetTitreConge';
import useGetTitreCongeById from '../../../../../hooks/congeHooks/useGetTitreCongeById';
import useAddBulkConges from '../../../../../hooks/congeHooks/useAddBulkConges';
import useGetEtatConge from '../../../../../hooks/employeHooks/useGetEtatConge';
import BreadcrumbNavigation from '../../../../helper/BreadcrumbNavigation';
import { useCongeContext } from '../../../../helper/CongeContext';
import useUpdateTitreConge from '../../../../../hooks/congeHooks/useUpdateTitreConge';
import { Conge } from '../../../../../models/Conge';
import EtatConge from '../../../../../models/EtatConge';
import getDatePart from '../../../../helper/TimeConverter/ExtractDateOnly';
import generateNumeroOrdre from '../../../../helper/GenerateNumOrdre';
import { useTranslation } from 'react-i18next';


export default function TitreCongeForm({ titre }:{titre:string}) {
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const [condep, setDateDepart] = useState<string | null>(getTodayDate());
  const [conret, setDateReprise] = useState<string | null>(getTodayDate());
  const [empcod, setEmploye] = useState('');
  const [concod, setOrdre] = useState(generateNumeroOrdre());
  const [condat, setDate] = useState<string | null>(getTodayDate());
  const [conref, setReference] = useState('');
  const [conamdep, setApresMidiDepart] = useState(false);
  const [conamret, setApresMidiReprise] = useState(false);
  const [conadr, setImputationAdresse] = useState('');
  const [contel, setTelephones] = useState('');
  const [condg, setTimePeriod] = useState('J');
  const [conjour, setConjour] = useState('J');
  const [abscod, setAbscod] = useState('');
  const [connbjour, setNbJour] = useState(0);
  const [showExceptionList, setShowExceptionList] = useState(false);
  const [checkedEmployees, setCheckedEmployees] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const soccod = sessionStorage.getItem('soccod');

  const moisdeb = condep ? new Date(condep).getMonth() + 1 : null;
  const moisfin = conret ? new Date(conret).getMonth() + 1 : null;
  const annee = condep ? new Date(condep).getFullYear() : null;
  
  const [showEtatConge, setShowEtatConge] = useState(false);
  const [etatCongeError, setEtatCongeError] = useState('');
  const { data: etatConge = {} as EtatConge, refetch: refetchEtatConge } = useGetEtatConge(soccod, empcod, moisdeb, moisfin, annee);
  const { mutate: updateConge } = useUpdateTitreConge();
  const { t } = useTranslation();

  useEffect(() => {
    if (empcod && moisdeb && moisfin && annee) {
      refetchEtatConge();
      setShowEtatConge(true);
    }
  }, [empcod, moisdeb, moisfin, annee, refetchEtatConge]);

  useEffect(() => {
    if (etatConge?.anciennete < 0) {
      setEtatCongeError(t('conge.errors.notHired') || "Employee is not hired on the specified date.");
    } else {
      setEtatCongeError('');
    }
  }, [etatConge]);

  const generateUniqueConcod = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters[randomIndex];
    }
    return result;
  };

  const { data: emp = [] } = useGetEmployee();
  const { data: absences = [] } = useGetAbsencesLibs();
  const { mutate: addConge } = useAddConge();
  const { mutate: addBulkConge } = useAddBulkConges();
  const { selectedConge } = useCongeContext();
  const { data: congeToEdit = [] } = useGetTitreCongeById(selectedConge?.concod || '');
  const [mode, setMode] = useState('save');
  const [writable, setWritable] = useState(true);
  const feedback = useFeedbackSnackbar();

  const { refetch } = useGetTitreConge();

  useEffect(() => {
    if (congeToEdit.concod && titre != "Titre de Congés Génerale") {
      setEmploye(congeToEdit?.empcod || '');
      setOrdre(congeToEdit?.concod || '');
      setDate(getDatePart(congeToEdit?.condat) || null);
      setDateDepart(getDatePart(congeToEdit?.condep) || null);
      setDateReprise(getDatePart(congeToEdit?.conret) || null);
      setReference(congeToEdit?.conref || '');
      setApresMidiDepart(congeToEdit?.conamdep === '1');
      setApresMidiReprise(congeToEdit?.conamret === '1');
      setImputationAdresse(congeToEdit?.conadr || '');
      setTelephones(congeToEdit?.contel || '');
      setTimePeriod(congeToEdit?.condg || 'J');
      setConjour(congeToEdit?.conjour || 'J');
      setAbscod(congeToEdit?.abscod || '');
      setNbJour(congeToEdit?.connbjour || 0);
      setWritable(false);
      setMode('edit');
    }
  }, [congeToEdit]);

  useEffect(() => {
    if (!condep || !conret) {
      setNbJour(0);
      return;
    }

    const startDate = new Date(condep);
    const endDate = new Date(conret);

    if (endDate < startDate) {
      setNbJour(0);
      return;
    }

    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysDifference = timeDiff / (1000 * 3600 * 24);
    const adjustedDays = daysDifference + (conamret ? 0.5 : 0) - (conamdep ? 0.5 : 0);

    setNbJour(Math.max(0, Number(adjustedDays.toFixed(2))));
  }, [condep, conret, conamdep, conamret, conjour]);

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

  const handleSubmit = () => {
    setIsLoading(true);

    if (titre === "Titre de Congés Génerale") {
      const employeesArray = Object.entries(emp);
      const employeesToSubmit = employeesArray.filter(([], index) => !checkedEmployees.includes(index));
  
      const congeDataArray = employeesToSubmit.map(([empcod]) => ({
        empcod,
        concod: generateUniqueConcod(),
        condat,
        conref,
        condep,
        conamdep: conamdep ? '1' : '0',
        conret,
        conamret: conamret ? '1' : '0',
        conadr,
        contel,
        condg,
        connbjour,
        abscod,
        soccod: sessionStorage.getItem('soccod')
      }));

      addBulkConge(congeDataArray, {
        onSuccess: () => {
          feedback.showSuccess(t('conge.messages.bulkAddSuccess') || 'Leaves added successfully');
          resetForm();
          setIsLoading(false);
        },
        onError: (err: any) => {
          feedback.showError(err, t('conge.messages.bulkAddError') || 'Error adding leaves');
          setIsLoading(false);
        }
      });
    } else {
      const congeData: Conge = {
        soccod: soccod || "01",
        empcod,
        concod,
        condat: new Date(condat || ''),
        conref,
        condep: new Date(condep || ''),
        conamdep: conamdep ? '1' : '0',
        conret: new Date(conret || ''),
        conamret: conamret ? '1' : '0',
        conadr,
        contel,
        condg,
        connbjour,
        abscod,
        conjour: conjour,
        conrefus: '',
        consolde: 0,
        emplib: null
      };

      if (congeData.empcod == '' && congeData.concod == '') {
        feedback.showError(t('common.requiredFields') || 'Please fill all required fields');
        setIsLoading(false);
        return;
      }

      if (mode === 'save') {
        addConge(congeData, {
          onSuccess: () => {
            feedback.showSuccess(t('conge.messages.addSuccess') || 'Leave added successfully');
            resetForm();
            setIsLoading(false);
          },
          onError: (err: any) => {
            feedback.showError(err, t('conge.messages.addError') || 'Failed to add leave');
            setIsLoading(false);
          }
        });
      } else if (mode === 'edit') {
        updateConge(congeData, {
          onSuccess() {
            feedback.showSuccess(t('conge.messages.updateSuccess') || 'Leave updated successfully');
            resetForm();
            setIsLoading(false);
          },
          onError(err: any) {
            feedback.showError(err, t('conge.messages.updateError') || 'Failed to update leave');
            setIsLoading(false);
          },
        });
      }
    }
  };

  const toggleExceptionList = () => {
    setShowExceptionList(prev => !prev);
  };

  const resetForm = () => {
    setEmploye('');
    setAbscod('');
    setReference('');
    setTelephones('');
    setDateReprise(null);
    setApresMidiDepart(false);
    setTimePeriod('J');
    setNbJour(0);
    setOrdre(generateNumeroOrdre());
    setImputationAdresse('');
    setDate(null);
    setApresMidiReprise(false);
    setWritable(true);
    setMode('save');
    setShowEtatConge(false);
    setCheckedEmployees([]);
    setShowExceptionList(false);
    refetch();
  };

  return (
    <Box component="form" sx={{ mx: 'auto' }} onSubmit={handleSubmit}>
      <BreadcrumbNavigation />
      
      {/* En-tête avec Actions */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            variant="outlined" 
            onClick={resetForm} 
            color='secondary'
            startIcon={<RefreshIcon />}
          >
            {t('common.new') || 'Nouveau'}
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            {t('common.save') || 'Enregistrer'}
          </Button>
          {titre === "Titre de Congés Génerale" && (
            <Button
              variant="outlined"
              color="secondary"
              onClick={toggleExceptionList}
              startIcon={<PeopleIcon />}
            >
              {t('conge.actions.exception') || 'Exception'}
            </Button>
          )}
        </Box>
      </Box>

      {/* Liste d'exceptions (si activée) */}
      {showExceptionList && titre === "Titre de Congés Génerale" && (
        <Card sx={{ mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#666' }}>
              Liste des exceptions
            </Typography>
            <CheckboxListSecondary 
              employees={emp} 
              checked={checkedEmployees} 
              handleToggle={handleToggle} 
            />
          </CardContent>
        </Card>
      )}

      {/* Card principale */}
      <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          
          {/* Les 3 sections: Informations Générales + Période de Congé + Type de Congé (all in row) */}
          <Grid container spacing={2} sx={{ mb: 3 }} wrap="nowrap" alignItems="flex-start">
            
            {/* Section 1: Informations Générales */}
            <Grid item xs={4}>
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    mb: 2,
                    fontWeight: 600,
                    color: '#666',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <AssignmentIcon fontSize="small" />
                  Informations Générales
                </Typography>

                <Grid container spacing={2}>
                  {/* Ordre */}
                  <Grid item xs={6}>
                    <InputComponent
                      readOnly={!writable}
                      label={t('common.orderNumber')}
                      type="text"
                      value={concod}
                      setValue={setOrdre}
                    />
                  </Grid>

                  {/* Date */}
                  <Grid item xs={6}>
                    <InputComponent
                      label={t('common.date')}
                      type="date"
                      value={condat}
                      setValue={setDate}
                    />
                  </Grid>

                  {/* Employé */}
                  {titre === "Titre de Congés" && (
                    <Grid item xs={6} mt={1}>
                      <SelectInputComponent
                        label={t('common.employee')}
                        value={empcod}
                        setValue={setEmploye}
                        maplist={emp}
                      />
                    </Grid>
                  )}

                  {/* Référence */}
                  <Grid item xs={6}>
                    <InputComponent
                      label={t('common.ref')}
                      type="text"
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
                  <Grid item xs={6}>
                    <InputComponent
                      label={t('common.dateStart')}
                      type="date"
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
                  <Grid item xs={6}>
                    <InputComponent
                      label={t('common.dateEnd')}
                      type="date"
                      value={conret}
                      setValue={(val: string) => setDateReprise(val)}
                    />
                  </Grid>
                  <Grid item xs={3} mt={2} sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckboxComponent 
                      label={t('common.afternoon')} 
                      value={conamret} 
                      setValue={setApresMidiReprise} 
                    />
                  </Grid>
                  <Grid item xs={3} mt={2}>
                    <InputComponent 
                      label={t('common.nbDays')} 
                      type="number" 
                      value={connbjour} 
                      setValue={setNbJour} 
                      readOnly 
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
                      label={t('conge.address')} 
                      value={conadr} 
                      setValue={setImputationAdresse} 
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <InputComponent 
                      label={t('common.phone')} 
                      type="tel" 
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

      {/* Conditionally display Etat Conge */}
      {showEtatConge && etatCongeError && (
        <Grid width={550} position={'fixed'} zIndex={20} left={430} bottom={315} textAlign={'start'}>
          <Alert severity="error">{etatCongeError}</Alert>
        </Grid>
      )}
      
      {showEtatConge && !etatCongeError && (
        <Grid width={850} position={'sticky'} zIndex={10} left={430} mb={-8} textAlign={'start'}>
          <Collapse in={showEtatConge}>
            <Alert
              severity="info"
              variant="outlined"
              sx={{
                mt: 2,
                p: 2,
                backgroundColor: "#e3f2fd",
                borderColor: "#90caf9",
                borderRadius: 2,
                color: "#0d47a1",
              }}
            >
              <Box display={'flex'} gap={2}>
                <Typography variant="body1">
                  <strong>Droit Mensuelle:</strong> {etatConge.droitMensuelle}
                </Typography>
                <Typography variant="body1">
                  <strong>Ancienneté:</strong> {etatConge.anciennete}
                </Typography>
                <Typography variant="body1">
                  <strong>Solde Antérieur:</strong> {etatConge.soldeAnterieur}
                </Typography>
                <Typography variant="body1">
                  <strong>Nouveau Solde:</strong> {(etatConge.soldeAnterieur - connbjour).toFixed(4)}
                </Typography>
                <Typography variant="body1">
                  <strong>Droit Congé:</strong> {etatConge.droitConge}
                </Typography>
              </Box>
            </Alert>
          </Collapse>
        </Grid>
      )}

      {feedback.element}
    </Box>
  );
}
