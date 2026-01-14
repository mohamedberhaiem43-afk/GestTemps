import { Box, Grid, Button, CircularProgress } from "@mui/material";
import InputComponent from "../../Inputs/Input";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import { useState, useEffect } from "react";
import useAddRubrique from "../../../hooks/rubriqueHooks/useAddRubrique";
import useUpdateRubrique from "../../../hooks/rubriqueHooks/useUpdateRubrique";
import useGetRubrique from "../../../hooks/rubriqueHooks/useGetRubrique";
import { Rubrique } from "../../../models/Rubrique";
import { useAuth } from "../../helper/AuthProvider";
import useGetRubriques from "../../../hooks/rubriqueHooks/useGetRubriques";

interface RubriqueFormProps {
  editingRubrique: Rubrique | null;
  setEditingRubrique: (rubrique: Rubrique | null) => void;
}

function RubriqueForm({ editingRubrique, setEditingRubrique }: RubriqueFormProps) {
  const [rubcod, setRubCod] = useState('');
  const [rublib, setRubLib] = useState('');
  const [rubtaux, setRubTaux] = useState(0);
  const [rubuntie, setRubUnite] = useState('');
  const [vartype, setVartype] = useState('');
  const [rubreg, setRubReg] = useState('T');

  // ✅ Call useAuth at the top level of the component
  const { soccod } = useAuth();

  const addRubriqueMutation = useAddRubrique();
  const updateRubriqueMutation = useUpdateRubrique();
  const {refetch} = useGetRubriques();
  
  // Fetch rubrique data when editing
  const { data: fetchedRubrique, isLoading } = useGetRubrique(
    editingRubrique?.rubcod || ''
  );

  // Populate form when rubrique data is fetched
  useEffect(() => {
    if (fetchedRubrique) {
      const rubrique = fetchedRubrique;
      setRubCod(rubrique.rubcod || '');
      setRubLib(rubrique.rublib || '');
      setRubTaux(rubrique.rubtaux || 0);
      setRubUnite(rubrique.rubunite || '');
      setVartype(rubrique.vartype || '');
      setRubReg(rubrique.rubregime || '');
    }
  }, [fetchedRubrique]);

  const regimeOptions = {
    'M': 'Mensuelle',
    'H': 'Horaire',
    'T': 'Tous'
  };

  const uniteOptions = {
    'J': 'Jour',
    'H': 'Heure'
  };

  const affectationOptions = {
    'T': 'Jour Trv',
    'H': 'Heure Trv',
    'J': 'Jour Complet',
    'C': 'Congé A',
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
    // ✅ Now use the soccod variable from the top level
    const rubriqueData = {
      soccod: soccod || '',
      rubcod,
      rublib,
      rubtaux,
      rubunite: rubuntie,
      rubregime: rubreg,
      vartype,
    };

    if (editingRubrique) {
      // Update existing rubrique
      updateRubriqueMutation.mutate(rubriqueData, {
        onSuccess: () => {
          handleCancel();
        }
      });
    } else {
      // Add new rubrique
      addRubriqueMutation.mutate(rubriqueData, {
        onSuccess: () => {
          refetch();
          handleCancel();
        }
      });
    }
  };

  const handleCancel = () => {
    // Clear form
    setRubCod('');
    setRubLib('');
    setRubTaux(0);
    setRubUnite('H');
    setVartype('');
    setRubReg('T');
    setEditingRubrique(null);
  };

  // Show loading indicator while fetching rubrique data
  if (isLoading && editingRubrique) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={6}>
          <InputComponent 
            type="text" 
            label="Code" 
            value={rubcod} 
            setValue={setRubCod}
          />
        </Grid>
        <Grid item xs={6}>
          <InputComponent type="text" label="Libellé" value={rublib} setValue={setRubLib} />
        </Grid>
      </Grid>

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

      <Box sx={{ mt: 3, textAlign: "right", display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        {editingRubrique && (
          <Button variant="outlined" color="secondary" onClick={handleCancel}>
            Annuler
          </Button>
        )}
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleSubmit}
          disabled={isLoading}
        >
          {editingRubrique ? 'Modifier la Rubrique' : 'Enregistrer la Rubrique'}
        </Button>
      </Box>
    </Box>
  );
}

export default RubriqueForm;