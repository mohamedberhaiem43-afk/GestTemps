import { Box, Container, Grid } from "@mui/material";
import InputComponent from "../../Inputs/Input";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import { useMemo, useState } from "react";
import CheckboxComponent from "../../CheckboxComponent/CheckboxComponent";
import { useTranslation } from "react-i18next";

function CalendrierSaisie() {
  const { t } = useTranslation();
  const joursSemaine = useMemo(() => ({
    lundi: t('paramSoc.calendrier.days.lundi'),
    mardi: t('paramSoc.calendrier.days.mardi'),
    mercredi: t('paramSoc.calendrier.days.mercredi'),
    jeudi: t('paramSoc.calendrier.days.jeudi'),
    vendredi: t('paramSoc.calendrier.days.vendredi'),
    samedi: t('paramSoc.calendrier.days.samedi'),
    dimanche: t('paramSoc.calendrier.days.dimanche'),
    "Sam-Dim": t('paramSoc.calendrier.days.samDim'),
  }), [t]);
  const [jourRepos, setJourRepos] = useState("");
  const [tousLesJours, setTousLesJours] = useState(8);
  const [samedi, setSamedi] = useState(4);
  const [nbHreJour, setNbHreJour] = useState(8);
  const [nbJourMois, setNbJourMois] = useState(20);
  const [nbHreMois, setNbHreMois] = useState(nbHreJour * nbJourMois);
  const [tousLesMois, setTousLesMois] = useState(false);

  return (
    <Container>
      <Box >
        <Grid container spacing={2}>
          <Grid item xs={1.5} sm={6}>
            <InputComponent type="number" label={t('paramSoc.calendrier.saisie.tousLesJours')} value={tousLesJours} setValue={setTousLesJours} />
            <CheckboxComponent label={t('paramSoc.calendrier.saisie.tousLesMois')} value={tousLesMois} setValue={setTousLesMois} />
          </Grid>
          <Grid item xs={1} sm={6}>
            <InputComponent type="number" label={t('paramSoc.calendrier.saisie.samedi')} value={samedi} setValue={setSamedi} />
          </Grid>
          <Grid item xs={1} sm={4}>
            <InputComponent type="number" label={t('paramSoc.calendrier.saisie.nbHreJour')} value={nbHreJour} setValue={setNbHreJour} />
          </Grid>
          <Grid item xs={1.5} sm={4}>
            <InputComponent type="number" label={t('paramSoc.calendrier.saisie.nbJourMois')} value={nbJourMois} setValue={setNbJourMois} />
          </Grid>
          <Grid item xs={1.5} sm={4}>
            <InputComponent type="number" label={t('paramSoc.calendrier.saisie.nbHreMois')} value={nbHreMois} setValue={setNbHreMois} />
          </Grid>
          <Grid item xs={1.5}>
            <SelectInputComponent label={t('common.restDay')} value={jourRepos} setValue={setJourRepos} maplist={joursSemaine} />
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}

export default CalendrierSaisie;
