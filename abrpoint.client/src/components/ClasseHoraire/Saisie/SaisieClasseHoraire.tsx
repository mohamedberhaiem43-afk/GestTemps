import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import './SaisieClasseHoraire.css'
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import CheckboxComponent from "../../CheckboxComponent/CheckboxComponent";
import InputComponent from "../../Inputs/Input";
import { useClasseHoraireContext } from "../../helper/ClasseHoraireContext";
import usePostLcategorie from "../../../hooks/lcategoriesHooks/usePostLcategorie";
import { Lcategorie } from "../../../models/Lcategorie";
import useGetPoste from "../../../hooks/posteHooks/useGetPoste";
import useDeleteLcategorie from "../../../hooks/lcategoriesHooks/useDeleteLcategorie";
import CustomizedSnackbars from "../../Snackbar/Snackbar";
import AlertModal from "../../AlertModal/AlertModal";

const formatDate = (val: any) => {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0]; // → "YYYY-MM-DD"
};

export default function SaisieClasseHoraire() {
  const [codeClasseHoraire, setCodeClasseHoraire] = useState('');
  const [libelle, setLibelle] = useState('');
  const [heuresSupp, setHeuresSupp] = useState('0');
  const [catdu, setCatdu] = useState<Date | null>(null);
  const [catau, setCatau] = useState<Date | null>(null);
  const [poste, setPoste] = useState<string>('01');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [postes, setPostes] = useState<string[]>(['']); // commence avec un poste vide

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info" as "success" | "error" | "warning" | "info"
  });

  const { setSelectedPoste, selectedClasseHoraire, setSelectedClasseHoraire, frequence, setFrequence } = useClasseHoraireContext();
  const { data: postesList = [] } = useGetPoste();
  const postLcategorie = usePostLcategorie();
  const deleteLcategorie = useDeleteLcategorie();
  const frequencyMap = {
    "N": "Non Périodique",
    "S": "Selon Pointeuse",
  };
    const handleAddPoste = () => {
      setPostes([...postes, '']);
    };
    const handlePosteChange = (index: number , value: string) => {
      const updated = [...postes];
      updated[index] = value;
      setPostes(updated);

      // 🧩 Mettre à jour le poste sélectionné globalement
      setSelectedPoste(value);
    }; 
    
    const handlePosteChanges = (value: string) => {
      setPoste(value);
      // 🧩 Mettre à jour le poste sélectionné globalement
      setSelectedPoste(value);
    }; 
    
    const handleRemovePoste = (index: number) => {
      const updated = postes.filter((_, i) => i !== index);
      setPostes(updated);
    };

useEffect(() => {
  if (selectedClasseHoraire) {
    setSelectedPoste(selectedClasseHoraire.codposte);
    const freq = selectedClasseHoraire.catperiode || '';
    setCodeClasseHoraire(selectedClasseHoraire.catcod || '');
    setLibelle(selectedClasseHoraire.catlib || '');
    setFrequence(freq);
    setCatdu(selectedClasseHoraire.catdu ? new Date(selectedClasseHoraire.catdu) : null);
    setCatau(selectedClasseHoraire.catau ? new Date(selectedClasseHoraire.catau) : null);
    setHeuresSupp(selectedClasseHoraire.cathsup || '0');
    // 🧠 Si fréquence = "S" → postes multiples
    if (freq === 'S') {
      const postesArray: string[] = [];
      if (selectedClasseHoraire.codposte) postesArray.push(selectedClasseHoraire.codposte);
      if (selectedClasseHoraire.catsem2) postesArray.push(selectedClasseHoraire.catsem2);
      if (selectedClasseHoraire.catsem3) postesArray.push(selectedClasseHoraire.catsem3);
      if (selectedClasseHoraire.catsem4) postesArray.push(selectedClasseHoraire.catsem4);
      if (selectedClasseHoraire.catsem5) postesArray.push(selectedClasseHoraire.catsem5);
      if (selectedClasseHoraire.catsem6) postesArray.push(selectedClasseHoraire.catsem6);

      setPostes(postesArray.length > 0 ? postesArray : ['']);
    } else {
      // 🧠 Sinon → un seul poste
      setPoste(selectedClasseHoraire.codposte || '');
      setPostes(['']);
    }
  }
}, [selectedClasseHoraire, setFrequence]);

  const resetForm = () => {
    setCodeClasseHoraire('');
    setLibelle('');
    setHeuresSupp('0');
    setPoste('');
    setCatdu(null);
    setCatau(null);
    setSelectedClasseHoraire(null);
  };

  const handleSave = async () => {
    if (!codeClasseHoraire || !libelle) {
      setSnackbar({
        open: true,
        message: "Veuillez remplir le code et le libellé",
        severity: "warning",
      });
      return;
    }

    const lcategorie: Lcategorie = {
      soccod: sessionStorage.getItem('soccod') || '',
      catcod: codeClasseHoraire,
      ordre: selectedClasseHoraire?.ordre,
      catlib: libelle,
      catperiode: frequence,
      cathsup: heuresSupp,
      catfixe: "0",
      catdu: catdu ?? selectedClasseHoraire?.catdu,
      catau: catau ?? selectedClasseHoraire?.catau,
    };

    // 🧩 Si fréquence = "S", on sauvegarde plusieurs postes
    if (frequence === "S") {
      lcategorie.codposte = postes[0] || '';
      lcategorie.catsem2 = postes[1] || null;
      lcategorie.catsem3 = postes[2] || null;
      lcategorie.catsem4 = postes[3] || null;
      lcategorie.catsem5 = postes[4] || null;
      lcategorie.catsem6 = postes[5] || null;
    } else {
      lcategorie.codposte = poste;
    }


    try {
      await postLcategorie.mutateAsync(lcategorie);
      setSnackbar({
        open: true,
        message: "Classe horaire enregistrée avec succès",
        severity: "success",
      });
      resetForm();
    } catch (err) {
      console.error(err);
      setSnackbar({
        open: true,
        message: "Erreur lors de l'enregistrement",
        severity: "error",
      });
    }
  };

  /** ✅ Step 1: show confirmation modal */
  const confirmDelete = () => {
    if (!codeClasseHoraire || !libelle) {
      setSnackbar({
        open: true,
        message: "Veuillez remplir le code et le libellé",
        severity: "warning",
      });
      return;
    }
    setConfirmOpen(true);
  };

  /** ✅ Step 2: actual deletion logic once confirmed */
  const handleConfirmDelete = async () => {
    setConfirmOpen(false);

    const lcategorie: Lcategorie = {
      soccod: sessionStorage.getItem('soccod') || '',
      catcod: codeClasseHoraire,
      ordre: selectedClasseHoraire?.ordre,
      catlib: libelle,
      catperiode: frequence,
      cathsup: heuresSupp,
      catfixe: "0",
      codposte: poste ?? selectedClasseHoraire?.codposte,
      catdu: catdu ?? selectedClasseHoraire?.catdu,
      catau: catau ?? selectedClasseHoraire?.catau,
    };

    try {
      await deleteLcategorie.mutateAsync(lcategorie);
      setSnackbar({
        open: true,
        message: "Classe horaire supprimée avec succès",
        severity: "success",
      });
      resetForm();
    } catch (err) {
      console.error(err);
      setSnackbar({
        open: true,
        message: "Erreur lors de la suppression",
        severity: "error",
      });
    }
  };

  return (
    <Box component="form">
      <Grid container spacing={2} alignItems="center" direction="row">
        {/* Inputs */}
        <Grid item xs={7}>
          <Grid container spacing={2} alignItems="center" direction="row">
            <Grid item xs={1.5}>
              <InputComponent type='text' label='Code' value={codeClasseHoraire} setValue={setCodeClasseHoraire} />
            </Grid>
            <Grid item xs={2.5}>
              <InputComponent type='text' label='Libéllé' value={libelle} setValue={setLibelle} />
            </Grid>
            <Grid item xs={3}>
              <SelectInputComponent
                label="Fréquence"
                value={frequence}
                setValue={setFrequence}
                maplist={frequencyMap}
              />
            </Grid>
            <Grid item xs={2} mt={3}>
              <CheckboxComponent
                label='Heures Supp'
                value={heuresSupp === '1'}
                setValue={(val: boolean) => setHeuresSupp(val ? '1' : '0')}
              />
            </Grid>
            <Grid item xs={2.5}>
              <InputComponent
                type='date'
                label='Du'
                value={catdu ? formatDate(catdu) : ''}
                onChange={(e) => setCatdu(e.target.value ? new Date(e.target.value) : null)}
              />
            </Grid>
            <Grid item xs={2.5}>
              <InputComponent
                type='date'
                label='Au'
                value={catau ? formatDate(catau) : ''}
                onChange={(e) => setCatau(e.target.value ? new Date(e.target.value) : null)}
              />
            </Grid>
            <Grid item xs={3}>
              {frequence === "S" ? (
                <Box>
                  {postes.map((posteValue, index) => (
                    <Box key={index} display="flex" alignItems="center" mb={1}>
                      <SelectInputComponent
                        label={`Poste ${index + 1}`}
                        value={posteValue}
                        setValue={(val: string) => handlePosteChange(index, val)}
                        maplist={postesList}
                      />
                      {/* Bouton de suppression pour chaque ligne */}
                      {postes.length > 1 && (
                        <Button
                          color="error"
                          onClick={() => handleRemovePoste(index)}
                          sx={{ ml: 1, minWidth: 30 }}
                        >
                          -
                        </Button>
                      )}
                    </Box>
                  ))}


                </Box>
              ) : (
                <SelectInputComponent
                  label="Poste"
                  value={poste}
                  setValue={(val: string) => handlePosteChanges(val)}
                  maplist={postesList}
                />
              )}
            </Grid>
              {frequence=='S'&&(
                <Grid item xs={1}>
                      {/* Bouton + pour ajouter une nouvelle ligne */}
                      <Button
                        color="primary"
                        onClick={handleAddPoste}
                        sx={{ mt: 1 }}
                      >
                        + 
                      </Button>
                </Grid>
              )}

            <Grid item xs={1}>
              <Button onClick={resetForm}>Nouveau</Button>
            </Grid>
            <Grid item xs={1.5}>
              <Button color="success" onClick={handleSave}>Enregistrer</Button>
            </Grid>
            <Grid item xs={1}>
              <Button color="secondary" onClick={confirmDelete}>Supprimer</Button>
            </Grid>
          </Grid>
        </Grid>

        {/* Snackbar */}
        <CustomizedSnackbars
          open={snackbar.open}
          message={snackbar.message}
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        />

        {/* Confirmation Modal */}
        <AlertModal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleConfirmDelete}
          message="Voulez-vous vraiment supprimer cette classe horaire ?"
        />

        {/* Mise à jour section */}
        <Grid item xs={5}>
          <Box component="fieldset" id="update-classe-horaire" sx={{ height: '100%' }}>
            <legend>
              <Typography color={'error'}>Mise à Jour Classe Horaire</Typography>
            </legend>

            <Grid container spacing={2}>
              <Grid item xs={2}>
                <FormControlLabel control={<Checkbox size='small' />} label={<Typography fontSize="small">Retard</Typography>} />
              </Grid>
              <Grid item xs={2.5}>
                <FormControlLabel control={<Checkbox size='small' />} label={<Typography fontSize="small">Tolérance</Typography>} />
              </Grid>
              <Grid item xs={2.5}>
                <FormControlLabel control={<Checkbox size='small' />} label={<Typography fontSize="small">Présence</Typography>} />
              </Grid>
              <Grid item xs={1}>
                <FormControlLabel control={<Checkbox size='small' />} label={<Typography fontSize="small">Repas</Typography>} />
              </Grid>
            </Grid>

            <Button variant="outlined" sx={{ mt: 2 }}>Recalculer</Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
