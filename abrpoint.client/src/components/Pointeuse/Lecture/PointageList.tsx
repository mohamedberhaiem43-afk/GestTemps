import { List, ListItem, ListItemText, Paper, Typography } from "@mui/material";
import { LogEntry } from "../../../hooks/pointeuseHooks/useGetPointages";

interface PointageListProps {
  logs: LogEntry[];
}

// PERF — Cap d'affichage : au-delà de 500 lignes, on tronque côté UI et on indique
// le débordement. La vraie pagination doit être faite côté API quand un tenant
// atteint régulièrement ce volume. Évite de bourrer le DOM avec des milliers de
// <ListItem> qui rendent le scroll saccadé.
const RENDER_CAP = 500;

function PointageList({ logs }: PointageListProps) {
  const visible = logs.slice(0, RENDER_CAP);
  const overflow = logs.length > RENDER_CAP;

  return (
    <Paper sx={{ p: 2, maxHeight: "70vh", overflowY: "auto" }}>
      <Typography variant="h6" gutterBottom>
        Liste des pointages
      </Typography>
      <List>
        {visible.length > 0 ? (
          visible.map((item) => (
            // PERF — `key` stable basée sur (employe_code, time) au lieu de l'index :
            // évite les unmount/remount au tri/filtre + préserve le scroll.
            <ListItem key={`${item.employe_code}-${item.time}`} divider>
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
      {overflow && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Affichage limité aux {RENDER_CAP} premières lignes ({logs.length} au total). Affinez vos filtres pour voir le reste.
        </Typography>
      )}
    </Paper>
  );
}

export default PointageList;
