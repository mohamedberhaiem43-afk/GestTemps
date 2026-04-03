import { Alert, Box, Button, Grid, Snackbar } from "@mui/material"
import SaisieUtilisateur, { SaisieUtilisateurHandle } from "./SaisieUtilisateur"
import ListeUtilisateur from "./ListeUtilisateur."
import DroitAccees from "./DroitAccees"
import { QueryClientProvider, QueryClient } from "react-query"
import UserProvider, { useUserContext } from "../../helper/UserProvider"
import { useRef, useState } from "react"
import useUpdateUtilisateur from "../../../hooks/utilisateurHookds/useUpdateUtilisateur"
import { Moduser } from "../../../models/moduser"
import { User, UtilisateurUpdate } from "../../../models/Utilisateur"
import BreadcrumbNavigation from "../../helper/BreadcrumbNavigation"

// ── Inner component: has access to UserProvider context ──────────────────────
function UtilisateurContent() {
    const { selectedUser } = useUserContext();
    const saisieRef = useRef<SaisieUtilisateurHandle>(null);
    const [userData, setUserData] = useState<User | null>(null);
    const isAdmin = userData?.utiadm === "1"; // ← new

    const [userPermissions, setUserPermissions] = useState<Moduser[]>([]);
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: "success" | "error" | "info";
    }>({ open: false, message: "", severity: "success" });

    const updateUserMutation = useUpdateUtilisateur();

    const handleSave = async () => {
        if (selectedUser) {
            // Existing user → update
            if (!userData || userPermissions.length === 0) return;

            const utilisateurUpdate: UtilisateurUpdate = {
                Utilisateur: userData,
                Moduser: userPermissions,
            };

            updateUserMutation.mutate(utilisateurUpdate, {
                onSuccess: (response: boolean) => {
                    setSnackbar({
                        open: true,
                        message: response
                            ? "Utilisateur mis à jour avec succès !"
                            : "Aucune modification apportée.",
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
        } else {
            // New user → add via SaisieUtilisateur ref
            await saisieRef.current?.handleSave();
        }
    };

    return (
        <Grid container spacing={2}>
            <Grid item xs={12}>
                <Button
                    sx={{ float: 'right', mb: 2 }}
                    variant="contained"
                    color="primary"
                    onClick={handleSave}
                    disabled={updateUserMutation.isLoading}
                >
                    Enregistrer
                </Button>
                <SaisieUtilisateur
                    ref={saisieRef}
                    onDataChange={setUserData}
                    profil={false}
                />
            </Grid>
            <Grid item xs={7}>
                <DroitAccees onPermissionsChange={setUserPermissions} isAdmin={isAdmin} />
            </Grid>
            <Grid item xs={5}>
                <ListeUtilisateur />
            </Grid>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Grid>
    );
}

// ── Outer component: just sets up providers ──────────────────────────────────
export default function Utilisateur() {
    const queryClient = new QueryClient();

    return (
        <QueryClientProvider client={queryClient}>
            <Box sx={{ flexGrow: 1 }} mt={-2} height={'85vh'} maxHeight={'90vh'} overflow={'auto'}>
                <BreadcrumbNavigation />
                <UserProvider>
                    <UtilisateurContent />
                </UserProvider>
            </Box>
        </QueryClientProvider>
    );
}