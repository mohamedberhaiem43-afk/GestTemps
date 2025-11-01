import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { useState, useEffect } from 'react';
import { Typography } from '@mui/material';
import BasicBars from './Bars/Bars';
import BasicPie from '../BasicPie/BasicPie';
import DepassMaxTable from './EmpDepassMax';
import EcheanceContratList from '../Etats/EchanceContrat/EcheanceContratList';
import DemCongeList from '../gestionEmploye/gestionConge/DemConge/DemCongeList';
import { Item } from '../helper/Item/Item';
import { QueryClient, QueryClientProvider } from 'react-query';
import useGetStatistics from '../../hooks/employeHooks/useGetStatistics';

interface formattedData {
  label: string;
  value: number;
}



export default function DashboardPage() {
  const [sexStat, setSexStat] = useState<formattedData[]>([]);
  const [totalEffectif, setTotalEffectif] = useState(0);

  const { data: empStat = [], isLoading, error } = useGetStatistics();

  // Compute total effectif whenever empStat changes
  useEffect(() => {
    if (empStat && empStat.length > 0) {
      const total = empStat.reduce((acc, cur) => acc + (cur.totalCount || 0), 0);
      setTotalEffectif(total);
    } else {
      setTotalEffectif(0);
    }
  }, [empStat]);

  // Compute sex statistics
  useEffect(() => {
    if (empStat && empStat.length > 0) {
      const sexeCounts: Record<string, number> = { M: 0, F: 0 };
      empStat.forEach((item: any) => {
        if (item.sexe) {
          sexeCounts[item.sexe] = item.count || 0;
        }
      });

      const formatted = Object.entries(sexeCounts).map(([label, value]) => ({
        label: label === 'F' ? 'Féminin' : label === 'M' ? 'Masculin' : 'Inconnu',
        value,
      }));

      setSexStat(formatted);
    }
  }, [empStat]);

  const queryClient = new QueryClient();

  if (isLoading) return <Typography>Chargement des statistiques...</Typography>;
  if (error) return <Typography color="error">Erreur lors du chargement des données</Typography>;

  return (
    <QueryClientProvider client={queryClient}>
      <Box width="95vw" height="85vh">
        <Grid container spacing={1}>
          <Grid item xs={8}>
            <Item>
              <Box display="flex" flexDirection="column" alignItems="center">
                <Box display="flex" justifyContent="space-around" width="100%">
                  <BasicBars
                    cadrhor={empStat['2']?.horaire ?? 0}
                    cadrmen={empStat['2']?.mensuelle ?? 0}
                    maihor={empStat['1']?.horaire ?? 0}
                    maimen={empStat['1']?.mensuelle ?? 0}
                    exhor={empStat['0']?.horaire ?? 0}
                    exmen={empStat['0']?.mensuelle ?? 0}
                  />
                  <BasicPie data={sexStat} />
                </Box>
                <Typography variant="h6" fontSize="larger">
                  Effectif Total: {totalEffectif}
                </Typography>
              </Box>
            </Item>
          </Grid>

          <Grid item xs={4}>
            <Item>
              <DepassMaxTable />
            </Item>
          </Grid>

          <Grid item xs={6}>
            <EcheanceContratList />
          </Grid>
          <Grid item xs={6}>
            <DemCongeList />
          </Grid>
        </Grid>
      </Box>
    </QueryClientProvider>
  );
}
