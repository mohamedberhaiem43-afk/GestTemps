import {
  MenuItem,
  Select,
  InputLabel,
  Box,
  Grid,
} from "@mui/material";
import { useTranslation } from 'react-i18next';
import "./Part1_Calcul.css";
import { useEffect, useState } from "react";
import InputComponent from "../../../Inputs/Input";
import { Parametre } from "../../../../models/Parametre";

interface AffichageProps {
  parametre?: Parametre;
  onChange?: (data: Partial<Parametre>) => void;
}

const Part1_Calcul: React.FC<AffichageProps> = ({ parametre, onChange }) => {
  const { t } = useTranslation();

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
            label={t('paramSoc.part1.jourDebut')}
            value={joudeb}
            setValue={setJouDeb}
          />
        </Grid>

        <Grid item xs={2}>
          <InputLabel shrink={true} variant="standard">{t('paramSoc.common.month')}</InputLabel>
          <Select
            variant="standard"
            size="small"
            fullWidth
            value={moisdeb}
            onChange={(e) => setMoisDeb(e.target.value)}
          >
            <MenuItem value="P">{t('common.previous')}</MenuItem>
            <MenuItem value="C">{t('common.current')}</MenuItem>
          </Select>
        </Grid>

        <Grid item xs={2}>
          <InputComponent
            type="text"
            label={t('paramSoc.part1.divideHoursBy')}
            value={parjhnfixe}
            setValue={setParjhnfixe}
          />
        </Grid>

        <Grid item xs={2}>
          <InputComponent
            type="number"
            label={t('paramSoc.part1.jourFin')}
            value={joufin}
            setValue={setJouFin}
          />
        </Grid>

        <Grid item xs={2}>
          <InputLabel shrink={true} variant="standard">{t('paramSoc.common.month')}</InputLabel>
          <Select
            variant="standard"
            size="small"
            fullWidth
            value={moisfin}
            onChange={(e) => setMoisfin(e.target.value)}
          >
            <MenuItem value="P">{t('common.previous')}</MenuItem>
            <MenuItem value="C">{t('common.current')}</MenuItem>
          </Select>
        </Grid>

        <Grid item xs={2}>
          <InputComponent
            type="number"
            label={t('paramSoc.part1.presenceHoursCalculated')}
            value={joudeb}
            setValue={undefined}
          />
        </Grid>

        <Grid item xs={3}>
          <InputLabel shrink={true} variant="standard">{t('paramSoc.part1.presenceCalcMethod')}</InputLabel>
          <Select variant="standard" size="small"  fullWidth value={parpresence} onChange={(e)=>setParPresence(e.target.value)} >
            <MenuItem value={'0'}>{t('paramSoc.part1.method.workedHours')}</MenuItem>
            <MenuItem value={'1'}>{t('paramSoc.part1.method.classeAbsence')}</MenuItem>
            <MenuItem value={'2'}>{t('paramSoc.part1.method.daysWorked')}</MenuItem>
            <MenuItem value={'3'}>{t('paramSoc.part1.method.hoursDaysWorked')}</MenuItem>
          </Select>
        </Grid>

        <Grid item xs={2.5}>
          <InputComponent
            type="number"
            label={t('paramSoc.part1.annualLeaveIncrease')}
            value={pardroitnbj}
            setValue={setParDroitNbj}
          />
        </Grid>

        <Grid item xs={2}>
          <InputLabel variant="standard">{t('paramSoc.part1.seniorityLabel')}</InputLabel>
          <Select variant="standard" size="small" fullWidth value={10}>
            <MenuItem value={10}>{t('paramSoc.part1.fiveYears')}</MenuItem>
          </Select>
        </Grid>

        <Grid item xs={1}>
          <InputComponent
            type="number"
            label={t('paramSoc.part1.saisieConge')}
            value={parsaisconge}
            setValue={setParsaisconge}
          />
        </Grid>

        <Grid item xs={2}>
          <Box display="flex" alignItems="center" height="100%">
            <span>{t('paramSoc.part1.daysBeforeOrAfter')}</span>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Part1_Calcul;
