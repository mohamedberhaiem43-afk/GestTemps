import { Grid } from "@mui/material";
import './Part1.css';
import AffichageProps from "../../../../models/AffichageProps";
import { useEffect, useState } from "react";
import InputComponent from "../../../Inputs/Input";
import CheckboxComponent from "../../../CheckboxComponent/CheckboxComponent";

const Part1: React.FC<AffichageProps> = ({ parametre, onChange }) => {
    const [affech, setAffech] = useState(String(parametre?.affech ?? '0'));
    const [parsem, setParsem] = useState(String(parametre?.parsem ?? '0'));
    const [planhoraire, setPlanhoraire] = useState(String(parametre?.planhoraire ?? '0'));
    const [longbdg, setLongbdg] = useState(parametre?.longbdg ?? 0);
    const [parallaite, setParallaite] = useState(String(parametre?.parallaite ?? '0'));
    const [parabsconge, setParabsconge] = useState(String(parametre?.parabsconge ?? '0'));
    useEffect(() => {
        if (onChange) {
            onChange({
                affech: affech,
                parsem: parsem,
                planhoraire: planhoraire,
                longbdg: longbdg,
                parallaite: parallaite,
                parabsconge: parabsconge
            });
        }
    }, [affech, parsem, planhoraire, longbdg, parallaite, parabsconge, onChange]);
  return (
    <Grid container spacing={2}>
      <Grid item xs={5}>
        <CheckboxComponent
          label={"Afficher Echéance Contrat à l'accueil"}
          value={affech == "1"}
          setValue={(checked) => setAffech(checked ? "1" : "0")}
        />
      </Grid>

      <Grid item xs={6}>
        <CheckboxComponent
          label={"Calcul Heures Semaine selon définition non calendrier"}
          value={parsem == "1"}
          setValue={(checked) => setParsem(checked ? "1" : "0")}
        />
      </Grid>

      <Grid item xs={5}>
        <CheckboxComponent
          label={"Utilisation de plan Calendrier"}
          value={planhoraire == "1"}
          setValue={(checked) => setPlanhoraire(checked ? "1" : "0")}
        />
      </Grid>

      <Grid item xs={4}>
        <InputComponent
          type={"number"}
          label={"Longueur Matricule"}
          value={longbdg}
          setValue={setLongbdg}
        />
      </Grid>

      

      <Grid item xs={5}>
        <CheckboxComponent
          label={"Même série d'absence et de congé"}
          value={parabsconge == "1"}
          setValue={(checked) => setParabsconge(checked ? "1" : "0")}
        />
      </Grid>
      <Grid item xs={4}>
        <InputComponent
          type={"text"}
          label={"Code Absence Allaitement"}
          value={parallaite}
          setValue={setParallaite}
        />
      </Grid>
    </Grid>
  );
};

export default Part1;
