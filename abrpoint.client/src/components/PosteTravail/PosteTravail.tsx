import { Box, Button, Grid, IconButton } from "@mui/material";
import SaisiePoste from "./SaisiePoste";
import PosteTable from "./ListePosteTravail";
import { PosteContext } from "../helper/PostProvider/PostContext";
import SaveIcon from "@mui/icons-material/Save";
import { useContext, useState, useEffect } from "react";
import useUpdatePoste from "../../hooks/posteHooks/useUpdatePoste";
import PosteList from "./PosteTable";
import { Poste } from "../../models/Poste";
import useAddPoste from "../../hooks/posteHooks/useAddPoste";
import BreadcrumbNavigation from "../helper/BreadcrumbNavigation";
import useDeletePoste from "../../hooks/posteHooks/useDeletePoste";
import ForbiddenMessage from "../AlertModal/ForbiddenMessage";
import CustomizedSnackbars from "../Snackbar/Snackbar";
import AlertModal from "../AlertModal/AlertModal";
import useGetAllPostes from "../../hooks/posteHooks/useGetAllPostes";
import { useAuth } from "../helper/AuthProvider";

export default function PosteDeTravail() {
      const emptySchedule = [
      { jour: 'Lundi', DebEntree: "",Entrée: "",FinEntree: "", Sortie: "", repasBonus: "0", repos: "0",DebEntree2: "",Entree2:"",Sortie2:"",FinEntree2: "",maxhre:"",minhjour:"",minhdemijour:"",Douche:"" },
      { jour: 'Mardi', DebEntree: "",Entrée: "",FinEntree: "", Sortie: "", repasBonus: "0", repos: "0",DebEntree2: "",Entree2:"",Sortie2:"",FinEntree2: "",maxhre:"",minhjour:"",minhdemijour:"",Douche:"" },
      { jour: 'Mercredi', DebEntree: "",Entrée: "",FinEntree: "", Sortie: "", repasBonus: "0", repos: "0",DebEntree2: "",Entree2:"",Sortie2:"",FinEntree2: "",maxhre:"",minhjour:"",minhdemijour:"",Douche:"" },
      { jour: 'Jeudi', DebEntree: "",Entrée: "",FinEntree: "", Sortie: "", repasBonus: "0", repos: "0",DebEntree2: "",Entree2:"",Sortie2:"",FinEntree2: "",maxhre:"",minhjour:"",minhdemijour:"",Douche:"" },
      { jour: 'Vendredi', DebEntree: "",Entrée: "",FinEntree: "", Sortie: "", repasBonus: "0", repos: "0",DebEntree2: "",Entree2:"",Sortie2:"",FinEntree2: "",maxhre:"",minhjour:"",minhdemijour:"",Douche:"" },
      { jour: 'Samedi', DebEntree: "",Entrée: "",FinEntree: "", Sortie: "", repasBonus: "0", repos: "0",DebEntree2: "",Entree2:"",Sortie2:"",FinEntree2: "",maxhre:"",minhjour:"",minhdemijour:"",Douche:"" },
      { jour: 'Dimanche', DebEntree: "",Entrée: "",FinEntree: "", Sortie: "", repasBonus: "0", repos: "0",DebEntree2: "",Entree2:"",Sortie2:"",FinEntree2: "",maxhre:"",minhjour:"",minhdemijour:"",Douche:"" },
    ];
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

  const { soccod } = useAuth();
  const context = useContext(PosteContext);
  if (!context) throw new Error("PosteContext must be used within a PostProvider");
  const { selectedPoste, setSelectedPoste } = context;
  const { data: poste = {} } = useGetAllPostes(selectedPoste?.codposte);

  const [mode, setMode] = useState<string>("add");
  const [modalOpen, setModalOpen] = useState(false);

  // ✅ Update schedule data when poste changes
  useEffect(() => {
    if (poste) {
    setScheduleData([
      { jour: 'Lundi', DebEntree: poste?.lunhdematin,Entrée: poste?.lunhdmat,FinEntree: poste?.lunhfematin, Sortie: poste?.lunhfmat, repasBonus: poste?.lunrepas, repos: poste?.lunrepos,DebEntree2: poste?.lunhdeamidi,Entree2:poste?.lunhdam,Sortie2:poste?.lunhfam,FinEntree2: poste?.lunhfeamidi,maxhre:poste?.maxhrelun,minhjour:poste?.minhjourlun,minhdemijour:poste?.minhdemijourlun,Douche:poste?.lundouche },
      { jour: 'Mardi', DebEntree: poste?.marhdematin,Entrée: poste?.marhdmat,FinEntree: poste?.marhfematin, Sortie: poste?.marhfmat, repasBonus: poste?.marrepas, repos: poste?.marrepos,DebEntree2: poste?.marhdeamidi,Entree2:poste?.marhdam,Sortie2:poste?.marhfam,FinEntree2: poste?.marhfeamidi,maxhre:poste?.maxhremar,minhjour:poste?.minhjourmar,minhdemijour:poste?.minhdemijourmar,Douche:poste?.mardouche },
      { jour: 'Mercredi', DebEntree: poste?.merhdematin,Entrée: poste?.merhdmat,FinEntree: poste?.merhfematin, Sortie: poste?.merhfmat, repasBonus: poste?.merrepas, repos: poste?.merrepos,DebEntree2: poste?.merhdeamidi,Entree2:poste?.merhdam,Sortie2:poste?.merhfam,FinEntree2: poste?.merhfeamidi,maxhre:poste?.maxhremer,minhjour:poste?.minhjourmer,minhdemijour:poste?.minhdemijourmer,Douche:poste?.merdouche },
      { jour: 'Jeudi', DebEntree: poste?.jeuhdematin,Entrée: poste?.jeuhdmat,FinEntree: poste?.jeuhfematin, Sortie: poste?.jeuhfmat, repasBonus: poste?.jeurepas, repos: poste?.jeurepos,DebEntree2: poste?.jeuhdeamidi,Entree2:poste?.jeuhdam,Sortie2:poste?.jeuhfam,FinEntree2: poste?.jeuhfeamidi,maxhre:poste?.maxhrejeu,minhjour:poste?.minhjourjeu,minhdemijour:poste?.minhdemijourjeu,Douche:poste?.jeudouche },
      { jour: 'Vendredi', DebEntree: poste?.venhdematin,Entrée: poste?.venhdmat,FinEntree: poste?.venhfematin, Sortie: poste?.venhfmat, repasBonus: poste?.venrepas, repos: poste?.venrepos,DebEntree2: poste?.venhdeamidi,Entree2:poste?.venhdam,Sortie2:poste?.venhfam,FinEntree2: poste?.venhfeamidi,maxhre:poste?.maxhreven,minhjour:poste?.minhjourven,minhdemijour:poste?.minhdemijourven,Douche:poste?.vendouche },
      { jour: 'Samedi', DebEntree: poste?.samhdematin,Entrée: poste?.samhdmat,FinEntree: poste?.samhfematin, Sortie: poste?.samhfmat, repasBonus: poste?.samrepas, repos: poste?.samrepos,DebEntree2: poste?.samhdeamidi,Entree2:poste?.samhdam,Sortie2:poste?.samhfam,FinEntree2: poste?.samhfeamidi,maxhre:poste?.maxhresam,minhjour:poste?.minhjoursam,minhdemijour:poste?.minhdemijoursam,Douche:poste?.samdouche },
      { jour: 'Dimanche', DebEntree: poste?.dimhdematin,Entrée: poste?.dimhdmat,FinEntree: poste?.dimhfematin, Sortie: poste?.dimhfmat, repasBonus: poste?.dimrepas, repos: poste?.dimrepos,DebEntree2: poste?.dimhdeamidi,Entree2:poste?.dimhdam,Sortie2:poste?.dimhfam,FinEntree2: poste?.dimhfeamidi,maxhre:poste?.maxhredim,minhjour:poste?.minhjourdim,minhdemijour:poste?.minhdemijourdim,Douche:poste?.dimdouche },
    ]);
    }
  }, [poste]);

  // ✅ Show snackbar on success
  useEffect(() => {
    if (addSuccess) {
      showSnackbar("Poste ajouté avec succès", "success");
      resetForm();
    }
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
      0: ["lunhdematin", "lunhdmat", "lunhfematin", "lunhfmat", "lunrepas", "lunrepos",
          "lunhdeamidi", "lunhdam", "lunhfam", "lunhfeamidi",
          "maxhrelun", "minhjourlun", "minhdemijourlun", "lundouche"],
      1: ["marhdematin", "marhdmat", "marhfematin", "marhfmat", "marrepas", "marrepos",
          "marhdeamidi", "marhdam", "marhfam", "marhfeamidi",
          "maxhremar", "minhjourmar", "minhdemijourmar", "mardouche"],
      2: ["merhdematin", "merhdmat", "merhfematin", "merhfmat", "merrepas", "merrepos",
          "merhdeamidi", "merhdam", "merhfam", "merhfeamidi",
          "maxhremer", "minhjourmer", "minhdemijourmer", "merdouche"],
      3: ["jeuhdematin", "jeuhdmat", "jeuhfematin", "jeuhfmat", "jeurepas", "jeurepos",
          "jeuhdeamidi", "jeuhdam", "jeuhfam", "jeuhfeamidi",
          "maxhrejeu", "minhjourjeu", "minhdemijourjeu", "jeudouche"],
      4: ["venhdematin", "venhdmat", "venhfematin", "venhfmat", "venrepas", "venrepos",
          "venhdeamidi", "venhdam", "venhfam", "venhfeamidi",
          "maxhreven", "minhjourven", "minhdemijourven", "vendouche"],
      5: ["samhdematin", "samhdmat", "samhfematin", "samhfmat", "samrepas", "samrepos",
          "samhdeamidi", "samhdam", "samhfam", "samhfeamidi",
          "maxhresam", "minhjoursam", "minhdemijoursam", "samdouche"],
      6: ["dimhdematin", "dimhdmat", "dimhfematin", "dimhfmat", "dimrepas", "dimrepos",
          "dimhdeamidi", "dimhdam", "dimhfam", "dimhfeamidi",
          "maxhredim", "minhjourdim", "minhdemijourdim", "dimdouche"]
    };
    const mergedData: any = { ...saisieData, soccod };
    scheduleData.forEach((row, i) => {
      const [
        debMatin, entreeMatin, finMatin, sortieMatin, repas, repos,
        debAprem, entreeAprem, sortieAprem, finAprem,
        maxh, minhjour, minhdemijour, douche
      ] = scheduleMap[i];

      mergedData[debMatin] = row.DebEntree;
      mergedData[entreeMatin] = row.Entrée;
      mergedData[finMatin] = row.FinEntree;
      mergedData[sortieMatin] = row.Sortie;
      mergedData[repas] = row.repasBonus;
      mergedData[repos] = row.repos;
      mergedData[debAprem] = row.DebEntree2;
      mergedData[entreeAprem] = row.Entree2;
      mergedData[sortieAprem] = row.Sortie2;
      mergedData[finAprem] = row.FinEntree2;
      mergedData[maxh] = row.maxhre;
      mergedData[minhjour] = row.minhjour;
      mergedData[minhdemijour] = row.minhdemijour;
      mergedData[douche] = row.Douche;
    });

    if (mode === "update") {
      updatePoste(mergedData);
      setMode("add");
    } else {
     addPoste(mergedData, {
      onSuccess: (res:any) => {
        showSnackbar(res.message, res.success ? "success" : "warning");
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message || "Erreur lors de l’ajout du poste.";
        showSnackbar(msg, "error");
      },
    });
  }
  };

  const handleDelete = () => {
    if (!selectedPoste) return;

    deletePoste(
      { soccod: soccod || '', poscod: selectedPoste.codposte },
      {
        onSuccess: (res) => {
          showSnackbar(res.message, res.success ? "success" : "warning");
          setModalOpen(false);
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message || "Erreur lors de la suppression.";
          const success = err?.response?.data?.success || false;
          showSnackbar(msg, success ? "success" : "error");
        },
      }
    );
  };


  const resetForm = () => {
    setSelectedPoste(undefined);
    setSaisieData({} as Poste);
    setScheduleData(emptySchedule);
    setMode("add");
  };

  return (
    <Box>
      <Grid container height={"90vh"} width={'97vw'} mt={-15} >
        <Grid item xs={12} display="flex" alignItems="center" justifyContent="space-between" >
          {/* Breadcrumb à gauche */}
          <BreadcrumbNavigation />

          {/* Boutons à droite */}
            <Box display="flex" gap={2}>
              <IconButton color="primary" onClick={handleSave}>
                <SaveIcon />
              </IconButton>

              <Button color="secondary" onClick={resetForm}>
                Nouveau
              </Button>

              <Button
                color="error"
                disabled={!selectedPoste}
                onClick={() => setModalOpen(true)}
              >
                Supprimer
              </Button>
            </Box>
          </Grid>


        <Grid item xs={9}>
          <SaisiePoste onFormChange={setSaisieData} />
        </Grid>

        <Grid item xs={3} sx={{ mt: -2 }}>
          <PosteTable />
        </Grid>

        <Grid item xs={12} sx={{ mt: -5 }}>
          <PosteList scheduleData={scheduleData} onChange={handleScheduleChange} />
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
