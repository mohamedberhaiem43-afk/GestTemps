import { useEffect, useState } from 'react';
import {  Grid, TextField, Button, Snackbar, Alert, Box } from '@mui/material';
import './GestionContrats.css';
import axios from 'axios';
import SaveIcon from "@mui/icons-material/Save";
import SelectInputComponent from '../../SelectInputComponent/SelectInputComponent';
import InputComponent from '../../Inputs/Input';
import useGetEmployee from '../../../hooks/employeHooks/useGetEmployee';
import { useAuth } from '../../helper/AuthProvider';
import ForbiddenMessage from '../../AlertModal/ForbiddenMessage';
import getDatePart from '../../helper/TimeConverter/ExtractDateOnly';
import useUpdateContrat from '../../../hooks/contratHooks/useUpdateContrat';
import formatDate from '../../helper/formatDate';

interface SaisieContratProps {
  editingContract?: any;
  setEditingContract?: (contract: any) => void;
}

const SaisieContrat = ({ editingContract, setEditingContract }: SaisieContratProps) => {
  const contratTypes = {
    "0": "CDD",
    "1": "CDI",
    "2": "Ouvrier",
    "3": "CIVP"
};

  const token = localStorage.getItem("authToken");
  const { soccod } = useAuth();
  const sitcod = sessionStorage.getItem("sitcod");
  const headers = { Authorization: `Bearer ${token}` };
  const [isForbidden, setIsForbidden] = useState(false);
  const [numOrdre, setNumOrdre] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [jours, setJours] = useState('');
  const [mois, setMois] = useState('0');
  const [dateContrat, setDateContrat] = useState('');
  const [observations, setObservations] = useState('');
  const [typeContrat, setTypeContrat] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'error'|'success'>('success');
  const {data:employees = []} = useGetEmployee();
  const updateContrat = useUpdateContrat();

    // Load contract data when editing
  useEffect(() => {
    if (editingContract) {
      setNumOrdre(editingContract.concod || '');
      setSelectedEmployee(editingContract.empcod || '');
      setDateContrat(getDatePart(editingContract.condat));
      setTypeContrat(editingContract.contype || '');
      setDateDebut(getDatePart(editingContract.empemb));
      setDateFin(getDatePart(editingContract.empsort));
      setMois(editingContract.conmois?.toString() || '0');
      setObservations(editingContract.observations || '');
      
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [editingContract]);
  const resetForm = () => {
    setNumOrdre('');
    setDateDebut('');
    setDateFin('');
    setJours('');
    setMois('0');
    setDateContrat('');
    setObservations('');
    setTypeContrat('');
    setSelectedEmployee('');
    if (setEditingContract) setEditingContract(null);
  };
 // Helper function to calculate the difference in months
 const calculateMonths = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const yearsDiff = endDate.getFullYear() - startDate.getFullYear();
    const monthsDiff = endDate.getMonth() - startDate.getMonth();
    return yearsDiff * 12 + monthsDiff + 1;
};
  // Update 'mois' whenever dateDebut or dateFin changes
  useEffect(() => {
    if (dateDebut && dateFin) {
      const months = calculateMonths(dateDebut, dateFin);
      setMois(months.toString());
    } else {
      setMois('0');
    }
  }, [dateDebut, dateFin]);
const saveContrat = () => {
  const contrat = {
    soccod: soccod || '',
    concod: numOrdre,
    empcod: selectedEmployee,
    condat: new Date(formatDate(dateContrat)),
    contype: typeContrat.slice(0, 1),
    sitcod: sitcod || '',
    sercod: "SR01",
    empreg: "Y",
    catcod: "",
    vilcod: "",
    empadr: "",
    emppost: "",
    emptel: "",
    empemb: new Date(formatDate(dateDebut)),
    empsort: new Date(formatDate(dateFin)),
    condg: "",
    empmotif: "",
    empdcin: new Date(formatDate(dateFin)),
    empacin: "",
    quacod: "",
    empech: "",
    empelon: "",
    empcat: "",
    empscat: "",
    cnscod: "",
    empsbase: 0,
    empsbrut: 0,
    socresp: "",
    dircod: "",
    empcontrat: "",
    conmois: parseFloat(mois),
  };

  // If editing, call PUT (update), otherwise POST (create)
  if (editingContract) {
    updateContrat.mutate(contrat, {
      onSuccess: (res: any) => {
        setMessage("Contrat modifié avec succès !");
        setSeverity('success');
        setIsSnackbarOpen(true);
        if (setEditingContract) setEditingContract(null);
        resetForm();
      },
      onError: (err: any) => {
        if (err.response?.status === 403) {
          setIsForbidden(true);
          return;
        }
        const errorMessage = err.response?.data?.message || "Erreur lors de la modification du contrat";
        setMessage(errorMessage);
        setSeverity('error');
        setIsSnackbarOpen(true);
      },
    });
  } else {
    axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/Contrats`, contrat, { headers })
      .then((res) => {
        if (res.status === 200) {
          setMessage(res.data.message || "Contrat enregistré avec succès !");
          setSeverity('success');
          setIsSnackbarOpen(true);
          resetForm();
        }
      })
      .catch((err) => {
        if (err.response?.status === 403) {
          setIsForbidden(true);
          return;
        }
        const errorMessage = err.response?.data?.message || "Erreur lors de l’enregistrement du contrat";
        setMessage(errorMessage);
        setSeverity('error');
        setIsSnackbarOpen(true);
      });
  }
};

  const handleSubmit = (e: any) => {
    e.preventDefault();
    saveContrat();
  };


  
  return (
    <>
      <Box component={'form'} onSubmit={handleSubmit} ml={10}>
        <Grid container spacing={2} >
          <Grid item xs={12}>
            
              <Grid container spacing={3}>
                {/* Employee Selection */}
                <Grid item xs={2} sm={6} md={2}>
                  <SelectInputComponent label='Employé' value={selectedEmployee} setValue={setSelectedEmployee} maplist={employees} />
                </Grid>

                {/* Num Ordre */}
                <Grid item xs={1.5} sm={1.5}>
                  <InputComponent type='number' label='N° Contrat' value={numOrdre} setValue={setNumOrdre} />
                </Grid>

                {/* Date Debut */}
                <Grid item xs={1.5} sm={1.8}>
                  <InputComponent type='date' label='Date Début' value={dateDebut} setValue={setDateDebut} />
                </Grid>

                {/* Jours */}
                <Grid item xs={1} sm={1.3}>
                  <InputComponent type='number' label='Jours' value={jours} setValue={setJours} />
                </Grid>

                {/* Date Fin */}
                <Grid item xs={1.5} sm={1.8}>
                  <InputComponent type='date' label='Date Fin' value={dateFin} setValue={setDateFin} />
                </Grid>

                {/* Mois */}
                <Grid item xs={1} sm={0.7}>
                  <InputComponent type='number' label='Mois' value={mois} setValue={setMois} />
                </Grid>
              </Grid>
            {/* </Item> */}

          </Grid>
          <Grid item xs={12} display={'flex'} sx={{gap:'50px',flexWrap:'wrap'}}>
              {/* Date Contrat */}
              <Grid item xs={1.5} sm={1.5}>
                <InputComponent type='date' label='Date Contrat' value={dateContrat} setValue={setDateContrat} />
              </Grid>

              {/* Type Contrat */}
              <Grid item xs={1.5} sm={1.8}>
                <SelectInputComponent label='Type Contrat' value={typeContrat} setValue={setTypeContrat} maplist={contratTypes} />
              </Grid>

              {/* Observations */}
              <Grid item xs={4}>
                <TextField
                  size="small"
                  label="Observations"
                  fullWidth
                  multiline
                  rows={4}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                />
              </Grid>

            {/* Save Button */}
          <Grid>
            <Button
              variant="text"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={saveContrat}
            >
              {editingContract ? 'Modifier' : 'Enregistrer'}
            </Button>
            {editingContract && (
              <Button
                variant="text"
                color="secondary"
                onClick={resetForm}
                sx={{ ml: 2 }}
              >
                Annuler
              </Button>
            )}
          </Grid>

          </Grid>

        </Grid>
        {isForbidden && (
          <ForbiddenMessage message={'Vous n\'êtes pas autorisé à effectuer cette action.'} />
        )}
      </Box>
      <Snackbar open={isSnackbarOpen} autoHideDuration={6000} onClose={() => setIsSnackbarOpen(false)}>
        <Alert onClose={() => setIsSnackbarOpen(false)} severity={severity}>
            {message}
        </Alert>
      </Snackbar>
    </>
  );
}
export default SaisieContrat
