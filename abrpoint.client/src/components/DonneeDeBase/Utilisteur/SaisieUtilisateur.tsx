import { Box, Grid, Snackbar, Alert } from "@mui/material";
import InputComponent from "../../Inputs/Input";
import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import CheckboxComponent from "../../CheckboxComponent/CheckboxComponent";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import useGetSocLibs from "../../../hooks/societeHooks/useGetSocLibs";
import useGetSiteLibs from "../../../hooks/siteHooks/useGetSiteLibs";
import useAddUser from "../../../hooks/userHooks/useAddUser";
import Utilisateur from "../../../models/Utilisateur";
import { useQuery } from "react-query";
import { useUserContext } from "../../helper/UserProvider";
import UtilisateurService from "../../../services/UtilisateurService/UtilisateurService";

interface SaisieUtilisateurProps {
    onDataChange: (data: any) => void;
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

export interface SaisieUtilisateurHandle {
    handleSave: () => Promise<void>;
}

const SaisieUtilisateur = forwardRef<SaisieUtilisateurHandle, SaisieUtilisateurProps>(
    ({ onDataChange, profil }, ref) => {
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

    const { mutateAsync: addUser, error } = useAddUser();

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
    if (!uticod || !utiprn || !utinom || !societe || !site) {
        handleSnackbarOpen("Veuillez remplir tous les champs obligatoires.", 'error');
        return;
    }
    try {
        console.log(utimps);
        await addUser({
            user: {
                uticod,
                utinom,
                utiprn,
                utimail,
                utimps,
                utiadm: utiadm ? "1" : "0",
            },
            soccod: societe,
            sitcod: site
        });
        handleSnackbarOpen("Utilisateur enregistré avec succès.", 'success');
    } catch (err) {
        handleSnackbarOpen("Erreur lors de l'enregistrement de l'utilisateur.", 'error');
    }
};

    // Expose handleSave to parent via ref
    useImperativeHandle(ref, () => ({
        handleSave
    }));

    useEffect(() => {
        if (error) {
            const apiError = error as ApiError;
            const errorMessage =
                apiError.response?.data?.message ||
                apiError.message ||
                "Erreur lors de l'ajout de l'utilisateur.";
            handleSnackbarOpen(errorMessage, 'error');
        }
    }, [error]);

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
                        <Grid item xs={3}></Grid>
                    </>
                )}
            </Grid>

            <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleSnackbarClose}>
                <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
});

export default SaisieUtilisateur;