import { Box, Grid, IconButton, Snackbar, Alert, Button } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useEffect, useState } from "react";
import InputComponent from "../../../Inputs/Input";
import RadioGroupComponent, { FormControlLabelComponent } from "../../../RadioGroupComponent/RadioGroupComponent";
import CheckboxComponent from "../../../CheckboxComponent/CheckboxComponent";
import SaveIcon from "@mui/icons-material/Save";
import useAddRepos from "../../../../hooks/Repos/useAddRepos";
import useGetRepos from "../../../../hooks/Repos/useGetRepos";
import { Ferier } from "../../../../models/Ferier";
import { useFerierContext } from "../../../helper/ReposContext";
import useUpdateRepos from "../../../../hooks/Repos/useUpdateRepos";
import ForbiddenMessage from "../../../AlertModal/ForbiddenMessage";

export default function SaisieRepos() {
  const {selectedFerier} = useFerierContext();
  const [forbiddenMsg, setForbiddenMsg] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [mode,setMode] = useState('save');

  const [formState, setFormState] = useState({
      annee: '',
      ferdate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      ferfixe: false,
      ferheure: 0,
      fermotif: '',
      fernpaye: false,
      fertype: '0',
      fertrv: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
  });

  const { mutate: editRepos } = useUpdateRepos();
  const { mutate: addRepos, isLoading } = useAddRepos();
  const { refetch } = useGetRepos();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const { annee, ferdate, fermotif, fertrv, ferheure } = formState;
    if (!annee || !fermotif || !fertrv||!ferdate || !ferheure) {
      setSnackbarMessage('Veuillez remplir tous les champs obligatoires');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    const formData: Ferier = {
      soccod: sessionStorage.getItem('soccod') || '',
      ...formState,
      ferfixe: formState.ferfixe ? '1' : '0',
      fernpaye: formState.fernpaye ? '1' : '0',
      ferheure: parseFloat(formState.ferheure.toString()),
      ferdate: new Date(formState.ferdate), // Convert string to Date
      fertrv: new Date(formState.fertrv), // Convert string to Date
    };

    const onSuccess = (message: string) => {
      setSnackbarMessage(message);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      refetch();
      resetForm();
    };

    const onError = (defaultMessage: string, error: any) => {
      if (error?.response?.status === 403) {
        setForbiddenMsg("Vous n’avez pas la permission d’effectuer cette action.");
      } else {
        setSnackbarMessage(defaultMessage);
        setSnackbarSeverity("error");
        setSnackbarOpen(true);
      }
    };


    if (mode === 'save') {

      addRepos(formData, {
        onSuccess: () => onSuccess('Données enregistrées avec succès!'),
        onError: (error) => onError("Erreur lors de l'enregistrement des données",error),
      });
    } else if (mode === 'edit') {
      editRepos(formData, {
        onSuccess: () => onSuccess('Jour de repos modifié avec succès!'),
        onError: (error) => onError("Erreur lors de modification des données",error),
      });
    }
  };

  const resetForm = () => {
    setFormState({
      annee: '',
      ferdate: '',
      ferfixe: false,
      ferheure: 0,
      fermotif: '',
      fernpaye: false,
      fertype: '0',
      fertrv: '',
    });
    setMode('save');
  };
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
            fertype: selectedFerier.fertype || '0',
            fertrv: selectedFerier.fertrv ? 
                typeof selectedFerier.fertrv === 'string' ? 
                    selectedFerier.fertrv.split('T')[0] : 
                    selectedFerier.fertrv.toISOString().split('T')[0] : 
                new Date().toISOString().split('T')[0],
        });
        setMode('edit');
    }
}, [selectedFerier]);
  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box
          className="saisie-horaire-container"
          component="form"
          sx={{ mx: 'auto'}}
          onSubmit={handleSubmit}
        >
          <Grid container spacing={1} alignItems="center" direction="row">
            <Grid  item xs={12}>
              <Grid container spacing={2} alignItems="center" direction="row">
                <Grid item xs={1}>
                <InputComponent
                  type="number"
                  label="Année"
                  value={formState.annee}
                  setValue={(value) => setFormState({ ...formState, annee: value })}
                />
                </Grid>

                <Grid item xs={1.5} mt={3}>
                <CheckboxComponent
                  label="Fixe (Annuel)"
                  value={formState.ferfixe}
                  setValue={(value) => setFormState({ ...formState, ferfixe: value })}
                />
                </Grid>

                <Grid item xs={1.5}>
                  <InputComponent type="date" label="Date" value={formState.ferdate} setValue={(value) => setFormState({ ...formState, ferdate: value })} />
                </Grid>
                <Grid item xs={2}>
                  <InputComponent type="text" label="Motif" value={formState.fermotif} setValue={(value) => setFormState({ ...formState, fermotif: value })} />
                </Grid>

                <Grid item xs={2} mt={3.5}>
                  <RadioGroupComponent value={formState.fertype} setValue={(value) => setFormState({ ...formState, fertype: value })}>
                    <FormControlLabelComponent radioValue="F" label="Férié" />
                    <FormControlLabelComponent radioValue="R" label="Repos" />
                  </RadioGroupComponent>
                </Grid>
                <Grid item xs={1}>
                  <InputComponent type="number" label="Heure" value={formState.ferheure} setValue={(value) => setFormState({ ...formState, ferheure: value })} />
                </Grid>
                <Grid item mt={3}>
                  <CheckboxComponent label="Non Payé" value={formState.fernpaye} setValue={(value) => setFormState({ ...formState, fernpaye: value })} />
                </Grid>
                <Grid item xs={1.5}>
                  <InputComponent type="date" label="Date Retour" value={formState.fertrv} setValue={(value) => setFormState({ ...formState, fertrv: value })} />
                </Grid>
                <Grid item xs={2} display={'flex'} justifyContent={'space-around'}>
                  <IconButton color="primary" aria-label="save" type="submit" disabled={isLoading}>
                    <SaveIcon />
                  </IconButton>
                  <Button onClick={resetForm} color='secondary'>Nouveau</Button>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
          {/* Forbidden message */}
          {forbiddenMsg && <ForbiddenMessage message={forbiddenMsg} />}
          {/* Snackbar for notifications */}
          <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleCloseSnackbar}>
            <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
              {snackbarMessage}
            </Alert>
          </Snackbar>
        </Box>
    </LocalizationProvider>
  );
}
