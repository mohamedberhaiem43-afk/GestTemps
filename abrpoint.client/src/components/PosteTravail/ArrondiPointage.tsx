  import { Box, Grid } from "@mui/material";
import InputComponent from "../Inputs/Input";
import { useState } from "react";
interface ArrondiPointageProps {
    arrondi?: number;
    arrhsup?: number;
    arrhsortie?: number;
    arrhentree?: number;
    arrhsmajore?: number;
    arrhemajore?: number;
}
const ArrondiPointage: React.FC<ArrondiPointageProps> = ({
    arrondi,
    arrhsup,
    arrhsortie,
    arrhentree,
    arrhsmajore,
    arrhemajore
}) =>{
  const [arrondiPointage, setArrondiPointage] = useState(arrondi || "");
  const [arrondiHeuresSup, setArrondiHeuresSup] = useState(arrhsup || "");
  const [arrondiHeureEntree, setArrondiHeureEntree] = useState(arrhentree || "");
  const [majEntree, setMajEntree] = useState(arrhemajore || "");
  const [arrondiHeureSortie, setArrondiHeureSortie] = useState(arrhsortie || "");
  const [majSortie, setMajSortie] = useState(arrhsmajore || "");

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <InputComponent
            type="text" 
            label="Arrondi de pointage"
            value={arrondiPointage}
            setValue={setArrondiPointage}
          />
        </Grid>
        <Grid item xs={6}>
          <InputComponent
            type="text"
            label="Arrondi Heures Sup."
            value={arrondiHeuresSup}
            setValue={setArrondiHeuresSup}
          />
        </Grid>

        <Grid item xs={7}>
          <InputComponent
            type="text"
            label="Arrondi chaque Heure d'entrée"
            value={arrondiHeureEntree}
            setValue={setArrondiHeureEntree}
          />
        </Grid>
        <Grid item xs={5}>
          <InputComponent
            type="text"
            label="Majorée à partir de"
            value={majEntree}
            setValue={setMajEntree}
          />
        </Grid>

        <Grid item xs={7}>
          <InputComponent
            type="text"
            label="Arrondi chaque Heure de sortie"
            value={arrondiHeureSortie}
            setValue={setArrondiHeureSortie}
          />
        </Grid>
        <Grid item xs={5}>
          <InputComponent
            type="text"
            label="Majorée à partir de"
            value={majSortie}
            setValue={setMajSortie}
          />
        </Grid>
      </Grid>
    </Box>
  );
}

export default ArrondiPointage;