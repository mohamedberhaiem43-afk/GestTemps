import { List, ListItem, ListItemText, Paper, Typography } from "@mui/material";
import { LogEntry } from "../../../hooks/pointeuseHooks/useGetPointages";

interface PointageListNonInscritProps {
  logs: LogEntry[];
}

function PointageListNonInscrit({ logs }: PointageListNonInscritProps) {
  return (
    <Paper sx={{ p: 2, maxHeight: "70vh", overflowY: "auto" }}>
      <Typography variant="h6" gutterBottom>
        Pointages non inscrits
      </Typography>
      <List>
        {logs.length > 0 ? (
          logs.map((item, index) => (
            <ListItem key={index} divider>
              <ListItemText
                primary={`Employé ID: ${item.employe_code}`}
                secondary={`Heure: ${item.time}`}
              />
            </ListItem>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            Aucun pointage non inscrit trouvé
          </Typography>
        )}
      </List>
    </Paper>
  );
}

export default PointageListNonInscrit;
