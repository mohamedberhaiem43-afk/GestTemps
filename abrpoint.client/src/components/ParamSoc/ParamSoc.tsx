import * as React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import General from './General/General';
import ValeurCalcul from './ValeurCalcul/ValeurCalcul';
import ConnPoint from './ConnPoint/ConnPoint';
import Affichage from './Affichage/Affichage';
import SansClassHoraire from './SansClassHoraire/SansClassHoraire';
import { Alert, Button, Snackbar } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import HeureSupp from './HeureSupp/HeureSupp';
import { useEffect, useState } from 'react';
import useUpdateParametres from '../../hooks/parametreHooks/useUpdateParametres';
import { Parametre } from '../../models/Parametre';
import useGetParametres from '../../hooks/parametreHooks/useGetParametres';
import ParTranche from '../../models/ParTranche';
import useUpdateParTranche from '../../hooks/partrancheHooks/useUpdateParTranche';
import useUpdateSocHeures from '../../hooks/societeHooks/useUpdateSocHeures';
import BreadcrumbNavigation from '../helper/BreadcrumbNavigation';
import { useAuth } from '../helper/AuthProvider';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

export default function BasicTabs() {
  // Extract soccod at the top level
  const { soccod } = useAuth();
  
  const [value, setValue] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const [parametreUpdate, setParametreUpdate] = useState<Parametre>({
    soccod: soccod || '',
    paie: '',
    point: '',
    separe: '',
    longbdg: 0,
    ncom: '',
    vitesse: 0,
    parite: 0,
    nbdigit: 0,
    xonoff: '',
    arrondi: 0,
    nbhconge: 0,
    nbhrepos: 0,
    nbhferier: 0,
    fertrv: 0,
    joudeb: '',
    moisdeb: '',
    joufin: '',
    moisfin: '',
    hsuphebd: '',
    nbhtr1: 0,
    tauxtr1: 0,
    nbhtr2: 0,
    tauxtr2: 0,
    nbhtr3: 0,
    tauxtr3: 0,
    nbhtr4: 0,
    tauxtr4: 0,
    billet: '',
    minuit: '',
    parsom: 0,
    parecart: 0,
    nbhdemij: 0,
    arrhsup: 0,
    parnuit: '',
    nuitdeb: '',
    nuitfin: '',
    arrhsortie: 0,
    arrhsmajore: 0,
    arrhentree: 0,
    arrhemajore: 0,
    moinsrepas: 0,
    ajustupd: '',
    sansferie: '',
    affech: '',
    parsem: '',
    planhoraire: '',
    jourrepos: '',
    optimise: new Date(),
    repasnuit: '',
    dtepres: '',
    parferabs: '',
    pardroitnbj: 0,
    parancemp: '',
    hsuphebdm: '',
    nbhtr1M: 0,
    tauxtr1M: 0,
    nbhtr2M: 0,
    tauxtr2M: 0,
    nbhtr3M: 0,
    tauxtr3M: 0,
    nbhtr4M: 0,
    tauxtr4M: 0,
    nbhmax1: 0,
    tauxmax1: 0,
    nbhmax2: 0,
    tauxmax2: 0,
    nbhmax1m: 0,
    tauxmax1m: 0,
    nbhmax2m: 0,
    tauxmax2m: 0,
    parelimftrv: '',
    parmaxfer: 0,
    parminhjour: 0,
    parmaxhjour: 0,
    parpostlundi: '',
    paiearrondi: 0,
    parcadre: '',
    parmaitrise: '',
    parexec: '',
    parjhnlibre: 0,
    parjhslibre: 0,
    parjhnfixe: 0,
    parjhsfixe: 0,
    parreptrv: '',
    parmanuel: '',
    parpaquet: 0,
    parreperiod: '',
    parscomplet: '',
    pardecimal: '',
    parallaite: '',
    parpresence: '',
    parsaisconge: 0,
    parnrepas: '',
    parabsconge: '',
    parhnuitspec: '',
    nuitsdeb: '',
    nuitsfin: '',
    parretabs: '',
  });

  const updateParametreMutation = useUpdateParametres();
  const updateParTrancheMutation = useUpdateParTranche();
  const updateSocHeuresMutation = useUpdateSocHeures();
  
  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    event.preventDefault();
    setValue(newValue);
  };
  
  const [trancheData, setTrancheData] = useState<ParTranche[]>([]);
  const [heureSuppData, setHeureSuppData] = useState<Partial<Parametre>>({});
  const [ConnPointData, setConnPointData] = useState<Partial<Parametre>>({});
  const [valeursCalculs, setValeursCalculs] = useState<Partial<Parametre>>({});
  const [generalData, setGeneralData] = useState<Partial<Parametre>>({});
  const [sansClassHoraireData, setSansClassHoraireData] = useState({});
  const { data: parametres, refetch } = useGetParametres();
  const [affichageData, setAffichageData] = useState<Partial<Parametre>>({});
  const [socHeuresData, setSocHeuresData] = useState<{
    socpresence?: string;
    sochsup?: string;
  }>({});

  const handleUpdate = () => {
    const dataToSend: Parametre = {
      ...parametreUpdate,
      ...heureSuppData,
      ...sansClassHoraireData,
      ...affichageData,
      ...valeursCalculs,
      ...ConnPointData,
      ...generalData,
    };
    
    const trancheDataToSend: ParTranche[] = Object.values(trancheData);

    // Track successful mutations
    let successCount = 0;
    const totalMutations = 3; // parametres, tranches, socheures

    // Update Parametres
    updateParametreMutation.mutate(dataToSend, {
      onSuccess: (response: boolean) => {
        successCount++;
        refetch();
        
        if (successCount === totalMutations) {
          setSnackbar({
            open: true,
            message: "Tous les paramètres ont été mis à jour avec succès !",
            severity: "success",
          });
        }
      },
      onError: () => {
        setSnackbar({
          open: true,
          message: "Erreur lors de la mise à jour des paramètres.",
          severity: "error",
        });
      },
    });

    // Update ParTranche
    updateParTrancheMutation.mutate(trancheDataToSend, {
      onSuccess: () => {
        successCount++;
        
        if (successCount === totalMutations) {
          setSnackbar({
            open: true,
            message: "Tous les paramètres ont été mis à jour avec succès !",
            severity: "success",
          });
        }
      },
      onError: () => {
        setSnackbar({
          open: true,
          message: "Échec de la mise à jour des tranches",
          severity: "error",
        });
      }
    });

    // Update SocHeures (if data exists)
    if (socHeuresData.socpresence || socHeuresData.sochsup) {
      updateSocHeuresMutation.mutate(socHeuresData, {
        onSuccess: () => {
          successCount++;
          
          if (successCount === totalMutations) {
            setSnackbar({
              open: true,
              message: "Tous les paramètres ont été mis à jour avec succès !",
              severity: "success",
            });
          }
        },
        onError: () => {
          setSnackbar({
            open: true,
            message: "Échec de la mise à jour des heures société",
            severity: "error",
          });
        }
      });
    } else {
      // If no socHeures data, decrement expected mutations
      successCount++;
    }
  };

  const mergedGeneralParametre: Partial<Parametre> = {
    ...parametres,
    ...generalData,
  };

  useEffect(() => {
    if (parametres) {
      setParametreUpdate(parametres);
    }
  }, [parametres]);

  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <Box sx={{ width: '100%' }} mt={-10} height={'90vh'} minWidth={'95vw'}>
        {/* Breadcrumb Navigation */}
        <BreadcrumbNavigation />
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
            <Tab label="Général" {...a11yProps(0)} />
            <Tab label="Valeurs de Calcul" {...a11yProps(1)} />
            <Tab label="Connexion Pointeuse" {...a11yProps(2)} />
            <Tab label="Paramétre Sans classe Horaire" {...a11yProps(3)} />
            <Tab label="Heures Sup" {...a11yProps(4)} />
            <Tab label="Affichage" {...a11yProps(5)} />
          </Tabs>
        </Box>
        
        <Button
          sx={{ float: 'right', mb: 2 }}
          variant="contained"
          color="primary"
          onClick={handleUpdate}
  
        >
          Enregistrer
        </Button>

        <CustomTabPanel value={value} index={0}>
          <General
            parametre={mergedGeneralParametre}
            onChange={setGeneralData}
          />
        </CustomTabPanel>
        
        <CustomTabPanel value={value} index={1}>
          <ValeurCalcul parametre={parametres} onChange={(data) => setValeursCalculs(data)} />
        </CustomTabPanel>
        
        <CustomTabPanel value={value} index={2}>
          <ConnPoint parametre={parametres} onChange={setConnPointData} />
        </CustomTabPanel>
        
        <CustomTabPanel value={value} index={3}>
          <SansClassHoraire onChange={setSansClassHoraireData} />
        </CustomTabPanel>
        
        <CustomTabPanel value={value} index={4}>
          <HeureSupp
            onChange={(data) => {
              setHeureSuppData(data);
              setSocHeuresData({
                socpresence: data.socpresence,
                sochsup: data.sochsup,
              });
            }}
            onChange1={(tranches) => setTrancheData(tranches)}
          />
        </CustomTabPanel>
        
        <CustomTabPanel value={value} index={5}>
          <Affichage
            parametre={parametres}
            onChange={(data) => setAffichageData(data)}
          />
        </CustomTabPanel>
        
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity as "success" | "error" | "info" | "warning"}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </QueryClientProvider>
  );
}