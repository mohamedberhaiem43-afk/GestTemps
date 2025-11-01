import { Box, Button, Grid, IconButton, Typography } from "@mui/material";
import SaisiePoste from "./SaisiePoste";
import PosteTable from "./ListePosteTravail";
import { PosteContext } from "../helper/PostProvider/PostContext";
import SaveIcon from "@mui/icons-material/Save";
import { useContext, useState, useEffect } from "react";
import useUpdatePoste from "../../hooks/posteHooks/useUpdatePoste";
import PosteList from "./PosteTable";
import { Poste } from "../../models/Poste";
import useAddPoste from "../../hooks/posteHooks/useAddPoste";
import useDeletePoste from "../../hooks/posteHooks/useDeletePoste";
import ForbiddenMessage from "../AlertModal/ForbiddenMessage";
import CustomizedSnackbars from "../Snackbar/Snackbar";
import AlertModal from "../AlertModal/AlertModal";
import useGetAllPostes from "../../hooks/posteHooks/useGetAllPostes";

export default function PosteDeTravail() {
  const [saisieData, setSaisieData] = useState<Poste>({} as Poste);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info" as "success" | "error" | "warning" | "info"
  });
  const [scheduleData, setScheduleData] = useState<any[]>([]);
  const { mutate: updatePoste, isSuccess: updateSuccess, error: updateError } = useUpdatePoste();
  const { mutate: addPoste, isSuccess: addSuccess, error: addError } = useAddPoste();
  const { mutate: deletePoste, isSuccess: deleteSuccess, error: deleteError } = useDeletePoste();

  const soccod = sessionStorage.getItem("soccod") || "";
  const context = useContext(PosteContext);
  if (!context) throw new Error("PosteContext must be used within a PostProvider");
  const { selectedPoste, setSelectedPoste } = context;
  const { data: poste = {}, refetch } = useGetAllPostes(selectedPoste?.codposte);

  const [mode, setMode] = useState<string>("add");
  const [modalOpen, setModalOpen] = useState(false);

  // ✅ Update schedule data when poste changes
  useEffect(() => {
    if (poste) {
      setScheduleData([
        { jour: "Lundi", DebutEntree: poste.lunhdematin, Entrée: poste.lunhdmat, FinEntree: poste.lunhfematin, Sortie: poste.lunhfmat, repasBonus: poste.lunrepas, repos: poste.lunrepos },
        { jour: "Mardi", DebutEntree: poste.marhdematin, Entrée: poste.marhdmat, FinEntree: poste.marhfematin, Sortie: poste.marhfmat, repasBonus: poste.marrepas, repos: poste.marrepos },
        { jour: "Mercredi", DebutEntree: poste.merhdematin, Entrée: poste.merhdmat, FinEntree: poste.merhfematin, Sortie: poste.merhfmat, repasBonus: poste.merrepas, repos: poste.merrepos },
        { jour: "Jeudi", DebutEntree: poste.jeuhdematin, Entrée: poste.jeuhdmat, FinEntree: poste.jeuhfematin, Sortie: poste.jeuhfmat, repasBonus: poste.jeurepas, repos: poste.jeurepos },
        { jour: "Vendredi", DebutEntree: poste.venhdematin, Entrée: poste.venhdmat, FinEntree: poste.venhfematin, Sortie: poste.venhfmat, repasBonus: poste.venrepas, repos: poste.venrepos },
        { jour: "Samedi", DebutEntree: poste.samhdematin, Entrée: poste.samhdmat, FinEntree: poste.samhfematin, Sortie: poste.samhfmat, repasBonus: poste.samrepas, repos: poste.samrepos },
        { jour: "Dimanche", DebutEntree: poste.dimhdematin, Entrée: poste.dimhdmat, FinEntree: poste.dimhfematin, Sortie: poste.dimhfmat, repasBonus: poste.dimrepas, repos: poste.dimrepos },
      ]);
    }
  }, [poste]);

  // ✅ Show snackbar on success
  useEffect(() => {
    if (addSuccess) showSnackbar("Poste ajouté avec succès", "success");
    if (updateSuccess) showSnackbar("Poste mis à jour avec succès", "success");
    if (deleteSuccess) {
      showSnackbar("Poste supprimé avec succès", "success");
      resetForm();
    }
  }, [addSuccess, updateSuccess, deleteSuccess]);

  // ✅ Show snackbar for forbidden or other errors
  useEffect(() => {
    if ((updateError as any)?.response?.status === 403)
      showSnackbar("🚫 Vous n'avez pas le droit de modifier un poste.", "error");
    if ((addError as any)?.response?.status === 403)
      showSnackbar("🚫 Vous n'avez pas le droit d'ajouter un poste.", "error");
    if ((deleteError as any)?.response?.status === 403)
      showSnackbar("🚫 Vous n'avez pas le droit de supprimer un poste.", "error");
  }, [updateError, addError, deleteError]);

  const showSnackbar = (message: string, severity: "success" | "error" | "warning" | "info") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleScheduleChange = (index: number, field: string, value: any) => {
    const updated = [...scheduleData];
    updated[index][field] = value;
    setScheduleData(updated);
  };

  const handleSave = () => {
    if (!saisieData) return;

    const scheduleMap: any = {
      0: ["lunhdematin", "lunhdmat", "lunhfematin", "lunhfmat", "lunrepas", "lunrepos"],
      1: ["marhdematin", "marhdmat", "marhfematin", "marhfmat", "marrepas", "marrepos"],
      2: ["merhdematin", "merhdmat", "merhfematin", "merhfmat", "merrepas", "merrepos"],
      3: ["jeuhdematin", "jeuhdmat", "jeuhfematin", "jeuhfmat", "jeurepas", "jeurepos"],
      4: ["venhdematin", "venhdmat", "venhfematin", "venhfmat", "venrepas", "venrepos"],
      5: ["samhdematin", "samhdmat", "samhfematin", "samhfmat", "samrepas", "samrepos"],
      6: ["dimhdematin", "dimhdmat", "dimhfematin", "dimhfmat", "dimrepas", "dimrepos"],
    };

    const mergedData: any = { ...saisieData, soccod };
    scheduleData.forEach((row, i) => {
      const [deb, ent, fin, sort, rep, rep2] = scheduleMap[i];
      mergedData[deb] = row.DebutEntree;
      mergedData[ent] = row.Entrée;
      mergedData[fin] = row.FinEntree;
      mergedData[sort] = row.Sortie;
      mergedData[rep] = row.repasBonus;
      mergedData[rep2] = row.repos;
    });

    if (mode === "update") {
      updatePoste(mergedData);
      setMode("add");
    } else {
      addPoste(mergedData);
    }
  };

  const handleDelete = () => {
    if (!selectedPoste) return;
    deletePoste({ soccod, poscod: selectedPoste.codposte });
    setModalOpen(false);
    refetch();
  };

  const resetForm = () => {
    setSelectedPoste(undefined);
    setSaisieData({} as Poste);
    setScheduleData([]);
    setMode("add");
  };

  return (
    <Box>
      <Grid container spacing={0.5} height={"85vh"} mt={-3}>
        <Grid item xs={12}>
          <Typography fontWeight="bold" variant="h6" textAlign="center" color="primary" mb={2}>
            Gestion poste de Travail
          </Typography>
        </Grid>

        <Grid item xs={9}>
          <SaisiePoste onFormChange={setSaisieData} />
        </Grid>

        <Grid item xs={3} sx={{ mt: -2 }}>
          <PosteTable />
        </Grid>

        <Grid item xs={7} sx={{ mt: -2 }}>
          <PosteList scheduleData={scheduleData} onChange={handleScheduleChange} />
        </Grid>

        <Grid item xs={1.5} display="flex" justifyContent="space-around">
          <IconButton color="primary" onClick={handleSave}>
            <SaveIcon />
          </IconButton>
          <Button color="secondary" onClick={resetForm}>
            Nouveau
          </Button>
          <Button color="error" disabled={!selectedPoste} onClick={() => setModalOpen(true)}>
            Supprimer
          </Button>
        </Grid>
      </Grid>

      {/* ✅ Confirmation modal */}
      <AlertModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleDelete}
        message={`Voulez-vous vraiment supprimer le poste "${selectedPoste?.libposte}" ?`}
      />

      {/* ✅ Snackbar */}
      <CustomizedSnackbars
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      />

      {/* Optional forbidden messages */}
      {(updateError as any)?.response?.status === 403 && (
        <ForbiddenMessage message="Vous n'avez pas le droit de modifier un poste." />
      )}
      {(addError as any)?.response?.status === 403 && (
        <ForbiddenMessage message="Vous n'avez pas le droit d'ajouter un poste." />
      )}
      {(deleteError as any)?.response?.status === 403 && (
        <ForbiddenMessage message="Vous n'avez pas le droit de supprimer un poste." />
      )}
    </Box>
  );
}
