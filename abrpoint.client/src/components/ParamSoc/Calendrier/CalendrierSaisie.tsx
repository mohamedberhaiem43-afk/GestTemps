import { Box, Container, Grid } from "@mui/material";
import InputComponent from "../../Inputs/Input";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import { useState } from "react";
import CheckboxComponent from "../../CheckboxComponent/CheckboxComponent";
import { t } from "i18next";

const joursSemaine = {
  lundi: "Lundi",
  mardi: "Mardi",
  mercredi: "Mercredi",
  jeudi: "Jeudi",
  vendredi: "Vendredi",
  samedi: "Samedi",
  dimanche: "Dimanche",
  "Sam-Dim": "Sam-Dim",
};

function CalendrierSaisie() {
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
            <InputComponent type="number" label="Tous les jours" value={tousLesJours} setValue={setTousLesJours} />
            <CheckboxComponent label="Tous les mois" value={tousLesMois} setValue={setTousLesMois} />
          </Grid>
          <Grid item xs={1} sm={6}>
            <InputComponent type="number" label="Samedi" value={samedi} setValue={setSamedi} />
          </Grid>
          <Grid item xs={1} sm={4}>
            <InputComponent type="number" label="Nb.Hre/Jour" value={nbHreJour} setValue={setNbHreJour} />
          </Grid>
          <Grid item xs={1.5} sm={4}>
            <InputComponent type="number" label="Nb.Jour/Mois" value={nbJourMois} setValue={setNbJourMois} />
          </Grid>
          <Grid item xs={1.5} sm={4}>
            <InputComponent type="number" label="Nb.Hre/Mois" value={nbHreMois} setValue={setNbHreMois} />
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
