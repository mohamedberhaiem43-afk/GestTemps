import { Alert, Box, Grid, Snackbar, Typography } from "@mui/material";
import SaisieUtilisateur from "./SaisieUtilisateur";
import ListeUtilisateur from "./ListeUtilisateur.";
import { QueryClientProvider, QueryClient } from "react-query";
import UserProvider from "../../helper/UserProvider";
import { useState } from "react";
import { User } from "../../../models/Utilisateur";
import PointeuseAccees from "./PointeuseAccees";
import Poidroit, { UpdatePoidroit } from "../../../models/Poidroit";
import useUpdatePointdroit from "../../../hooks/pointeuseHooks/useUpdatePointroits";

export default function DroitAccessPointeuse() {
  const queryClient = new QueryClient();
  const [userData, setUserData] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<Poidroit[]>([]);
  const updatePointdroitMutation = useUpdatePointdroit();

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

const handleUpdate = () => {
  if (userData && userPermissions.length > 0) {
    const soccod = sessionStorage.getItem("soccod") ?? "";

    // Prepare the list of Pointdroits to send
    const payload: UpdatePoidroit[] = userPermissions.map((perm) => ({
      soccod,
      uticod: userData.uticod ?? "",
      poicod: perm.poicod ?? "",
      lire: perm.lire,
      config: perm.config,
      purger: perm.purger,
    }));
    updatePointdroitMutation.mutate(payload, {
      onSuccess: (response: boolean) => {
        setSnackbar({
          open: true,
          message: response
            ? "Droits mis à jour avec succès !"
            : "Aucune modification apportée.",
          severity: response ? "success" : "info",
        });
      },
      onError: () => {
        setSnackbar({
          open: true,
          message: "Erreur lors de la mise à jour des droits.",
          severity: "error",
        });
      },
    });
  }
};


  return (
    <QueryClientProvider client={queryClient}>
      <Box sx={{ flexGrow: 1 }} mt={-2} height={"85vh"} maxHeight={"90vh"} overflow={"auto"}>
        <Typography fontWeight={"bold"} variant="h6" component="div" gutterBottom color={"primary"} mb={1}>
          Droit d'accès pointeuse
        </Typography>
        <UserProvider>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <SaisieUtilisateur onDataChange={setUserData} state={true} onSave={handleUpdate} />
            </Grid>
            <Grid item xs={7}>
              <PointeuseAccees onPermissionsChange={setUserPermissions} />
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
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </QueryClientProvider>
  );
}
