import { Box, Grid, Button, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from "@mui/material";
import InputComponent from "../../Inputs/Input";
import { useState, useEffect } from "react";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import useGetSocLibs from "../../../hooks/societeHooks/useGetSocLibs";
import useGetSiteLibs from "../../../hooks/siteHooks/useGetSiteLibs";
import axios from "axios";
import CheckboxComponent from "../../CheckboxComponent/CheckboxComponent";
import useUpdateProfile from "../../../hooks/profileHooks/useChangePassword";

interface SaisieProfileProps {
  onDataChange: (data: any) => void;
  onSave?: () => void;
  profil: boolean;
  initialData?: any;
}

export default function SaisieProfile({ onDataChange, profil, initialData }: SaisieProfileProps) {
  const [uticod, setCode] = useState("");
  const [utiprn, setPrenom] = useState("");
  const [utinom, setNom] = useState("");
  const [utimail, setUtimail] = useState("");
  const [utimps, setMotPasse] = useState(""); // will be set from change-password dialog
  const [societe, setSociete] = useState("");
  const [site, setSite] = useState("");
  const [utiadm, setUtiadm] = useState(false);
  const { data: socLibs = [] } = useGetSocLibs();
  const { data: sitLibs = [] } = useGetSiteLibs();
  const updatePassword = useUpdateProfile();

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">("success");

  // change password dialog state
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Prefill from profile provided by parent
    useEffect(() => {
    if (initialData) {
        setCode(initialData.uticod || "");
        setNom(initialData.utinom || "");
        setPrenom(initialData.utiprn || "");
        setUtimail(initialData.utimail || "");
        setUtiadm(initialData.utiadm === "1"); // ✅ FIX
        setMotPasse(""); // ne jamais pré-remplir le mot de passe
        setSociete(initialData.soccod || "");
        setSite(initialData.sitcod || "");
    }
    }, [initialData]);

  // notify parent of changes
useEffect(() => {
  onDataChange({
    uticod,
    utinom,
    utiprn,
    utimail,
    utiadm: utiadm ? "1" : "0", // ✅ cohérent backend
    soccod: societe,
    sitcod: site,
  });
}, [uticod, utinom, utiprn, utimail, utiadm, societe, site]);

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);

      // Call API to save the image
      try {
        const formData = new FormData();
        formData.append("file", file);
        await axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/Utilisateurs/upload-profile`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          withCredentials: true,
        });
        setSnackbarMessage("Image sauvegardée avec succès.");
        setSnackbarSeverity("success");
        setSnackbarOpen(true);
      } catch (error) {
        console.error("Erreur lors de la sauvegarde de l'image:", error);
        setSnackbarMessage("Erreur lors de la sauvegarde de l'image.");
        setSnackbarSeverity("error");
        setSnackbarOpen(true);
      }
    } else {
      setSelectedImage(null);
      setImagePreview(null);
    }
  };

  const openChangePwd = () => {
    setCurrentPassword("");
    setNewPassword("");
    setChangePwdOpen(true);
  };
  const closeChangePwd = () => setChangePwdOpen(false);

  const handleSavePassword = async () => {
    if (!currentPassword || !newPassword) {
      setSnackbarMessage("Veuillez renseigner l'ancien et le nouveau mot de passe.");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
      return;
    }
    try {
      await updatePassword.mutateAsync({
        uticod,
        currentPassword,
        newPassword,
      });
      setChangePwdOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setSnackbarMessage("Mot de passe changé avec succès.");
      setSnackbarSeverity("success");
      setSnackbarOpen(true);
    } catch (error) {
      console.error("Erreur lors du changement de mot de passe:", error);
      setSnackbarMessage("Erreur lors du changement de mot de passe.");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={2}>
        <Grid item xs={1}>
          <InputComponent type="text" label="Code" value={uticod} setValue={setCode} />
        </Grid>
        <Grid item xs={2}>
          <InputComponent type="text" label="Email" value={utimail} setValue={setUtimail} />
        </Grid>
        <Grid item xs={1.5}>
          <InputComponent type="text" label="Nom" value={utinom} setValue={setNom} />
        </Grid>
        <Grid item xs={1.5}>
          <InputComponent type="text" label="Prénom" value={utiprn} setValue={setPrenom} />
        </Grid>

        {/* password input removed — use the change-password dialog instead */}
        <Grid item xs={1.5} mt={1}>
          <SelectInputComponent label="Société" value={societe} setValue={setSociete} maplist={socLibs || []} />
        </Grid>
        <Grid item xs={1.5} mt={1}>
          <SelectInputComponent label="Site" value={site} setValue={setSite} maplist={sitLibs || []} />
        </Grid>
        <Grid item xs={1.5} mt={1}>
          <CheckboxComponent label={"Admin"} value={utiadm} setValue={setUtiadm} />
        </Grid>

        {/* change password button */}
        <Grid item xs={3} mt={1}>
          <Button variant="outlined" onClick={openChangePwd} fullWidth>
            Changer le mot de passe
          </Button>
        </Grid>

        {/* For profile view we keep only inputs; image upload is optional */}
        {profil && (
          <Grid item xs={3}>
            <Button variant="outlined" component="label" fullWidth sx={{ textTransform: "none" }}>
              Upload Image
              <input type="file" accept="image/*" hidden onChange={handleImageChange} />
            </Button>
            {imagePreview && (
              <Box mt={2} sx={{ display: "flex", justifyContent: "center" }}>
                <img src={imagePreview} alt="Preview" style={{ maxHeight: 120, objectFit: "cover", borderRadius: 4 }} />
              </Box>
            )}
          </Grid>
        )}
      </Grid>

      <Dialog open={changePwdOpen} onClose={closeChangePwd}sx={{
        '& .MuiDialog-container': {
          alignItems: 'center',
        },
        '& .MuiDialog-paper': {
          margin: { xs: 0, sm: '32px' },
          width: { xs: '30%', sm: 'auto' },
          maxWidth: { xs: '50%', sm: '500px' },
        },
      }}>
        <DialogTitle>Changer le mot de passe</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Ancien mot de passe"
            type="password"
            fullWidth
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Nouveau mot de passe"
            type="password"
            fullWidth
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeChangePwd}>Annuler</Button>
          <Button onClick={handleSavePassword} variant="contained">Enregistrer</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => setSnackbarOpen(false)}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: "100%" }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}