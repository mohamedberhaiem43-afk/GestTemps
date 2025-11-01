import {
  MenuItem,
  Select,
  InputLabel,
  Box,
  Grid,
} from "@mui/material";
import "./Part1_Calcul.css";
import { useEffect, useState } from "react";
import InputComponent from "../../../Inputs/Input";
import { Parametre } from "../../../../models/Parametre";

interface AffichageProps {
  parametre?: Parametre;
  onChange?: (data: Partial<Parametre>) => void;
}

const Part1_Calcul: React.FC<AffichageProps> = ({ parametre, onChange }) => {

  const [joudeb, setJouDeb] = useState(parametre?.joudeb || "");
  const [moisdeb, setMoisDeb] = useState(parametre?.moisdeb || "P");
  const [joufin, setJouFin] = useState(parametre?.joufin || "");
  const [moisfin, setMoisfin] = useState(parametre?.moisfin || "P");
  const [parjhnfixe, setParjhnfixe] = useState(parametre?.parjhnfixe || "0");
  const [parpresence, setParPresence] = useState(parametre?.parpresence || "0");
  const [pardroitnbj, setParDroitNbj] = useState(parametre?.pardroitnbj || "0");
  const [parsaisconge, setParsaisconge] = useState(parametre?.parsaisconge || "0");
// Notify parent on change
  useEffect(() => {
    if (onChange) {
      onChange({
        joudeb,
        moisdeb,
        joufin,
        moisfin,
        parjhnfixe: Number(parjhnfixe),
        parpresence: parpresence,
        pardroitnbj: Number(pardroitnbj),
        parsaisconge: Number(parsaisconge),
      });
    }
  }, [joudeb, moisdeb, joufin, moisfin, parjhnfixe, parpresence, pardroitnbj, parsaisconge]);

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={2}>
          <InputComponent
            type="number"
            label="Journée Début du mois"
            value={joudeb}
            setValue={setJouDeb}
          />
        </Grid>

        <Grid item xs={2}>
          <InputLabel shrink={true} variant="standard">Mois</InputLabel>
          <Select
            variant="standard"
            size="small"
            fullWidth
            value={moisdeb}
            onChange={(e) => setMoisDeb(e.target.value)}
          >
            <MenuItem value="P">Précédent</MenuItem>
            <MenuItem value="C">Courant</MenuItem>
          </Select>
        </Grid>

        <Grid item xs={2}>
          <InputComponent
            type="text"
            label="Diviser nb h sup Mensuel par"
            value={parjhnfixe}
            setValue={setParjhnfixe}
          />
        </Grid>

        <Grid item xs={2}>
          <InputComponent
            type="number"
            label="Journée Fin du mois"
            value={joufin}
            setValue={setJouFin}
          />
        </Grid>

        <Grid item xs={2}>
          <InputLabel shrink={true} variant="standard">Mois</InputLabel>
          <Select
            variant="standard"
            size="small"
            fullWidth
            value={moisfin}
            onChange={(e) => setMoisfin(e.target.value)}
          >
            <MenuItem value="P">Précédent</MenuItem>
            <MenuItem value="C">Courant</MenuItem>
          </Select>
        </Grid>

        <Grid item xs={2}>
          <InputComponent
            type="number"
            label="Heures de Présence calculées"
            value={joudeb}
            setValue={undefined}
          />
        </Grid>

        <Grid item xs={3}>
          <InputLabel shrink={true} variant="standard">Nombre d'heures de Présence calculé selon</InputLabel>
          <Select variant="standard" size="small"  fullWidth value={parpresence} onChange={(e)=>setParPresence(e.target.value)} >
            <MenuItem value={'0'}> Heures Travaillées</MenuItem>
            <MenuItem value={'1'}> Heures Classe-Absence</MenuItem>
            <MenuItem value={'2'}> Jours Travaillés=H/8</MenuItem>
            <MenuItem value={'3'}> Heures-Jours Travaillés</MenuItem>
          </Select>
        </Grid>

        <Grid item xs={2.5}>
          <InputComponent
            type="number"
            label="Majoration congé annuel Ancienneté"
            value={pardroitnbj}
            setValue={setParDroitNbj}
          />
        </Grid>

        <Grid item xs={2}>
          <InputLabel variant="standard">Ancienneté</InputLabel>
          <Select variant="standard" size="small" fullWidth value={10}>
            <MenuItem value={10}>5 Ans</MenuItem>
          </Select>
        </Grid>

        <Grid item xs={1}>
          <InputComponent
            type="number"
            label="Saisie Congé"
            value={parsaisconge}
            setValue={setParsaisconge}
          />
        </Grid>

        <Grid item xs={2}>
          <Box display="flex" alignItems="center" height="100%">
            <span>Jours avant ou après</span>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Part1_Calcul;
