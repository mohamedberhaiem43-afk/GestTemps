import { Box, Grid, Snackbar, Alert } from "@mui/material";
import { useState } from "react";
import LectureList from "./LectureList";
import PointageList from "./PointageList";
import PointageListNonInscrit from "./PointageListNonInscrit";
import { LogEntry } from "../../../hooks/pointeuseHooks/useGetPointages";
import PointageEntryService from "../../../services/PointeuseService/PointageEntryService";
import BreadcrumbNavigation from "../../helper/BreadcrumbNavigation";
import { useAuth } from "../../helper/AuthProvider";
import AccessDenied from "../../helper/AccessDenied";

function Lecture() {
  const { hasPermission } = useAuth();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");

  // ✅ Lift logs to state
  const [withName, setWithName] = useState<LogEntry[]>([]);
  const [withoutName, setWithoutName] = useState<LogEntry[]>([]);

  const handleSelectionChange = async (pointeuseIps: string[]) => {
    if (!pointeuseIps || pointeuseIps.length === 0) {
      return;
    }

    try {
      const query = pointeuseIps.map(ip => `poicods=${encodeURIComponent(ip)}`).join("&");
      const response = await PointageEntryService.getWithParams(`get-pointages?${query}`);

      // ✅ Use response.data instead of 'data' (was undefined)
      const logs: LogEntry[] = response?.data ?? [];
      setWithName(logs.filter(log => log.user_name));
      setWithoutName(logs.filter(log => !log.user_name));

    } catch (err) {
      setSnackbarMsg("Erreur lors de l'appel à l'API !");
      setSnackbarOpen(true);
    }
  };

  if (!hasPermission('Pointage et Temps', 'consult')) {
    return <AccessDenied message="Vous n'avez pas le droit de consulter la lecture des pointages." />;
  }

  return (
    <Box width="95vw" height="85vh" >
      <BreadcrumbNavigation />
      <Grid container spacing={2}>
        <Grid item xs={7}>
          <LectureList onSelectionChange={handleSelectionChange} />
        </Grid>
        <Grid item xs={3}>
          <PointageList logs={withName} />
        </Grid>
        <Grid item xs={2}>
          <PointageListNonInscrit logs={withoutName} />
        </Grid>
      </Grid>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="error" sx={{ width: "100%" }}>
          {snackbarMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Lecture;
