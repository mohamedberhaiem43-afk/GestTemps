import { Box, Grid, Button } from "@mui/material";
import InputComponent from "../../Inputs/Input";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import { useState } from "react";
import useAddRubrique from "../../../hooks/rubriqueHooks/useAddRubrique";

function RubriqueForm() {
  const [rubcod, setRubCod] = useState('');
  const [rublib, setRubLib] = useState('');
  const [rubtaux, setRubTaux] = useState(0);
  const [rubuntie, setRubUnite] = useState('');
  const [vartype, setVartype] = useState('');
  const [rubreg, setRubReg] = useState('');

  const addRubriqueMutation = useAddRubrique();

  const regimeOptions = {
    'M': 'Mensuelle',
    'H': 'Horaire',
    'T': 'Tous'
  };

  const uniteOptions = {
    'EUR': 'Euros',
    'PCT': 'Pourcentage',
    'JOU': 'Jours',
    'HEU': 'Heures'
  };

  const affectationOptions = {
    'EUR': 'Jour Trv',
    'PCT': 'Heure Trv',
    'JOU': 'Jour Complet',
    'HEU': 'Congé A',
    'S': 'C.S.F',
    'F': 'Férié',
    'R': 'Jour Férié Travaillé',
    'Y': 'Heure Férié Travaillé',
    'Z': 'Heure Férié Trav. Sup',
    'P': 'Jour Repos Travaillé',
    'D': 'Accident de travaille',
    'A': 'Allaitement',
    'O': 'Déplacement',
    'G': 'Hébergement',
    'U': 'Nuit',
    '2': 'H.SUPP I',
    '5': 'H.SUPP II',
    '7': 'H.SUPP III',
    '1': 'H.SUPP IV',
    'X': 'Implication',
    'M': 'Semaine Trv',
    'I': 'Férié non payé',
    'K': 'Maladie',
    'V': 'Autorisation de sortie',
    '3': 'Heures Abs.',
    '4': 'Prime Panier',
    'L': 'Rendement Mensuel',
    'E': 'Blâme',
    '6': 'Mise à Pieds',
    '8': 'Prime N.Abs',
    '9': 'Prime Qualité',
    'AV': 'Avance',
    'PR': 'Prêts',
  };

  const handleSubmit = () => {
    const newRubrique = {
      soccod: '01',
      rubcod,
      rublib,
      rubtaux,
      rubuntie,
      rubreg,
      vartype,
    };

    addRubriqueMutation.mutate(newRubrique);
  };

  return (
    <Box>
      {/* First row with 3 inputs */}
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={6}>
          <InputComponent type="text" label="Code" value={rubcod} setValue={setRubCod} />
        </Grid>
        <Grid item xs={6}>
          <InputComponent type="text" label="Libellé" value={rublib} setValue={setRubLib} />
        </Grid>

      </Grid>

      {/* Second row with 2 select inputs */}
      <Grid container spacing={2} alignItems="center" sx={{ mt: 2 }}>
        <Grid item xs={6}>
          <SelectInputComponent
            label="Régime"
            value={rubreg}
            setValue={setRubReg}
            maplist={regimeOptions}
          />
        </Grid>
        <Grid item xs={6}>
          <SelectInputComponent
            label="Unité"
            value={rubuntie}
            setValue={setRubUnite}
            maplist={uniteOptions}
          />
        </Grid>
      </Grid>

      {/* Third row: Affectation */}
      <Grid container spacing={2} alignItems="center" sx={{ mt: 2 }}>
        <Grid item xs={6}>
          <InputComponent type="number" label="Taux" value={rubtaux} setValue={setRubTaux} />
        </Grid>
        <Grid item xs={6}>
          <SelectInputComponent
            label="Affectation"
            value={vartype}
            setValue={setVartype}
            maplist={affectationOptions}
          />
        </Grid>
      </Grid>

      {/* Submit button */}
      <Box sx={{ mt: 3, textAlign: "right" }}>
        <Button variant="contained" color="primary" onClick={handleSubmit}>
          Enregistrer la Rubrique
        </Button>
      </Box>
    </Box>
  );
}

export default RubriqueForm;
