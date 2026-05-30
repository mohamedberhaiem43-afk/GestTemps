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
  Button,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { useTranslation } from "react-i18next";
import "./SaisieIntitule.css";
import useAddAbsence from "../../../../hooks/absenceHooks/useAddAbsence";
import useGetAllAbsences from "../../../../hooks/absenceHooks/useGetAllAbsence";
import { useAbsenceContext } from "../../../helper/AbsenceContext";
import useUpdateAbsence from "../../../../hooks/absenceHooks/useUpdateAbsence";
import RadioGroupComponent, { FormControlLabelComponent } from "../../../RadioGroupComponent/RadioGroupComponent";
import ForbiddenMessage from "../../../AlertModal/ForbiddenMessage";
import { useFeedbackSnackbar, extractErrorMessage } from "../../../helper/FeedbackSnackbar";

export default function SaisieIntitule() {
  const { t } = useTranslation();
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
  // CET (Compte Épargne Temps) : alimentation depuis ce type (abspeutcet + plafond annuel)
  // et/ou prise de congé puisant dans le CET (absprendcet).
  const [peutCet, setPeutCet] = useState(false);
  const [maxCet, setMaxCet] = useState<string>("");
  const [prendCet, setPrendCet] = useState(false);
  const [mode,setMode] = useState('save');
  const feedback = useFeedbackSnackbar();
  // Erreur 403 = problème de permission → on garde le composant dédié (ForbiddenMessage)
  // qui rend une bannière intrusive avec un wording "droits". Pour toute autre erreur,
  // on utilise le snackbar partagé pour rester cohérent avec la fiche collaborateur.
  const handleError = (error: any, defaultMessage: string) => {
    if (error?.response?.status === 403) {
      setForbiddenMsg(t('common.forbidden', { defaultValue: "Vous n'avez pas la permission d'effectuer cette action." }));
    } else {
      feedback.showError(extractErrorMessage(error, defaultMessage));
    }
  };

  const{refetch} = useGetAllAbsences();
  const { mutate: addAbsence, isPending: isLoading } = useAddAbsence();
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
      abspeutcet: peutCet ? "1" : "0",
      absmaxcet: maxCet === "" ? null : Number(maxCet),
      absprendcet: prendCet ? "1" : "0",
    };
  
    if (mode === "save") {
      addAbsence(absenceData, {
        onSuccess() {
          refetch();
          feedback.showSuccess(t('intituleAbsence.addSuccess', { defaultValue: 'Absence ajoutée avec succès' }));
          resetForm();
        },
        onError(error: any) {
          handleError(error, t('intituleAbsence.addError', { defaultValue: "Erreur lors de l'ajout" }));
        },
      });
    } else if (mode === "edit") {
      editAbsence(absenceData, {
        onSuccess() {
          refetch();
          feedback.showSuccess(t('intituleAbsence.updateSuccess', { defaultValue: 'Absence modifiée avec succès' }));
          resetForm();
        },
        onError(error: any) {
          handleError(error, t('intituleAbsence.updateError', { defaultValue: 'Erreur lors de la modification' }));
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
      setPeutCet(selectedAbsence.abspeutcet === "1");
      setMaxCet(selectedAbsence.absmaxcet != null ? String(selectedAbsence.absmaxcet) : "");
      setPrendCet(selectedAbsence.absprendcet === "1");
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
    setPeutCet(false);
    setMaxCet('');
    setPrendCet(false);
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
                label={<Typography fontSize="small">{t('i18nFix.intituleAbsence.countHoliday')}</Typography>}
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

          {/* CET (Compte Épargne Temps) — alimentation depuis ce type + prise depuis le CET. */}
          <Box component="fieldset" sx={{ mt: 1 }}>
            <legend>
              <Typography color={'primary'}>{t('intituleAbsence.cet.legend', { defaultValue: 'Compte Épargne Temps (CET)' })}</Typography>
            </legend>
            <Grid container spacing={1} alignItems="center">
              <Grid item xs={5}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={peutCet}
                      onChange={(e) => setPeutCet(e.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography fontSize="small">{t('intituleAbsence.cet.canFeed', { defaultValue: 'Peut alimenter le CET' })}</Typography>}
                />
              </Grid>
              <Grid item xs={3}>
                <InputLabel shrink>{t('intituleAbsence.cet.maxPerYear', { defaultValue: 'Max jours/an' })}</InputLabel>
                <Input
                  type="number"
                  size="small"
                  value={maxCet}
                  disabled={!peutCet}
                  onChange={(e) => setMaxCet(e.target.value)}
                  inputProps={{ min: 0, step: 0.5 }}
                />
              </Grid>
              <Grid item xs={4}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={prendCet}
                      onChange={(e) => setPrendCet(e.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography fontSize="small">{t('intituleAbsence.cet.drawsFrom', { defaultValue: 'Se prend depuis le CET' })}</Typography>}
                />
              </Grid>
            </Grid>
          </Box>

        </Grid>
      </Grid>
       {/* Forbidden message */}
      {forbiddenMsg && <ForbiddenMessage message={forbiddenMsg} />}
      {feedback.element}
    </Box>
  );
}
