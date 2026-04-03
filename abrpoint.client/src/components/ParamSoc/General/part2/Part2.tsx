import {
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  Grid
} from "@mui/material";
import "./Part2.css";
import React, { useEffect, useState } from "react";
import AffichageProps from "../../../../models/AffichageProps";
import InputComponent from "../../../Inputs/Input";

const Part2: React.FC<AffichageProps> = ({ parametre, onChange }) => {
  const [paie, setPaie] = useState(parametre?.paie);
  const [paiearrondi, setPaiearrondi] = useState(parametre?.paiearrondi);
  const [parhnuitspec, setParhnuitspec] = useState(parametre?.parhnuitspec);
  const [parjhnlibre, setParjhnlibre] = useState(parametre?.parjhnlibre);
  useEffect(() => {
    if (onChange) {
      onChange({
        paie,
        paiearrondi,
        parhnuitspec,
        parjhnlibre,
      });
    }
  }, [paie, paiearrondi, parhnuitspec, parjhnlibre]);

  useEffect(() => {
    setPaie(parametre?.paie);
    setPaiearrondi(parametre?.paiearrondi);
    setParhnuitspec(parametre?.parhnuitspec);
    setParjhnlibre(parametre?.parjhnlibre);
  }, [parametre]);

  return (
    <FormGroup>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <InputLabel shrink={true} id="intpaie-label">Intégration Paie</InputLabel>
          <Select
            variant="standard"
            size="small"
            labelId="intpaie-label"
            id="intpaie-select"
            fullWidth
            value={paie}
            onChange={(e) => setPaie(e.target.value)}
          >
            <MenuItem value={'1'}>Sage</MenuItem>
            <MenuItem value={'2'}>Navision</MenuItem>
            {/* <MenuItem value={'2'}>ABRPOINT</MenuItem> */}
          </Select>
        </Grid>

        <Grid item xs={6}>
          <InputLabel shrink={true} id="arrondi-label">Arrondir le cumul heures de paie</InputLabel>
          <Select
            variant="standard"
            labelId="arrondi-label"
            id="arrondi-select"
            size="small"
            fullWidth
            value={paiearrondi}
            onChange={(e) => setPaiearrondi(Number(e.target.value))}
          >
            <MenuItem value={0}>0</MenuItem>
            <MenuItem value={0.5}>0.5</MenuItem>
            <MenuItem value={1}>1</MenuItem>
          </Select>
        </Grid>

        <Grid item xs={6}>
          <InputComponent
            type={"text"}
            label={"Diviser Hre de nuit à intégrer par"}
            value={parjhnlibre}
            setValue={setParjhnlibre}
          />
        </Grid>
        <Grid item xs={6}>
          <InputComponent
            type={"text"}
            label={"Intitulé Nuit Spéciale"}
            value={parhnuitspec}
            setValue={setParhnuitspec}
          />
        </Grid>
      </Grid>
    </FormGroup>
  );
};

export default Part2;
