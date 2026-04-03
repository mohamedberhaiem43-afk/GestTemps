import { Box, Button, Grid, IconButton, Typography } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { useContext, useState } from "react";
import { Poste } from "../../../models/Poste";
import { ClasseHoraireProvider } from "../ClasseHoraireContext";
import SaisiePoste from "../../PosteTravail/SaisiePoste";
import PosteTable from "../../PosteTravail/PosteTable";
import { PosteContext, PosteProvider } from "./PostContext";
import PosteList from "../../PosteTravail/PosteTable";

// Create a separate context provider for the PosteDeTravail component
const PosteDeTravailProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedPoste, setSelectedPoste] = useState<Poste | undefined>(undefined);

  const resetPoste = () => {
    setSelectedPoste(undefined);
  };

  return (
    <PosteContext.Provider value={{ selectedPoste, setSelectedPoste, resetPoste }}>
      {children}
    </PosteContext.Provider>
  );
};

export default function PosteDeTravail() {
  const posteContext = useContext(PosteContext);
  
  // Initialize scheduleData with sample data structure
  const [scheduleData, setScheduleData] = useState([
    { jour: 'Lundi', DebutEntree: '', Entrée: '', FinEntree: '', Sortie: '', repasBonus: '0', repos: '0' },
    { jour: 'Mardi', DebutEntree: '', Entrée: '', FinEntree: '', Sortie: '', repasBonus: '0', repos: '0' },
    { jour: 'Mercredi', DebutEntree: '', Entrée: '', FinEntree: '', Sortie: '', repasBonus: '0', repos: '0' },
    { jour: 'Jeudi', DebutEntree: '', Entrée: '', FinEntree: '', Sortie: '', repasBonus: '0', repos: '0' },
    { jour: 'Vendredi', DebutEntree: '', Entrée: '', FinEntree: '', Sortie: '', repasBonus: '0', repos: '0' },
    { jour: 'Samedi', DebutEntree: '', Entrée: '', FinEntree: '', Sortie: '', repasBonus: '0', repos: '0' },
    { jour: 'Dimanche', DebutEntree: '', Entrée: '', FinEntree: '', Sortie: '', repasBonus: '0', repos: '0' },
  ]);

  const handleScheduleChange = (index: number, field: string, value: any) => {
    setScheduleData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  return (
    <Box>
      <Grid container spacing={0.5} height={'85vh'} mt={-1}>
        {/* Center the Typography element */}
        <Grid item xs={12}>
          <Typography fontWeight={'bold'} variant="h6" sx={{ textAlign: 'center'}} color={'primary'} mb={3}>
            Gestion poste de Travail
          </Typography>
        </Grid>

        {/* Use LposteProvider and PosteProvider to wrap your components */}
        <ClasseHoraireProvider>
          <PosteProvider>
            <PosteDeTravailProvider>
              <Grid item xs={9}>
                <SaisiePoste />
              </Grid>

              <Grid item xs={3} sx={{mt:-2}}>
                <PosteTable 
                  scheduleData={scheduleData}
                  onChange={handleScheduleChange}
                />
              </Grid>
              
              <Grid item xs={5} sx={{mt:-2}}>
                <PosteList 
                  scheduleData={scheduleData}
                  onChange={handleScheduleChange}
                />
              </Grid>
              
              <Grid item xs={1.5} display={'flex'} justifyContent={'space-around'}>
                <Grid>
                  <IconButton color="primary">
                    <SaveIcon />
                  </IconButton>
                </Grid>
                <Grid>
                  <Button color="secondary" onClick={() => posteContext?.resetPoste()}>
                    Nouveau
                  </Button>
                </Grid>
              </Grid>
            </PosteDeTravailProvider>
          </PosteProvider>
        </ClasseHoraireProvider>
      </Grid>
    </Box>
  );
}