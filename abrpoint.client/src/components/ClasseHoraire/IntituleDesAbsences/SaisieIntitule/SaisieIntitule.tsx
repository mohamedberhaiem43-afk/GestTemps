import  { useEffect, useState } from "react";
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  Input,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Typography,
  IconButton,
  Snackbar,
  Alert,
  Button,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import "./SaisieIntitule.css";
import useAddAbsence from "../../../../hooks/absenceHooks/useAddAbsence";
import useGetAllAbsences from "../../../../hooks/absenceHooks/useGetAllAbsence";
import { useAbsenceContext } from "../../../helper/AbsenceContext";
import useUpdateAbsence from "../../../../hooks/absenceHooks/useUpdateAbsence";
import RadioGroupComponent, { FormControlLabelComponent } from "../../../RadioGroupComponent/RadioGroupComponent";
import ForbiddenMessage from "../../../AlertModal/ForbiddenMessage";

export default function SaisieIntitule() {
  const [forbiddenMsg, setForbiddenMsg] = useState<string | null>(null);
  const { selectedAbsence } = useAbsenceContext(); // Get the selected absence from the context
  const [codeClasseHoraire, setCodeClasseHoraire] = useState("");
  const [libelle, setLibelle] = useState("");
  const [periode, setPeriode] = useState("");
  const [typeImputation] = useState("");
  const [isPayer, setIsPayer] = useState(false);
  const [isJourRepos, setIsJourRepos] = useState(false);
  const [unite, setUnite] = useState("");
  const [isFerier, setIsFerier] = useState(false);
  const [abssanc, setAbssanc] = useState("S");
  const [autoriser, setAutoriser] = useState(false);
  const [abscng, setAbscng] = useState("");
  const [mode,setMode] = useState('save');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as 'success' | 'error',
  });
  const handleError = (error: any, defaultMessage: string) => {
  if (error?.response?.status === 403) {
    setForbiddenMsg("Vous n’avez pas la permission d’effectuer cette action.");
  } else {
    setSnackbar({
      open: true,
      message: `${defaultMessage}: ${error.message}`,
      severity: "error",
    });
  }
};

  const{refetch} = useGetAllAbsences();
  const { mutate: addAbsence, isLoading } = useAddAbsence();
  const { mutate: editAbsence } = useUpdateAbsence();
  const saveAbsence = async () => {
    const absenceData = {
      soccod: sessionStorage.getItem("soccod"),
      abscod: codeClasseHoraire,
      abslib: libelle,
      abspar: periode,
      absunite: unite,
      abscng: abscng,
      absferier: isFerier ? "O" : "N",
      abssanc: abssanc,
      absrepos: isJourRepos ? "1" : "0",
      abspayer: isPayer ? "O" : "N",
      absaut: autoriser ? 1 : 0,
      rubcod: typeImputation,
    };
  
    if (mode === "save") {
      addAbsence(absenceData, {
        onSuccess() {
          refetch();
          setSnackbar({
            open: true,
            message: "Absence ajoutée avec succès!",
            severity: "success",
          });
          resetForm();
        },
        onError(error: any) {
          handleError(error, "Erreur lors de l'ajout");
        },
      });
    } else if (mode === "edit") {
      editAbsence(absenceData, {
        onSuccess() {
          refetch();
          setSnackbar({
            open: true,
            message: "Absence modifiée avec succès!",
            severity: "success",
          });
          resetForm();
        },
        onError(error: any) {
          handleError(error, "Erreur lors de la modification");
        },
      });
  }

  };
  
  

  // Set the form fields if there's a selected absence
  useEffect(() => {
    if (selectedAbsence) {
      setCodeClasseHoraire(selectedAbsence?.abscod);
      setLibelle(selectedAbsence.abslib);
      setPeriode(selectedAbsence.abspar);
      setUnite(selectedAbsence.absunite);
      setAbssanc(selectedAbsence.abssanc);
      setAutoriser(selectedAbsence.absaut === 1);
      setIsJourRepos(selectedAbsence.absrepos === "1");
      setIsPayer(selectedAbsence.abspayer === "O");
      setIsFerier(selectedAbsence.absferier === "O");
      setAbscng(selectedAbsence.abscng);
      setMode('edit');
    }
    
  }, [selectedAbsence]); // Only run this effect when the selected absence changes

  

  const resetForm = () => {
    setCodeClasseHoraire('');
    setLibelle('');
    setPeriode('');
    setUnite('');
    setAbssanc('');
    setAutoriser(false);
    setIsJourRepos(false);
    setIsPayer(false);
    setIsFerier(false);
    setAbscng('0');
    setMode('save');
  };

  return (
    <Box
    component="form"
    >
      <Grid container  alignItems="center" direction="row">
        {/* First box: Inputs */}
        <Grid item xs={5} mt={-5}>
          <Grid container spacing={2} alignItems="center" direction="row">
            <Grid item xs={2}>
              <InputLabel shrink>Code</InputLabel>
              <Input
                required
                size="small"
                value={codeClasseHoraire}
                onChange={(e) => setCodeClasseHoraire(e.target.value)}
              />
            </Grid>
            <Grid item xs={3}>
              <InputLabel shrink>Absence</InputLabel>
              <Input
                size="small"
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
              />
            </Grid>
            <Grid item xs={2.5}>
              <FormControl variant="standard" fullWidth>
                <InputLabel shrink id="employe-label">
                  Par
                </InputLabel>
                <Select
                  size="small"
                  label="par"
                  value={periode}
                  onChange={(e) => setPeriode(e.target.value)}
                >
                  <MenuItem value="A">Année</MenuItem>
                  <MenuItem value="M">Mois</MenuItem>
                  <MenuItem value="S">Semestre</MenuItem>
                  <MenuItem value="T">Trimestre</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={2}>
              <FormControl variant="standard" fullWidth>
                <InputLabel shrink id="employe-label">
                  Unité
                </InputLabel>
                <Select
                  size="small"
                  label="Unité"
                  value={unite}
                  onChange={(e) => setUnite(e.target.value)}
                >
                  <MenuItem value="H">Heure</MenuItem>
                  <MenuItem value="J">Jour</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={10}>
              <FormControl component="fieldset">
                <RadioGroup
                  row
                  value={abssanc}
                  onChange={(e) => setAbssanc(e.target.value)}
                >
                  <FormControlLabel
                    value="N"
                    control={<Radio size="small" />}
                    label={<Typography fontSize="small">Justification</Typography>}
                  />
                  <FormControlLabel
                    value="O"
                    control={<Radio size="small" />}
                    label={<Typography fontSize="small">Sanction</Typography>}
                  />
                  <FormControlLabel
                    value="C"
                    control={<Radio size="small" />}
                    label={<Typography fontSize="small">Compensation</Typography>}
                  />
                  <FormControlLabel
                    value="F"
                    control={<Radio size="small" />}
                    label={<Typography fontSize="small">Fin Travail</Typography>}
                  />
                </RadioGroup>
              </FormControl>
            </Grid>
            <Grid item xs={2.2}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={autoriser}
                    onChange={(e) => setAutoriser(e.target.checked)}
                    size="small"
                  />
                }
                label={<Typography fontSize="small">Autoriser</Typography>}
              />
            </Grid>
            <Grid item xs={4.3}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isJourRepos}
                    onChange={(e) => setIsJourRepos(e.target.checked)}
                    size="small"
                  />
                }
                label={<Typography fontSize="small">Compter Jour Repos</Typography>}
              />
            </Grid>
            <Grid item xs={2}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isPayer}
                    onChange={(e) => setIsPayer(e.target.checked)}
                    size="small"
                  />
                }
                label={<Typography fontSize="small">Payer</Typography>}
              />
            </Grid>
            <Grid item xs={3.5}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isFerier}
                    onChange={(e) => setIsFerier(e.target.checked)}
                    size="small"
                  />
                }
                label={<Typography fontSize="small">Compter Férier</Typography>}
              />
            </Grid>
          </Grid>
          <Grid item xs={10} display={'flex'} justifyContent={'space-around'}>
          <IconButton color="primary" onClick={saveAbsence} disabled={isLoading}>
            <SaveIcon />
          </IconButton>
          <Button color="secondary" variant="text" onClick={resetForm}>Nouveau</Button>
          </Grid>
        </Grid>

        {/* Second box: Type Imputation */}
        <Grid  item xs={7} mt={-2}>
          <Box component="fieldset" sx={{ height: "50%" }}>
            <legend>
              <Typography color={'error'}>Type Imputation</Typography>
            </legend>
            <Grid spacing={0.5} className="intitule-radio-btns" container>
            <Grid spacing={0.5} className="intitule-radio-btns" container>
            <Grid item xs={12}>
              <RadioGroupComponent value={abscng} setValue={setAbscng}>
                  <Grid item xs={2}>
                    <FormControlLabelComponent radioValue="0" label="Congé Payé (CP)" />
                  </Grid>
                  <Grid item xs={3}>
                    <FormControlLabelComponent radioValue="8" label="Accident de Travail (AT)" />
                  </Grid>
                  <Grid item xs={3}>
                    <FormControlLabelComponent radioValue="1" label="Congé Spécial Familial (CSF)" />
                  </Grid>
                  <Grid item xs={3}>
                    <FormControlLabelComponent radioValue="2" label="Absence Justifiée (AJ)" />
                  </Grid>
                  <Grid item xs={2.7}>
                    <FormControlLabelComponent radioValue="6" label="Formation + Mission (FM)" />
                  </Grid>
                  <Grid item xs={3}>
                    <FormControlLabelComponent radioValue="A" label="Arrêt Technique (CT)" />
                  </Grid>
                  <Grid item xs={3}>
                    <FormControlLabelComponent radioValue="C" label="Complément Jour/Forfait (C)" />
                  </Grid>
                  <Grid item xs={3}>
                    <FormControlLabelComponent radioValue="M" label="Absence Maternité (M)" />
                  </Grid>
                  <Grid item xs={3}>
                    <FormControlLabelComponent radioValue="3" label="Absence non Justifiée (ANJ)" />
                  </Grid>
                  <Grid item xs={3}>
                    <FormControlLabelComponent radioValue="4" label="Absence de Sanction (MAP)" />
                  </Grid>
                  <Grid item xs={3}>
                    <FormControlLabelComponent radioValue="B" label="Autorisation de Sortie (AS)" />
                  </Grid>
                  <Grid item xs={2.5}>
                    <FormControlLabelComponent radioValue="5" label="Congé sans Solde (CSS)" />
                  </Grid>
                  <Grid item xs={1.5}>
                    <FormControlLabelComponent radioValue="7" label="Blame (B)" />
                  </Grid>
                  <Grid item xs={2}>
                    <FormControlLabelComponent radioValue="V" label="Avertissement (V)" />
                  </Grid>
              </RadioGroupComponent>

            </Grid>
            </Grid>
            </Grid>
          </Box>
          
        </Grid> 
      </Grid>
       {/* Forbidden message */}
      {forbiddenMsg && <ForbiddenMessage message={forbiddenMsg} />}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
