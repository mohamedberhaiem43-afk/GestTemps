import { Alert, Box, Button, Grid, Snackbar } from "@mui/material"
import { QueryClientProvider, QueryClient } from "react-query"
import UserProvider from "../../helper/UserProvider"
import { useState, useEffect } from "react"
import { User, UtilisateurUpdate } from "../../../models/Utilisateur"
import SaisieProfile from "../../DonneeDeBase/Utilisteur/SaisieProfile"
import useGetProfile from "../../../hooks/profileHooks/useGetProfile"
import useUpdateProfile from "../../../hooks/profileHooks/useUpdateProfile"
import BreadcrumbNavigation from "../../helper/BreadcrumbNavigation"

export default function Utilisateur() {
    const queryClient = new QueryClient();
    const [userData, setUserData] = useState<User | null>(null);
    let utilisateurUpdate : UtilisateurUpdate = {
        Utilisateur: {
            uticod: null,
            utinom: null,
            utiprn: null,
            utimps: null,
            utiactif: null,
            utiadm: null,
            utimail: null,
        },
        Moduser: [],
    };
    // Snackbar state
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>( {
        open: false,
        message: "",
        severity: "success",
    });
    const updateUserMutation = useUpdateProfile();

    // fetch profile
    const { data: profile } = useGetProfile();

    useEffect(() => {
        if (profile) {
            setUserData(profile as any);
        }
    }, [profile]);

    const handleUpdate = () => {
        if (userData) {
            utilisateurUpdate.Utilisateur = userData;

            updateUserMutation.mutate(utilisateurUpdate, {
                onSuccess: (response: any) => {
                    setSnackbar({
                        open: true,
                        message: response ? "Utilisateur mis à jour avec succès !" : "Aucune modification apportée.",
                        severity: response ? "success" : "info",
                    });
                },
                onError: () => {
                    setSnackbar({
                        open: true,
                        message: "Erreur lors de la mise à jour.",
                        severity: "error",
                    });
                },
            });
        }
    };

    return (
        <QueryClientProvider client={queryClient}>
            <Box mt={-10} height={'85vh'} maxHeight={'90vh'} width={'95vw'} >
                <BreadcrumbNavigation />
                <UserProvider>
                    <Grid mt={-5}>
                        <Grid item xs={12}>
                            <Button
                                sx={{float: 'right'}}
                                variant="contained"
                                color="primary"
                                onClick={handleUpdate}
                            >
                                Enregistrer
                            </Button>
                            <SaisieProfile
                                onDataChange={setUserData}
                                profil={true}
                                initialData={userData}
                            />
                        </Grid>
                    </Grid>
                </UserProvider>
                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={3000}
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                >
                    <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Box>
        </QueryClientProvider>
    );
}