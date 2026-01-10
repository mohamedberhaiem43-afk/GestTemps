import * as React from 'react';
import { createTheme } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { AppProvider, Router, Session } from '@toolpad/core/AppProvider';
import { DashboardLayout } from '@toolpad/core';
import { Accessible, AccessTime, AccountBalance, AccountCircle, AdminPanelSettings, Assessment, AttachMoney, Autorenew, Chat, DevicesOther, Domain, EventNote, HolidayVillageRounded, Insights, Money, MoneyOffCsredSharp, Settings, SyncAlt, WorkOutline} from '@mui/icons-material';
import { Box } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { Filiale } from '../DonneeDeBase/Filiale/Filiale';
import { Fonction } from '../DonneeDeBase/Fonction/Fonction';
import CategoryIcon from '@mui/icons-material/Category';
import BusinessIcon from '@mui/icons-material/Business';
import MapIcon from '@mui/icons-material/Map';
import FlagIcon from '@mui/icons-material/Flag';
import PersonIcon from '@mui/icons-material/People';
import PeopleIcon from '@mui/icons-material/Person';
import StorageIcon from '@mui/icons-material/Storage';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import BasicTabs from '../ParamSoc/ParamSoc';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import AssignmentIcon from '@mui/icons-material/Assignment';
import Allaitement from '../gestionEmploye/Allaitement/Allaitement';
import GestionContrats from '../gestionEmploye/GestionContrats/GestionContrats';
import ClasseHoraire from '../ClasseHoraire/ClasseHoraire';
import CredentialsSignInPage from '../Login/Login';
import IntituleDesAbsences from '../ClasseHoraire/IntituleDesAbsences/IntituleDesAbsences';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import Repos from '../ClasseHoraire/Repos/Repos';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import JourDeCompensation from '../gestionEmploye/gestionAbsence/jourCompensation/JourCompensation';
import AutSortie from '../gestionEmploye/gestionAbsence/jourCompensation/AutSortie/AutSortie';
import AbsanceSanction from '../gestionEmploye/gestionAbsence/jourCompensation/AbsenceSanction/AbsanceSanction';
import { Gavel,} from '@mui/icons-material';
import Direction from '../DonneeDeBase/Direction/Direction';
import Pays from '../DonneeDeBase/Pays/Pays';
import Ville from '../DonneeDeBase/Ville/Ville';
import Service from '../DonneeDeBase/Service/Service';
import { Fingerprint } from '@mui/icons-material';
import Pointeuse from '../Pointeuse/Pointeuse';
import AutSortieGenerale from '../gestionEmploye/gestionAbsence/jourCompensation/AutSortieGenerale/AutSortieGenerale';
import DashboardPage from '../Dashboard/Dashboard';
import EtatPeriodique from '../Pointeuse/EtatPeriodique/EtatPeriodique';
import './navigation.css'
import RenouvellementContrat from '../gestionEmploye/GestionContrats/Renouvellement/RenouvellementContrat';
import Utilisateur from '../DonneeDeBase/Utilisteur/Utilisateur';
import DemConge from '../gestionEmploye/gestionConge/DemConge/DemConge';
import SoldeConge from '../gestionEmploye/gestionConge/SoldeConge/SoldeConge';
import TitreConge from '../gestionEmploye/gestionConge/TitreConge/TitreConge';
import CongeGneral from '../gestionEmploye/gestionConge/TitreCongeGeneral/CongeGeneral';
import { useRef } from 'react';
import { Societe } from '../DonneeDeBase/Societe/Societe';
import { CalendarIcon } from '@mui/x-date-pickers';
import Calendrier from '../ParamSoc/Calendrier/Calendrier';
import Rubrique from '../DonneeDeBase/Rubrique/Rubrique';
import Section from '../DonneeDeBase/Section/Section';
import Accompte from '../PreparationPaie/Accompte/Accompte';
import PointageDuMois from '../PreparationPaie/PointageDuMois/PointageDuMois';
import EtatDroitConge from '../PreparationPaie/DroitConge/EtatDroitConge';
import profileImage from '../../assets/ProfileImage.png';
import { QueryClient, QueryClientProvider } from 'react-query';
import EcheanceContrat from '../Etats/EchanceContrat/EcheanceContrat';
import EtatPresence from '../Etats/EtatPresence/EtatPresence';
import EtatRetard from '../Etats/EtatRetard/EtatRetard';
import EtatAbsence from '../Etats/EtatAbsence/EtatAbsence';
import EmployeComponent from '../gestionEmploye/Employe';
import CahierConge from '../Etats/CahierConge/CahierConge';
import Main from '../PosteTravail/Main';
import Lecture from '../Pointeuse/Lecture/Lecture';
import DroitAccessPointeuse from '../Admin/PointeuseAccees/DroitAcceesPointeuse';
import Profile from '../ParamSoc/Profile/Profile';
import Optimisation from '../Pointeuse/Optimisation/Optimisation';
import SocieteImage from '../../assets/Societe.png';
import { useAuth } from '../helper/AuthProvider';
import GeminiChat from '../helper/Chatbot/GeminiChat';

interface DemoProps {
    window?: () => Window;
}

interface DemoPageContentProps {
    pathname: string;
}
const NAVIGATION = [
  {
    segment: 'dashboard',
    title: 'Dashboard',
    icon: <DashboardIcon />,
   
  },
  {
    segment: 'dashboard',
    title: 'Donnée De Base',
    style: { fontSize: '1px' },

    icon: <StorageIcon  />,
    children: [
      {
        segment: 'gestion-societe',
        title: 'Société',
        icon: <Domain />,
      },
      {
        segment: 'direction',
        title: 'Direction',
        icon: <LocationCityIcon />,
      },
      {
        segment: 'service',
        title: 'Service',
        icon: <BusinessIcon />,

      },
      {
        segment: 'section',
        title: 'Section',
        icon: <CategoryIcon />, // New icon for Section
      },
      {
        segment: 'filiale',
        title: 'Filiale',
        icon: <FlagIcon />, // New icon for Filiale
      },
      {
        segment: 'pays',
        title: 'Pays',
        icon: <MapIcon />, // New icon for Pays
      },
      {
        segment: 'ville',
        title: 'Ville',
        icon: <LocationCityIcon />, // New icon for Ville
      },
      {
        segment: 'fonction',
        title: 'Fonction',
        icon: <PeopleIcon />, // New icon for Fonction
      },
      {
        segment: 'rubrique',
        title: 'Rubrique',
        icon: <AttachMoney />, // New icon for Fonction
      },
    ],
  },
  {
    segment: 'dashboard',
    title: 'Administrateur',
    style: { fontSize: '1px' },

    icon: <AdminPanelSettings  />,
    children: [
      {
        segment: 'gestion-utilisateur',
        title: 'Utilisateurs',
        icon: <AccountCircle />,
      },
      {
        segment: 'droit-accees',
        title: "Droit d'accées",
        icon: <Accessible />,
      },
    ],
  },
  {
  segment: 'dashboard',
      title: 'Pointeuse',
      icon: <Fingerprint />,
      children: [
      {
        segment: 'lecture-pointeuse',
        title: 'Lecture Pointeuses',
        icon: <SyncAlt />, // ou <CloudSync /> pour synchronisation/lecture
      },
      {
        segment: 'liste-pointeuse',
        title: 'Liste Pointeuses',
        icon: <DevicesOther />, // ou <Devices /> pour liste d'appareils
      },
      {
        segment: 'optimisation-pointage',
        title: 'Optimisation Pointage',
        icon: <DevicesOther />, // ou <Speed /> pour optimisation
      },
      {
        segment: 'etat-periodique',
        title: 'Etat Périodique',
        icon: <Assessment />, // ou <BarChart /> pour rapports/états
      },
    ]
  },

  {
    segment: 'dashboard',
    title: 'Employé',
    icon: <PersonIcon  />,
    children: [
      
      {
        segment: 'gestion-employe',
        title: 'Gestion Des Employés',
        icon: <PeopleIcon />,
      },
      {
      segment: 'contrat',
      title: 'Contrat',
      icon: <AssignmentIcon  />,
      children: [
        {
          segment: 'contrat',
          title: 'Gestion Des Contrats',
          icon: <AssignmentIcon />,
        },
        {
          segment: 'renouvellement-contrat',
          title: 'Renouvellement',
          icon: <Autorenew  />,
        },
      ]
    },
     
     
      {
        segment: 'allaitement',
        title: 'Allaitement',
        icon: <FamilyRestroomIcon />,

      },
      {
        segment: '',
        title: 'Conge',
        icon: <PersonIcon  />,
        children:[
          {
            segment: 'gestion-de-conge',
            title: 'Demande De Conge',
            icon: <FamilyRestroomIcon />,
    
          },
          {
            segment: 'gestion-de-solde',
            title: 'Solde De Conge',
            icon: <CalendarTodayIcon />,
    
          },
          {
            segment: 'titre-de-conge',
            title: 'Titre De Conge',
            icon: <CalendarTodayIcon />,
    
          },
          {
            segment: 'titre-de-conge-general',
            title: 'Conge Géneral',
            icon: <CalendarTodayIcon />,
    
          },
        ]
      },
      {
        segment: '',
        title: 'Absences',
        icon: <PersonIcon  />,
        children:[
          {
            segment: 'jour-de-compensation',
            title: 'Jour Compensation',
            icon: <FamilyRestroomIcon />,
    
          },
          {
            segment: 'autorisation-de-sortie',
            title: 'Autorisation Sortie',
            icon: <WorkOutline />,
          },
          {
            segment: 'autorisation-de-sortie-generale',
            title: 'Sortie Génerale',
            icon: <WorkOutline />,
          },
          {
            segment: 'absence-et-sanction',
            title: 'Absence et Sanction',
            icon: <Gavel />,
          },
        ]
      }

    ],
  },
  {
    segment: 'dashboard',
    title: 'Classe Horaire',
    icon: <Settings />,
    children: [
      {
        segment: 'saisie-classe-horaire',
        title: 'Classe Horaire',
        icon: <CorporateFareIcon  />,
      },
      {
        segment: 'saisie-poste-de-travail',
        title: 'Poste de Travail',
        icon: <CorporateFareIcon  />,
      },
      {
        segment: 'intitule-des-absences',
        title: "Natures d'absences",
        icon: <EventBusyIcon  />,
      },
      {
        segment: 'Repos',
        title: 'Jours Fériés',
        icon: <HolidayVillageRounded  />,
      },
    ],
  },
  {
    segment: 'dashboard',
    title: 'Préparation paie',
    icon: <Money  />,
    children: [
      {
        segment: 'accompte-salaire',
        title: 'Accompte sur salaire',
        icon: <MoneyOffCsredSharp />,
      },
      {
        segment: 'pointage-du-mois',
        title: 'Pointage du mois',
        icon: <MoneyOffCsredSharp />,
      },
      {
        segment: 'droit-de-conge',
        title: 'Droit de Congé',
        icon: <MoneyOffCsredSharp />,
      },
    ],
    
  },
  {
    segment: 'dashboard',
    title: 'Etats',
    icon: <Insights  />,
    children: [
      {
        segment: 'etat-de-presence',
        title: 'Etat de Présence',
        icon: <PeopleIcon  />,
      },
      {
        segment: 'etat-de-retard',
        title: 'Etat de Retard',
        icon: <AccessTime  />,
      },
      {
        segment: 'etat-des-absences',
        title: 'Etat des Absences',
        icon: <AccessTime  />,
      },
      {
        segment: 'echeance-contrat',
        title: 'Echéance de Contrat',
        icon: <EventNote  />,
      },
      {
        segment: 'cahier-conge',
        title: 'Cahier de Congé',
        icon: <EventNote  />,
      },
    ]
  },
  {
    segment: 'dashboard',
    title: 'Paramétre Société',
    icon: <Settings  />,
    children: [
      {
        segment: 'profile',
        title: 'Profile',
        icon: <AccountBalance  />,
      },
      {
        segment: 'societe',
        title: 'Paramétre Société',
        icon: <CorporateFareIcon  />,
      },
      {
        segment: 'calendrier-societe',
        title: 'Calendrier Société',
        icon: <CalendarIcon  />,
      },
      {
        segment: 'chat-bot',
        title: 'Chat Bot',
        icon: <Chat  />,
      },
    ]
  },
  
]
  





const queryClient = new QueryClient();

function DemoPageContent({ pathname }: DemoPageContentProps) {
    let content;

    switch (pathname) {
        case '/':
            content = <CredentialsSignInPage />;
            break;
        case '/dashboard':
            content = <DashboardPage />;
            break;
        case '/dashboard/direction':
            content = <Direction />;
            break;
        case '/dashboard/service':
            content = <Service />;
            break;
        case '/dashboard/ville':
            content = <Ville />;
            break;
        case '/dashboard/filiale':
            content = <Filiale />;
            break;
        case '/dashboard/rubrique':
            content = <Rubrique />;
            break;
        case '/dashboard/lecture-pointeuse':
            content = <Lecture />;
            break;
        case '/dashboard/liste-pointeuse':
            content = <Pointeuse />;
            break;
        case '/dashboard/optimisation-pointage':
            content = <Optimisation />;
            break;
        case '/dashboard/etat-periodique':
            content = <EtatPeriodique />;
            break;
        case '/dashboard/etat-de-presence':
            content = <EtatPresence />;
            break;
        case '/dashboard/etat-de-retard':
            content = <EtatRetard />;
            break;
        case '/dashboard/etat-des-absences':
            content = <EtatAbsence />;
            break;
        case '/dashboard/echeance-contrat':
            content = <EcheanceContrat />;
            break;
        case '/dashboard/cahier-conge':
            content = <CahierConge />;
            break;
        case '/dashboard/accompte-salaire':
          content = <Accompte />;
          break;
        case '/dashboard/pointage-du-mois':
          content = <PointageDuMois />;
          break;
        case '/dashboard/droit-de-conge':
          content = <EtatDroitConge />;
          break;
        case '/dashboard/section':
            content = <Section />;
            break;
        case '/dashboard/pays':
            content = <Pays />;
            break;
        case '/dashboard/fonction':
            content = <Fonction />;
            break;
        case '/dashboard/gestion-employe':
            content =<EmployeComponent />;
            break;
        case '/dashboard/gestion-utilisateur':
            content = <Utilisateur />;
            break;
        case '/dashboard/droit-accees':
            content = <DroitAccessPointeuse />;
            break;
        case '/dashboard/gestion-societe':
            content = <Societe />;
            break;
        case '/dashboard/profile':
            content = <Profile />;
            break;
        case '/dashboard/societe':
            content = 
            <>
            <QueryClientProvider client={queryClient}>
              <BasicTabs />
            </QueryClientProvider>
            </>
            break;
        case '/dashboard/allaitement':
            content = <Allaitement />;
            break;
        case '/dashboard/contrat/contrat':
            content = <GestionContrats />;
            break;
        case '/dashboard/contrat/renouvellement-contrat':
            content = <RenouvellementContrat />;
            break;
        case '/dashboard/saisie-classe-horaire':
            content = <ClasseHoraire />
            break;
        case '/dashboard/saisie-poste-de-travail':
            content = <Main />;
            break;
        case '/dashboard/Repos':
            content = <Repos />;
            break;
        case '/dashboard/intitule-des-absences':
            content = <IntituleDesAbsences />;
            break;
        case '/dashboard/absence-et-sanction':
            content = <AbsanceSanction />;
            break;
        case '/dashboard/gestion-de-conge':
          
            content =<DemConge />;
            break;
        case '/dashboard/titre-de-conge':
            content = <TitreConge />;
            break;
        case '/dashboard/titre-de-conge-general':
            content = <CongeGneral />;
            break;
        case '/dashboard/jour-de-compensation':
            content = <JourDeCompensation />;
            break;
        case '/dashboard/autorisation-de-sortie':
            content = <AutSortie />;
            break;
        case '/dashboard/autorisation-de-sortie-generale':
            content = <AutSortieGenerale />;
            break;
        case '/dashboard/gestion-de-solde':
            content = <SoldeConge />;
            break;
        case '/dashboard/calendrier-societe':
            content = <Calendrier />;
            break;
        case '/dashboard/chat-bot':
            content = <GeminiChat />;
            break;
    }

    return (
      <Box
      sx={{
        py: 4,
        px: { xs: 2, sm: 3, md: 4 }, // Responsive padding
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        width: '100%',
        }}
      >
        {content}
      </Box>
    );
}

const demoTheme = createTheme({
  palette: {
    mode: 'light',
  },

  breakpoints: {
    values: {
      xs: 200,
      sm: 0,
      md: 0,
      lg: 0,
      xl: 0
    },
  },
});

export default function DashboardLayoutAccount(props: DemoProps) {
    const { window } = props;
    const navigate = useNavigate();
    const location = useLocation();
    const { userName, soclib } = useAuth();
    const headerRef = useRef<HTMLElement | null>(null);
    headerRef.current = document.querySelector(
      "#root > div.MuiBox-root.css-k008qs > header > div > div.MuiBox-root.css-wxgfmz > a > div > h6"
    );
    const [session, setSession] = React.useState<Session | null>(
      userName ? {
        user: {
          name: userName,
          image: profileImage,
        },
      } : null
    );

    // Update session when userName changes
    React.useEffect(() => {
      if (userName) {
        setSession({
          user: {
            name: userName,
            image: profileImage,
          },
        });
      } else {
        setSession(null);
      }
    }, [userName]);
    const authentication = React.useMemo(() => {
      return {
        signIn: () => {
          // The session will be updated automatically by the useEffect when userName changes
          navigate('/dashboard');
        },
        signOut: () => {
          localStorage.clear();
          sessionStorage.clear();
          setSession(null);
          navigate('/');
        },
      };
    }, [navigate]);
    const pathname = location.pathname; // Get the current pathname from useLocation

    const router = React.useMemo<Router>(() => {
      return {
        pathname,
        searchParams: new URLSearchParams(),
        navigate: (to) => {
          // Only pass 'replace' and 'state' to react-router's navigate
          if (typeof to === 'number') {
            // For backward/forward navigation
            (navigate as any)(to);
          } else {
            navigate(to, {
              // state: options?.state, // Removed because NavigateOptions does not support 'state'
            });
          }
        },
      };
    }, [pathname, navigate]);

    const demoWindow = window !== undefined ? window() : undefined;
    return (
      
    
      <AppProvider
        session={session}
        authentication={authentication}
        navigation={NAVIGATION}
        router={router}
        theme={demoTheme}
        window={demoWindow}
        branding={{
          title: soclib || 'ABR-POINT',
          logo: <img src={SocieteImage} alt="Societe"  />,
        }}
      >
      
        <DashboardLayout navigation={NAVIGATION}>
          <DemoPageContent pathname={pathname} />
        </DashboardLayout>
      </AppProvider>
     
    );


    
}
