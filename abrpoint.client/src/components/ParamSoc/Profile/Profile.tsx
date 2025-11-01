import { Alert, Box, Button, Grid, Snackbar, Typography } from "@mui/material"
import { QueryClientProvider, QueryClient } from "react-query"
import UserProvider from "../../helper/UserProvider"
import { useState } from "react"
import useUpdateUtilisateur from "../../../hooks/utilisateurHookds/useUpdateUtilisateur"
import { User, UtilisateurUpdate } from "../../../models/Utilisateur"
import SaisieUtilisateur from "../../DonneeDeBase/Utilisteur/SaisieUtilisateur"

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
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
        open: false,
        message: "",
        severity: "success",
    });
    const updateUserMutation = useUpdateUtilisateur();

    const handleUpdate = () => {
    if (userData) {
        utilisateurUpdate.Utilisateur = userData;

        updateUserMutation.mutate(utilisateurUpdate, {
            onSuccess: (response:boolean) => {
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
0
    return (
        <QueryClientProvider client={queryClient}>
            <Box sx={{ flexGrow: 1 }} mt={-2} height={'85vh'} maxHeight={'90vh'} width={'95vw'} overflow={'auto'}>
                <Typography fontWeight={'bold'} variant="h6" component="div" gutterBottom color={'primary'} mb={1}>
                    Gestion de Profile
                </Typography>
                <UserProvider>
                    <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <Button
                                    sx={{float: 'right', mb: 2}}
                                    variant="contained" 
                                    color="primary" 
                                    onClick={handleUpdate}
                                    //disabled={updateUserMutation.isLoading}
                                >
                                    Enregistrer
                                </Button>   
                                <SaisieUtilisateur 
                                    onDataChange={setUserData} 
                                    onSave={handleUpdate}
                                    profil={true}
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