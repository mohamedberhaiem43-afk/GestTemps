import { Alert, Box, Button, Grid, Snackbar } from "@mui/material"
import SaisieUtilisateur from "./SaisieUtilisateur"
import ListeUtilisateur from "./ListeUtilisateur."
import DroitAccees from "./DroitAccees"
import { QueryClientProvider, QueryClient } from "react-query"
import UserProvider from "../../helper/UserProvider"
import { useState } from "react"
import useUpdateUtilisateur from "../../../hooks/utilisateurHookds/useUpdateUtilisateur"
import { Moduser } from "../../../models/moduser"
import { User, UtilisateurUpdate } from "../../../models/Utilisateur"
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
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
        open: false,
        message: "",
        severity: "success",
    });
    const [userPermissions, setUserPermissions] = useState<Moduser[]>([]);
    const updateUserMutation = useUpdateUtilisateur();

    const handleUpdate = () => {
    if (userData && userPermissions.length > 0) {
        utilisateurUpdate.Moduser = userPermissions;
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

    return (
        <QueryClientProvider client={queryClient}>
            <Box sx={{ flexGrow: 1 }} mt={-2} height={'85vh'} maxHeight={'90vh'} overflow={'auto'}>
                <BreadcrumbNavigation />
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
                                profil={false}
                                />
                            </Grid>
                            <Grid item xs={7}>
                                <DroitAccees 
                                    onPermissionsChange={setUserPermissions}
                                />
                            </Grid>
                            <Grid item xs={5}>
                                <ListeUtilisateur />
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