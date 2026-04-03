import { Grid, Select, MenuItem, InputLabel, Box } from "@mui/material";
import './Part1_ConnPoint.css';
import { Parametre } from "../../../../models/Parametre";
import { useEffect, useState } from "react";
import InputComponent from "../../../Inputs/Input";

interface AffichageProps {
  parametre?: Parametre;
  onChange?: (data: Partial<Parametre>) => void;
}

const Part1_ConnPoint: React.FC<AffichageProps> = ({ parametre, onChange }) => {
  const [ncom, setNcom] = useState(parametre?.ncom || '');
  const [vitesse, setVitesse] = useState(parametre?.vitesse || 0);
  const [parecart, setParecart] = useState(parametre?.parecart || 0);
  //const [methode, setMethode] = useState(0);
  useEffect(()=>{
    if (onChange) {
        onChange({
          ncom,
          vitesse,
          parecart,
          //methode,
        });
      }

  },[ncom, vitesse, parecart, onChange]);

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={2}>
        {/* N° Com */}
        <Grid item xs={6}>
          <InputLabel shrink={true} id="ncom-label">N° Com</InputLabel>
          <Select
            size="small"
            labelId="ncom-label"
            id="ncom-select"
            fullWidth
            value={ncom}
            onChange={(e) => setNcom(e.target.value)}
          >
            {['T', 'K', 'Z', 'D', 'H', 'N', 'E', 'B', '1', '2', '3'].map((val) => (
              <MenuItem key={val} value={val}>{val}</MenuItem>
            ))}
          </Select>
        </Grid>

        {/* Nb. Pointeuse */}
        <Grid item xs={6}>
          <InputLabel shrink={true} id="vitesse-label">Nb. Pointeuse</InputLabel>
          <Select
            size="small"
            labelId="vitesse-label"
            id="vitesse-select"
            fullWidth
            value={vitesse}
            onChange={(e) => setVitesse(Number(e.target.value))}
          >
            {[10, 11, 12, 300, 600, 1200, 2400, 4800].map((val) => (
              <MenuItem key={val} value={val}>{val}</MenuItem>
            ))}
          </Select>
        </Grid>

        {/* Ecart Pointage Success (mn) */}
        <Grid item xs={6}>
          <InputComponent
            type="number"
            label="Ecart Pointage success (mn)"
            value={parecart}
            setValue={setParecart}
          />
        </Grid>

        {/* Placeholder for optional input or spacing */}
        {/* <Grid item xs={6}>
          <InputLabel shrink={true} id="vitesse-label">Méthode Lecture de Pointage</InputLabel>
          <Select
            size="small"
            labelId="lecutre-label"
            id="lecture-select"
            fullWidth
            value={methode}
            onChange={(e) => setMethode(e.target.value)}
          >
              <MenuItem key={0} value={0}> A partir de Badge (par défaut)</MenuItem>
              <MenuItem key={1} value={1}> A partir de Matricule (paie)</MenuItem>
              <MenuItem key={2} value={2}> Ajout de code site à gauche</MenuItem>
          </Select>
        </Grid> */}

        {/* Footer Note */}
        <Grid item xs={12}>
          <Box mt={2}>
            <h3 style={{ fontWeight: 400, fontSize: '0.95rem' }}>
              N° Port 1,2 ou 3 si transfert modèle : D : DIS, H : HAKIM, N : B-HAKIM, B : Table access,
              T : Pointeuse ZKS, Z : Base ZKS Vers 2008
            </h3>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Part1_ConnPoint;
