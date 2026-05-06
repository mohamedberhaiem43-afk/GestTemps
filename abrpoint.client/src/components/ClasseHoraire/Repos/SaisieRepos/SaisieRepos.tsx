import { Box, Grid, Button, Snackbar, Alert, Card, CardContent, Typography, CircularProgress, RadioGroup, FormControlLabel, Radio, FormControl, FormLabel } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useEffect, useState } from "react";
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from "@mui/icons-material/Refresh";
import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import InfoIcon from '@mui/icons-material/Info';
import InputComponent from "../../../Inputs/Input";
import CheckboxComponent from "../../../CheckboxComponent/CheckboxComponent";
import useAddRepos from "../../../../hooks/Repos/useAddRepos";
import useGetRepos from "../../../../hooks/Repos/useGetRepos";
import { Ferier } from "../../../../models/Ferier";
import { useFerierContext } from "../../../helper/ReposContext";
import useUpdateRepos from "../../../../hooks/Repos/useUpdateRepos";
import ForbiddenMessage from "../../../AlertModal/ForbiddenMessage";
import { useTranslation } from "react-i18next";

export default function SaisieRepos() {
  const { t } = useTranslation();
  const { selectedFerier } = useFerierContext();
  const [forbiddenMsg, setForbiddenMsg] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [mode, setMode] = useState('save');
  const [isLoading, setIsLoading] = useState(false);

  const [formState, setFormState] = useState({
    annee: '',
    ferdate: new Date().toISOString().split('T')[0],
    ferfixe: false,
    ferheure: 0,
    fermotif: '',
    fernpaye: false,
    fertype: 'F',
    fertrv: new Date().toISOString().split('T')[0],
  });

  const { mutate: editRepos } = useUpdateRepos();
  const { mutate: addRepos } = useAddRepos();
  const { refetch } = useGetRepos();

  useEffect(() => {
    if (selectedFerier) {
      setFormState({
        annee: selectedFerier.annee || '',
        ferdate: selectedFerier.ferdate ? 
          typeof selectedFerier.ferdate === 'string' ? 
            selectedFerier.ferdate.split('T')[0] : 
            selectedFerier.ferdate.toISOString().split('T')[0] : 
          new Date().toISOString().split('T')[0],
        ferfixe: selectedFerier.ferfixe === '1',
        ferheure: selectedFerier.ferheure || 0,
        fermotif: selectedFerier.fermotif || '',
        fernpaye: selectedFerier.fernpaye === '1',
        fertype: selectedFerier.fertype || 'F',
        fertrv: selectedFerier.fertrv ? 
          typeof selectedFerier.fertrv === 'string' ? 
            selectedFerier.fertrv.split('T')[0] : 
            selectedFerier.fertrv.toISOString().split('T')[0] : 
          new Date().toISOString().split('T')[0],
      });
      setMode('edit');
    }
  }, [selectedFerier]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    const { annee, ferdate, fermotif, fertrv, ferheure } = formState;
    if (!annee || !fermotif || !fertrv || !ferdate || !ferheure) {
      setSnackbarMessage('Veuillez remplir tous les champs obligatoires');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      setIsLoading(false);
      return;
    }

    const formData: Ferier = {
      soccod: sessionStorage.getItem('soccod') || '',
      ...formState,
      ferfixe: formState.ferfixe ? '1' : '0',
      fernpaye: formState.fernpaye ? '1' : '0',
      ferheure: parseFloat(formState.ferheure.toString()),
      ferdate: new Date(formState.ferdate),
      fertrv: new Date(formState.fertrv),
    };

    const onSuccess = (message: string) => {
      setSnackbarMessage(message);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      resetForm();
      setIsLoading(false);
    };

    const onError = (defaultMessage: string, error: any) => {
      setIsLoading(false);
      if (error?.response?.status === 403) {
        setForbiddenMsg("Vous n'avez pas la permission d'effectuer cette action.");
      } else {
        setSnackbarMessage(defaultMessage);
        setSnackbarSeverity("error");
        setSnackbarOpen(true);
      }
    };

    if (mode === 'save') {
      addRepos(formData, {
        onSuccess: () => onSuccess('Données enregistrées avec succès!'),
        onError: (error) => onError("Erreur lors de l'enregistrement des données", error),
      });
    } else if (mode === 'edit') {
      editRepos({ ferier: formData }, {
        onSuccess: () => onSuccess('Jour de repos modifié avec succès!'),
        onError: (error) => onError("Erreur lors de modification des données", error),
      });
    }
  };

  const resetForm = () => {
    setFormState({
      annee: '',
      ferdate: new Date().toISOString().split('T')[0],
      ferfixe: false,
      ferheure: 0,
      fermotif: '',
      fernpaye: false,
      fertype: 'F',
      fertrv: new Date().toISOString().split('T')[0],
    });
    setMode('save');
    refetch();
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
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
                    <Grid item xs={3}>
                      <InputComponent
                        type="number"
                        label="Année"
                        value={formState.annee}
                        setValue={(value) => setFormState({ ...formState, annee: value })}
                      />
                    </Grid>
                    <Grid item xs={8}>
                      <InputComponent
                        type="text"
                        label="Motif"
                        value={formState.fermotif}
                        setValue={(value) => setFormState({ ...formState, fermotif: value })}
                      />
                    </Grid>
                    <Grid item xs={3} mt={1}>
                      <CheckboxComponent
                        label="Fixe (Annuel)"
                        value={formState.ferfixe}
                        setValue={(value) => setFormState({ ...formState, ferfixe: value })}
                      />
                    </Grid>
                    <Grid item xs={3} mt={1}>
                      <CheckboxComponent
                        label="Non Payé"
                        value={formState.fernpaye}
                        setValue={(value) => setFormState({ ...formState, fernpaye: value })}
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
                      <InputComponent
                        type="date"
                        label="Date"
                        value={formState.ferdate}
                        setValue={(value) => setFormState({ ...formState, ferdate: value })}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <InputComponent
                        type="date"
                        label="Date Retour"
                        value={formState.fertrv}
                        setValue={(value) => setFormState({ ...formState, fertrv: value })}
                      />
                    </Grid>
                    <Grid item xs={3}>
                      <InputComponent
                        type="number"
                        label="Heures"
                        value={formState.ferheure}
                        setValue={(value) => setFormState({ ...formState, ferheure: value })}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Grid>

              {/* Section 3: Type */}
              <Grid item xs={4}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#666', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfoIcon fontSize="small" /> Type
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <FormControl component="fieldset" fullWidth>
                        <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1 }}>
                          Type de jour
                        </FormLabel>
                        <RadioGroup
                          value={formState.fertype}
                          onChange={(e) => setFormState({ ...formState, fertype: e.target.value })}
                        >
                          <FormControlLabel
                            value="F"
                            control={<Radio size="small" />}
                            label={<Typography fontSize="small">{t('i18nFix.repos.holiday')}</Typography>}
                          />
                          <FormControlLabel
                            value="R"
                            control={<Radio size="small" />}
                            label={<Typography fontSize="small">Repos</Typography>}
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

        {/* Forbidden message */}
        {forbiddenMsg && <ForbiddenMessage message={forbiddenMsg} />}

        {/* Snackbar for notifications */}
        <Snackbar open={snackbarOpen} autoHideDuration={1500} onClose={handleCloseSnackbar}>
          <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
}