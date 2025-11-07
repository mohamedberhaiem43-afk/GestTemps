import { Box, Grid, Button, Snackbar, Alert } from "@mui/material";
import SaveIcon from '@mui/icons-material/Save';
import InputComponent from "../../Inputs/Input";
import { useState, useEffect } from "react";
import CheckboxComponent from "../../CheckboxComponent/CheckboxComponent";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import useGetSocLibs from "../../../hooks/societeHooks/useGetSocLibs";
import useGetSiteLibs from "../../../hooks/siteHooks/useGetSiteLibs";
import useAddUser from "../../../hooks/userHooks/useAddUser";
import Utilisateur from "../../../models/Utilisateur";
import { useQuery } from "react-query";
import { useUserContext } from "../../helper/UserProvider";
import UtilisateurService from "../../../services/UtilisateurService/UtilisateurService";
import axios from "axios";

interface SaisieUtilisateurProps {
    onDataChange: (data: any) => void;
    onSave: () => void;
    profil: boolean;
}
interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}
function SaisieUtilisateur({ onDataChange, onSave, profil }: SaisieUtilisateurProps) {
    const [uticod, setCode] = useState("");
    const [utiprn, setPrenom] = useState("");
    const [utinom, setNom] = useState("");
    const [utimail, setUtimail] = useState("");
    const [utimps, setMotPasse] = useState("");
    const [utiadm, setIsAdmin] = useState(false);
    const [societe, setSociete] = useState("");
    const [site, setSite] = useState("");
    const { data: socLibs = [] } = useGetSocLibs();
    const { data: sitLibs = [] } = useGetSiteLibs();
    const { selectedUser } = useUserContext();

    const { error, isLoading } = useAddUser(); 

    // Call onDataChange whenever form data changes
    useEffect(() => {
        onDataChange({
            uticod,
            utinom,
            utiprn,
            utimail,
            utimps,
            utiadm: utiadm ? "1" : "0",
            soccod: societe,
            sitcod: site
        });
    }, [uticod, utinom, utiprn, utimail, utimps, utiadm, societe, site]);


    useQuery<Utilisateur[]>({
    queryKey: ['utilisateur', selectedUser],
    queryFn: async () => {
        if (!selectedUser) return [];
        const result = await UtilisateurService.getWithParams(`get-user/${selectedUser}`);
        setUtimail(result.utimail || "");
        setCode(result.uticod || "");
        setNom(result.utinom || "");
        setPrenom(result.utiprn || "");
        setIsAdmin(result.utiadm === "1");
        setSociete(result.soccod || "");
        setSite(result.sitcod || "");
        return Array.isArray(result) ? result : [result];
    },
    enabled: !!selectedUser,
    });

    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

    const handleSnackbarOpen = (message: string, severity: 'success' | 'error') => {
        setSnackbarMessage(message);
        setSnackbarSeverity(severity);
        setSnackbarOpen(true);
    };

    const handleSnackbarClose = () => {
        setSnackbarOpen(false);
    };

    const handleSave = async () => {
        if (!uticod || !utiprn || !utinom || !utimps || !societe || !site) {
            handleSnackbarOpen('Veuillez remplir tous les champs obligatoires.', 'error');
            return;
        }
        onSave()

        try {
        // 1. Upload image first if it exists
        if (selectedImage) {
            const formData = new FormData();
            formData.append("file", selectedImage); // selectedFile is from input
            await axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/Utilisateurs/upload-profile`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                },
                withCredentials: true, // to include cookies
            });
        }


        handleSnackbarOpen("Utilisateur mis à jour avec succès", "success");
    } catch (err) {
        handleSnackbarOpen("Erreur lors de la mise à jour", "error");
    }

    };
    

    useEffect(() => {
        if (error) {
            const apiError = error as ApiError;
            const errorMessage =
                apiError.response?.data?.message || 
                apiError.message || // Fallback to error.message
                "Erreur lors de l'ajout de l'utilisateur."; 
            handleSnackbarOpen(errorMessage, 'error');
        }
    }, [error]);


    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith("image/")) {
            setSelectedImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setSelectedImage(null);
            setImagePreview(null);
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
                <Grid item xs={1.5}>
                    <InputComponent
                        type="password"
                        label="Mot de Passe"
                        value={utimps}
                        setValue={setMotPasse}
                    />
                </Grid>
                <Grid item xs={1.5} mt={1}>
                    <SelectInputComponent
                        label="Société"
                        value={societe}
                        setValue={setSociete}
                        maplist={socLibs || []}
                    />
                </Grid>
                <Grid item xs={1.5} mt={1}>
                    <SelectInputComponent
                        label="Site"
                        value={site}
                        setValue={setSite}
                        maplist={sitLibs || []}
                    />
                </Grid>
                {profil === false && (
                <>
                    <Grid item xs={1} mt={3}>
                    <CheckboxComponent label="Administrateur" value={utiadm} setValue={setIsAdmin} />
                    </Grid>
                    <Grid item xs={3}>
                    <Button
                        variant="outlined"
                        component="label"
                        fullWidth
                        sx={{ textTransform: 'none' }}
                    >
                        Upload Image
                        <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={handleImageChange}
                        />
                    </Button>
                    {imagePreview && (
                        <Box
                        mt={2}
                        sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            border: '1px dashed #ccc',
                            borderRadius: '8px',
                            padding: 1,
                        }}
                        >
                        <img
                            src={imagePreview}
                            alt="Preview"
                            style={{
                            maxHeight: '120px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            }}
                        />
                        </Box>
                    )}
                    </Grid>
                <Grid item xs={12}>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<SaveIcon />}
                        onClick={handleSave}
                        disabled={isLoading}
                    >
                    </Button>
                </Grid>
                </>
                )}
    

            </Grid>

            {/* Snackbar for notifications */}
            <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleSnackbarClose}>
                <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
}

export default SaisieUtilisateur;
