import { List, ListItem, ListItemText, Paper, Typography } from "@mui/material";
import { LogEntry } from "../../../hooks/pointeuseHooks/useGetPointages";

interface PointageListProps {
  logs: LogEntry[];
}

function PointageList({ logs }: PointageListProps) {
  return (
    <Paper sx={{ p: 2, maxHeight: "70vh", overflowY: "auto" }}>
      <Typography variant="h6" gutterBottom>
        Liste des pointages
      </Typography>
      <List>
        {logs.length > 0 ? (
          logs.map((item, index) => (
            <ListItem key={index} divider>
              <ListItemText
                primary={`Employé: ${item.employe_code} ${item.user_name}`}
                secondary={`Heure: ${item.time}`}
              />
            </ListItem>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            Aucun pointage trouvé
          </Typography>
        )}
      </List>
    </Paper>
  );
}

export default PointageList;
