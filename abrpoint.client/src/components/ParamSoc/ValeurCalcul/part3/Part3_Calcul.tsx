import './Part3_Calcul.css';
import { Parametre } from "../../../../models/Parametre";
import InputComponent from "../../../Inputs/Input";
import { useEffect, useState } from 'react';
import { Grid, Box } from "@mui/material";
import { useTranslation } from "react-i18next";

interface AffichageProps {
  parametre?: Parametre;
  onChange?: (data: Partial<Parametre>) => void;
}

const Part3_Calcul: React.FC<AffichageProps> = ({ parametre, onChange }) => {
  const { t } = useTranslation();
  const [parmaxfer, setParmaxfer] = useState(parametre?.parmaxfer);
  const [tauxtr4M, setTauxtr4M] = useState(parametre?.tauxtr4M);
  const [parminhjour, setParminhjour] = useState(parametre?.parminhjour);
  const [parmaxhjour, setParmaxhjour] = useState(parametre?.parmaxhjour);
  const [nbhtr3M, setNbhtr3M] = useState(parametre?.nbhtr3M);
  const [tauxtr3M, setTauxtr3M] = useState(parametre?.tauxtr3M);
  const [parpostlundi, setParpostlundi] = useState(parametre?.parpostlundi);
  useEffect(()=>{
    if (onChange) {
      onChange({
        parmaxfer: Number(parmaxfer),
        tauxtr4M: Number(tauxtr4M),
        parminhjour: Number(parminhjour),
        parmaxhjour: Number(parmaxhjour),
        nbhtr3M: Number(nbhtr3M),
        tauxtr3M: Number(tauxtr3M),
        parpostlundi: parpostlundi,
      });
    }
  },[parmaxfer, tauxtr4M, parminhjour, parmaxhjour, nbhtr3M, tauxtr3M, parpostlundi]);
  return (
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={2}>
        <Grid item xs={3}>
          <InputComponent
            type="number"
            label={t('paramSoc.valeurCalcul.part3.maxHeuresFerie')}
            value={parmaxfer}
            setValue={setParmaxfer}
          />
        </Grid>

        <Grid item xs={3}>
          <Box display="flex" alignItems="center" height="100%">
            <span>{t('paramSoc.valeurCalcul.part3.selonClasse')}</span>
          </Box>
        </Grid>

        <Grid item xs={2.5}>
          <InputComponent
            type="number"
            label={t('paramSoc.valeurCalcul.part3.minHeuresJour')}
            value={parminhjour}
            setValue={setParminhjour}
          />
        </Grid>

        <Grid item xs={3}>
          <InputComponent
            type="number"
            label={t('paramSoc.valeurCalcul.part3.minHeuresDemi')}
            value={tauxtr4M}
            setValue={setTauxtr4M}
          />
        </Grid>

        <Grid item xs={4}>
          <InputComponent
            type="number"
            label={t('paramSoc.valeurCalcul.part3.maxHeuresJour')}
            value={parmaxhjour}
            setValue={setParmaxhjour}
          />
        </Grid>

        <Grid item xs={4}>
          <InputComponent
            type="number"
            label={t('paramSoc.valeurCalcul.part3.arrondirHeure')}
            value={nbhtr3M}
            setValue={setNbhtr3M}
          />
        </Grid>

        <Grid item xs={1}>
          <InputComponent
            type="number"
            label={t('paramSoc.valeurCalcul.part3.a')}
            value={tauxtr3M}
            setValue={setTauxtr3M}
          />
        </Grid>

        <Grid item xs={2}>
          <Box display="flex" alignItems="center" height="100%">
            <span>{t('paramSoc.valeurCalcul.part3.pourPoste')}</span>
          </Box>
        </Grid>

        <Grid item xs={4}>
          <InputComponent
            type="number"
            label={t('paramSoc.valeurCalcul.part3.changementPoste')}
            value={parpostlundi}
            setValue={setParpostlundi}
          />
        </Grid>

        {/* <Grid item xs={4}>
          <InputComponent
            type="number"
            label="Minimum H.Sup par jour en minutes"
            value={parametre?. ?? ""}
            setValue={(val) => onChange?.({ minHSupParJour: val })}
          />
        </Grid> */}
      </Grid>
    </Box>
  );
};

export default Part3_Calcul;
