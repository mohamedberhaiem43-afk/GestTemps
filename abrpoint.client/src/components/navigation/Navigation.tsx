import * as React from 'react';
import { createTheme } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { AppProvider, Router, Session } from '@toolpad/core/AppProvider';
import { DashboardLayout } from '@toolpad/core';
import { Accessible, AccessTime, AccountBalance, AccountCircle, AdminPanelSettings, Assessment, AttachMoney, Autorenew, Chat, DevicesOther, Domain, EventNote, HolidayVillageRounded, Insights, Money, MoneyOffCsredSharp, Power, Settings, SyncAlt, WorkOutline} from '@mui/icons-material';
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
import { Societe } from '../DonneeDeBase/Societe/Societe';
import { CalendarIcon } from '@mui/x-date-pickers';
import Calendrier from '../ParamSoc/Calendrier/Calendrier';
import Rubrique from '../DonneeDeBase/Rubrique/Rubrique';
import Section from '../DonneeDeBase/Section/Section';
import Accompte from '../PreparationPaie/Accompte/Accompte';
import PointageDuMois from '../PreparationPaie/PointageDuMois/PointageDuMois';
import EtatDroitConge from '../PreparationPaie/DroitConge/EtatDroitConge';
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
import { useAuth } from '../helper/AuthProvider';
import GeminiChat from '../helper/Chatbot/GeminiChat';
import { useTranslation } from 'react-i18next';
import { Qualifications } from '../DonneeDeBase/Qualification/Qualifications';

interface DemoProps {
    window?: () => Window;
}

interface DemoPageContentProps {
    pathname: string;
}

// Hook personnalisé pour obtenir la navigation traduite
const useNavigationItems = () => {
  const { t } = useTranslation();
  
  return [
    {
      segment: 'dashboard',
      title: t('navigation.dashboard'),
      icon: <DashboardIcon />,
    },
    {
      segment: 'dashboard',
      title: t('navigation.dataBase'),
      style: { fontSize: '1px' },
      icon: <StorageIcon />,
      children: [
        {
          segment: 'gestion-societe',
          title: t('navigation.society'),
          icon: <Domain />,
        },
        {
          segment: 'direction',
          title: t('navigation.direction'),
          icon: <LocationCityIcon />,
        },
        {
          segment: 'service',
          title: t('navigation.service'),
          icon: <BusinessIcon />,
        },
        {
          segment: 'section',
          title: t('navigation.section'),
          icon: <CategoryIcon />,
        },
        {
          segment: 'filiale',
          title: t('navigation.branch'),
          icon: <FlagIcon />,
        },
        {
          segment: 'pays',
          title: t('navigation.country'),
          icon: <MapIcon />,
        },
        {
          segment: 'ville',
          title: t('navigation.city'),
          icon: <LocationCityIcon />,
        },
        {
          segment: 'fonction',
          title: t('navigation.function'),
          icon: <PeopleIcon />,
        },
        {
          segment: 'qualification',
          title: t('navigation.qualification'),
          icon: <Power />,
        },
        {
          segment: 'rubrique',
          title: t('navigation.rubric'),
          icon: <AttachMoney />,
        },
      ],
    },
    {
      segment: 'dashboard',
      title: t('navigation.administrator'),
      style: { fontSize: '1px' },
      icon: <AdminPanelSettings />,
      children: [
        {
          segment: 'gestion-utilisateur',
          title: t('navigation.users'),
          icon: <AccountCircle />,
        },
        {
          segment: 'droit-accees',
          title: t('navigation.accessRights'),
          icon: <Accessible />,
        },
      ],
    },
    {
      segment: 'dashboard',
      title: t('navigation.clockingMachine'),
      icon: <Fingerprint />,
      children: [
        {
          segment: 'lecture-pointeuse',
          title: t('navigation.clockingReading'),
          icon: <SyncAlt />,
        },
        {
          segment: 'liste-pointeuse',
          title: t('navigation.clockingList'),
          icon: <DevicesOther />,
        },
        {
          segment: 'optimisation-pointage',
          title: t('navigation.clockingOptimization'),
          icon: <DevicesOther />,
        },
        {
          segment: 'etat-periodique',
          title: t('navigation.periodicReport'),
          icon: <Assessment />,
        },
      ]
    },
    {
      segment: 'dashboard',
      title: t('navigation.employee'),
      icon: <PersonIcon />,
      children: [
        {
          segment: 'gestion-employe',
          title: t('navigation.employeeManagement'),
          icon: <PeopleIcon />,
        },
        {
          segment: 'contrat',
          title: t('navigation.contract'),
          icon: <AssignmentIcon />,
          children: [
            {
              segment: 'contrat',
              title: t('navigation.contractManagement'),
              icon: <AssignmentIcon />,
            },
            {
              segment: 'renouvellement-contrat',
              title: t('navigation.renewal'),
              icon: <Autorenew />,
            },
          ]
        },
        {
          segment: 'allaitement',
          title: t('navigation.breastfeeding'),
          icon: <FamilyRestroomIcon />,
        },
        {
          segment: '',
          title: t('navigation.leave'),
          icon: <PersonIcon />,
          children:[
            {
              segment: 'gestion-de-conge',
              title: t('navigation.leaveRequest'),
              icon: <FamilyRestroomIcon />,
            },
            {
              segment: 'gestion-de-solde',
              title: t('navigation.leaveBalance'),
              icon: <CalendarTodayIcon />,
            },
            {
              segment: 'titre-de-conge',
              title: t('navigation.leaveTitle'),
              icon: <CalendarTodayIcon />,
            },
            {
              segment: 'titre-de-conge-general',
              title: t('navigation.generalLeave'),
              icon: <CalendarTodayIcon />,
            },
          ]
        },
        {
          segment: '',
          title: t('navigation.absences'),
          icon: <PersonIcon />,
          children:[
            {
              segment: 'jour-de-compensation',
              title: t('navigation.compensationDay'),
              icon: <FamilyRestroomIcon />,
            },
            {
              segment: 'autorisation-de-sortie',
              title: t('navigation.exitAuthorization'),
              icon: <WorkOutline />,
            },
            {
              segment: 'autorisation-de-sortie-generale',
              title: t('navigation.generalExit'),
              icon: <WorkOutline />,
            },
            {
              segment: 'absence-et-sanction',
              title: t('navigation.absenceAndSanction'),
              icon: <Gavel />,
            },
          ]
        }
      ],
    },
    {
      segment: 'dashboard',
      title: t('navigation.timeClass'),
      icon: <Settings />,
      children: [
        {
          segment: 'saisie-classe-horaire',
          title: t('navigation.workSchedule'),
          icon: <CorporateFareIcon />,
        },
        {
          segment: 'saisie-poste-de-travail',
          title: t('navigation.workStation'),
          icon: <CorporateFareIcon />,
        },
        {
          segment: 'intitule-des-absences',
          title: t('navigation.absenceTypes'),
          icon: <EventBusyIcon />,
        },
        {
          segment: 'Repos',
          title: t('navigation.publicHolidays'),
          icon: <HolidayVillageRounded />,
        },
      ],
    },
    {
      segment: 'dashboard',
      title: t('navigation.payrollPreparation'),
      icon: <Money />,
      children: [
        {
          segment: 'accompte-salaire',
          title: t('navigation.salaryAdvance'),
          icon: <MoneyOffCsredSharp />,
        },
        {
          segment: 'pointage-du-mois',
          title: t('navigation.monthlyClocking'),
          icon: <MoneyOffCsredSharp />,
        },
        {
          segment: 'droit-de-conge',
          title: t('navigation.leaveRights'),
          icon: <MoneyOffCsredSharp />,
        },
      ],
    },
    {
      segment: 'dashboard',
      title: t('navigation.reports'),
      icon: <Insights />,
      children: [
        {
          segment: 'etat-de-presence',
          title: t('navigation.attendanceReport'),
          icon: <PeopleIcon />,
        },
        {
          segment: 'etat-de-retard',
          title: t('navigation.lateReport'),
          icon: <AccessTime />,
        },
        {
          segment: 'etat-des-absences',
          title: t('navigation.absenceReport'),
          icon: <AccessTime />,
        },
        {
          segment: 'echeance-contrat',
          title: t('navigation.contractExpiry'),
          icon: <EventNote />,
        },
        {
          segment: 'cahier-conge',
          title: t('navigation.leaveBook'),
          icon: <EventNote />,
        },
      ]
    },
    {
      segment: 'dashboard',
      title: t('navigation.companySettings'),
      icon: <Settings />,
      children: [
        {
          segment: 'profile',
          title: t('navigation.profile'),
          icon: <AccountBalance />,
        },
        {
          segment: 'societe',
          title: t('navigation.companyParameter'),
          icon: <CorporateFareIcon />,
        },
        {
          segment: 'calendrier-societe',
          title: t('navigation.companyCalendar'),
          icon: <CalendarIcon />,
        },
        {
          segment: 'chat-bot',
          title: t('navigation.chatBot'),
          icon: <Chat />,
        },
      ]
    },
  ];
};


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
        case '/dashboard/qualification':
            content = <Qualifications />;
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
            {/* <QueryClientProvider client={queryClient}> */}
              <BasicTabs />
            {/* </QueryClientProvider> */}
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
        px: { xs: 2, sm: 3, md: 4 },
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
const BASE_URL = import.meta.env.VITE_REACT_APP_API_URL;

export default function DashboardLayoutAccount(props: DemoProps) {
    const { window: windowProp } = props;  // rename to avoid conflict
    const navigate = useNavigate();
    const location = useLocation();
    const { userName, soclib } = useAuth();
    const { i18n } = useTranslation();
    const NAVIGATION = useNavigationItems();

    const [profileImage, setProfileImage] = React.useState<string>(
        localStorage.getItem('profileImage')
            ? `${BASE_URL}${localStorage.getItem('profileImage')}`
            : '/default-profile.png'
    );

    const [societeImage, setSocieteImage] = React.useState<string>(
        localStorage.getItem('societeImage')
            ? `${BASE_URL}${localStorage.getItem('societeImage')}`
            : '/default-logo.png'
    );

    const [session, setSession] = React.useState<Session | null>(null);

    // Listen for image updates
    React.useEffect(() => {
        const handleStorageChange = () => {
            const profile = localStorage.getItem('profileImage');
            const societe = localStorage.getItem('societeImage');
            if (profile) setProfileImage(`${BASE_URL}${profile}`);
            if (societe) setSocieteImage(`${BASE_URL}${societe}`);
        };

        // Use global window, not the prop
        globalThis.window.addEventListener('storage', handleStorageChange);
        globalThis.window.addEventListener('imageUpdated', handleStorageChange);

        return () => {
            globalThis.window.removeEventListener('storage', handleStorageChange);
            globalThis.window.removeEventListener('imageUpdated', handleStorageChange);
        };
    }, []);

    // Update session when userName or profileImage changes
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
    }, [userName, profileImage]);

    // RTL/LTR direction
    React.useEffect(() => {
        document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = i18n.language;
    }, [i18n.language]);

    const authentication = React.useMemo(() => ({
        signIn: () => navigate('/dashboard'),
        signOut: () => {
            localStorage.clear();
            sessionStorage.clear();
            setSession(null);
            navigate('/');
        },
    }), [navigate]);

    const pathname = location.pathname;

    const router = React.useMemo<Router>(() => ({
        pathname,
        searchParams: new URLSearchParams(),
        navigate: (to) => {
            if (typeof to === 'number') {
                (navigate as any)(to);
            } else {
                navigate(to, {});
            }
        },
    }), [pathname, navigate]);

    const demoWindow = windowProp !== undefined ? windowProp() : undefined;
    const queryClient = new QueryClient();

    return (
        <QueryClientProvider client={queryClient}>
            <AppProvider
                session={session}
                authentication={authentication}
                navigation={NAVIGATION}
                router={router}
                theme={demoTheme}
                window={demoWindow}
                branding={{
                    title: soclib || 'ABR-POINT',
                    logo: <img src={societeImage} alt="Societe" />,
                }}
            >
                <DashboardLayout navigation={NAVIGATION}>
                    <DemoPageContent pathname={pathname} />
                </DashboardLayout>
            </AppProvider>
        </QueryClientProvider>
    );
}