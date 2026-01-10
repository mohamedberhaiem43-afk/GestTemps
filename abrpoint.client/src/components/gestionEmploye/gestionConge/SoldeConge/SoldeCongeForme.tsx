import { useEffect, useState } from 'react';
import { Grid, Box, IconButton, Snackbar, Alert, Button } from '@mui/material';
import SaveIcon from "@mui/icons-material/Save";
import { Solde } from '../../../../models/Solde';
import InputComponent from '../../../Inputs/Input';
import SelectInputComponent from '../../../SelectInputComponent/SelectInputComponent';
import useGetEmployee from '../../../../hooks/employeHooks/useGetEmployee';
import useAddSolde from '../../../../hooks/soldeCongeHooks/useAddSolde';
import useGetSolde from '../../../../hooks/soldeCongeHooks/useGetSolde';
import { useSoldeContext } from '../../../helper/SoldeContext';
import useUpdateSolde from '../../../../hooks/soldeCongeHooks/useUpdateSolde';
import BreadcrumbNavigation from '../../../helper/BreadcrumbNavigation';



const SoldeForm = () => {
  const { selectedSolde } = useSoldeContext();

  const [solde, setSolde] = useState<Solde>({
    empcod: '',
    soccod: sessionStorage.getItem('soccod') || '',
    annee: '',
    conge: 0,
    empconge: 0,
  });

  const { data: employeOptions = [] } = useGetEmployee();
  const addSoldeMutation = useAddSolde();
  const {mutate:updateSolde} = useUpdateSolde();
  const {refetch} = useGetSolde();
  // Snackbar states
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'success' | 'error'>('success');
  const [mode,setMode] = useState('save');
  const handleInputChange = (name: string, value: string | number) => {
    setSolde((prev) => ({ ...prev, [name]: value }));
  };
 
  useEffect(() => {
    if (selectedSolde) {
      setMode('edit');
      setSolde((prev) => ({
        ...prev, // Retain the existing form values
        empcod: selectedSolde.empcod || prev.empcod,
        soccod: sessionStorage.getItem('soccod') || selectedSolde.soccod || prev.soccod,
        annee: selectedSolde.annee ? selectedSolde.annee.toString() : prev.annee,
        conge: selectedSolde.conge !== undefined ? Number(selectedSolde.conge) : prev.conge,
        empconge: selectedSolde.empconge !== undefined ? Number(selectedSolde.empconge) : prev.empconge,
      }));
    }
  }, [selectedSolde]);
  
  

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if(mode === 'save'){
      addSoldeMutation.mutate(
        { solde },
        {
          onSuccess: () => {
            handleSnackbarOpening("Solde ajouté avec succès !",'success');
            refetch();
          },
          onError: () => {
            handleSnackbarOpening("Erreur lors de l'ajout du solde.",'error');
            setIsSnackbarOpen(true);
          },
        }
      );
    }
    else if (mode === 'edit'){
      updateSolde(solde,{
        onSuccess: () => {
          handleSnackbarOpening("Solde modifié avec succées",'success');
          refetch();
        },
        onError: () => {
          handleSnackbarOpening("Erreur lors de modification du solde.",'error');
        }
      })
    }
  };

  const handleSnackbarOpening = (message:string,severity:'success'|'error') => {
    setMessage(message);
    setSeverity(severity);
    setIsSnackbarOpen(true);
  };
  const handleSnackbarClose = () => {
    setIsSnackbarOpen(false);
  };

  const resetForm = () => {
    setSolde({
      empcod: '',
      soccod: sessionStorage.getItem('soccod') || '',
      annee: '',
      conge: 0,
      empconge: 0,
    });
    setMode('save');
  };
  

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mb: 2 }} width={'90vw'}>
      <BreadcrumbNavigation />
      <Grid container spacing={4}>
        <Grid item xs={3} sm={6} md={2}>
          <SelectInputComponent
            label="Employé"
            value={solde.empcod}
            setValue={(val: any) => handleInputChange('empcod', val)}
            maplist={employeOptions}
          />
        </Grid>

        <Grid item xs={2} sm={6} md={2}>
          <InputComponent
          
            type="number"
            label="Année"
            value={solde.annee || ''}
            setValue={(val: any) => handleInputChange('annee', val)}
          />
        </Grid>

        <Grid item xs={2} sm={6} md={2}>
          <InputComponent
            type="number"
            label="Solde"
            value={solde.conge}
            setValue={(val: any) => handleInputChange('Conge', parseInt(val))}
          />
        </Grid>

        <Grid item xs={2.5} sm={6} md={2.5}>
          <InputComponent
            type="number"
            label="Droit de congé"
            value={solde.empconge}
            setValue={(val: any) => handleInputChange('empconge', parseInt(val))}
          />
        </Grid>

        <Grid item xs={3} display={'flex'} justifyContent={'space-around'}>
          <IconButton color="primary" aria-label="save" type="submit">
            <SaveIcon />
          </IconButton>
          <Button onClick={resetForm} color='secondary'>Nouveau</Button>
        </Grid>
      </Grid>

      {/* Snackbar */}
      <Snackbar open={isSnackbarOpen} autoHideDuration={6000} onClose={handleSnackbarClose}>
        <Alert onClose={handleSnackbarClose} severity={severity}>
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SoldeForm;
