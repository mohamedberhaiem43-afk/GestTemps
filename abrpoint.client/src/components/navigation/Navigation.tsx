import * as React from 'react';
import { createPortal } from 'react-dom';
import apiInstance from '../API/apiInstance';
import { AppProvider, Router, Session } from '@toolpad/core/AppProvider';
import { DashboardLayout } from '@toolpad/core';
import {
  Accessible, AccessTime, AccountBalance, AccountCircle, AdminPanelSettings,
  Assessment, AttachMoney, Autorenew, Chat, DevicesOther, Domain, EventNote,
  HolidayVillageRounded, Power, Settings, WorkOutline, LocalAtm,
  Schedule, Brightness4, Brightness7,
} from '@mui/icons-material';
import { Box, IconButton, Tooltip, useTheme as useMuiTheme } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import FilialeModern from '../DonneeDeBase/Filiale/FilialeModern';
import FonctionModern from '../DonneeDeBase/Fonction/FonctionModern';
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
import AllaitementModern from '../gestionEmploye/Allaitement/AllaitementModern';
import GestionContratsModern from '../gestionEmploye/GestionContrats/GestionContratsModern';
import ClasseHoraireModern from '../ClasseHoraire/ClasseHoraireModern';
import CredentialsSignInPage from '../Login/Login';
import IntituleDesAbsencesModern from '../ClasseHoraire/IntituleDesAbsences/IntituleDesAbsencesModern';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import ReposModern from '../ClasseHoraire/Repos/ReposModern';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import JourDeCompensation from '../gestionEmploye/gestionAbsence/jourCompensation/JourCompensation';
import AutSortieModern from '../gestionEmploye/gestionAbsence/jourCompensation/AutSortie/AutSortieModern';
import AbsenceSanctionModern from '../gestionEmploye/gestionAbsence/jourCompensation/AbsenceSanction/AbsenceSanctionModern';
import { Gavel } from '@mui/icons-material';
import OrgStructureModern from '../DonneeDeBase/OrgStructure/OrgStructureModern';
import PaysModern from '../DonneeDeBase/Pays/PaysModern';
import VilleModern from '../DonneeDeBase/Ville/VilleModern';
import Pointeuse from '../Pointeuse/Pointeuse';
import AutSortieGenerale from '../gestionEmploye/gestionAbsence/jourCompensation/AutSortieGenerale/AutSortieGenerale';
import DashboardModern from '../Dashboard/DashboardModern';
import EtatPeriodiqueModern from '../Pointeuse/EtatPeriodique/EtatPeriodiqueModern';
import './navigation.css';
import RenouvellementContrat from '../gestionEmploye/GestionContrats/Renouvellement/RenouvellementContrat';
import Utilisateur from '../DonneeDeBase/Utilisteur/Utilisateur';
import DemCongeModern from '../gestionEmploye/gestionConge/DemConge/DemCongeModern';
import DemandeAutorisationModern from '../gestionEmploye/DemandeAutorisation/DemandeAutorisationModern';
import SoldeCongeModern from '../gestionEmploye/gestionConge/SoldeConge/SoldeCongeModern';
import TitreConge from '../gestionEmploye/gestionConge/TitreConge/TitreConge';
import CongeGneral from '../gestionEmploye/gestionConge/TitreCongeGeneral/CongeGeneral';
import SocieteModern from '../DonneeDeBase/Societe/SocieteModern';
import { CalendarIcon } from '@mui/x-date-pickers';
import Calendrier from '../ParamSoc/Calendrier/Calendrier';
import RubriqueModern from '../DonneeDeBase/Rubrique/RubriqueModern';
import Accompte from '../PreparationPaie/Accompte/Accompte';
import PointageDuMoisModern from '../PreparationPaie/PointageDuMois/PointageDuMoisModern';
import EtatDroitConge from '../PreparationPaie/DroitConge/EtatDroitConge';
import EcheanceContrat from '../Etats/EchanceContrat/EcheanceContrat';
import EtatPresence from '../Etats/EtatPresence/EtatPresence';
import EtatRetard from '../Etats/EtatRetard/EtatRetard';
import EtatAbsence from '../Etats/EtatAbsence/EtatAbsence';
import EmployeModern from '../gestionEmploye/EmployeModern';
import EffectifsGlobaux from '../gestionEmploye/EffectifsGlobaux';
import CahierConge from '../Etats/CahierConge/CahierConge';
import RemboursementModern from '../gestionEmploye/Remboursement/RemboursementModern';
import MainModern from '../PosteTravail/MainModern';
import DroitAccessPointeuse from '../Admin/PointeuseAccees/DroitAcceesPointeuse';
import Profile from '../ParamSoc/Profile/Profile';
// import Optimisation from '../Pointeuse/Optimisation/Optimisation';
import { useAuth } from '../helper/AuthProvider';
import GeminiChat from '../helper/Chatbot/GeminiChat';
import { useTranslation } from 'react-i18next';
import QualificationModern from '../DonneeDeBase/Qualification/QualificationModern';
import CoffreFortModern from '../gestionEmploye/CoffreFortModern';
import AdminVaultModern from '../gestionEmploye/Vault/AdminVaultModern';
import ContractBuilderModern from '../gestionEmploye/Vault/ContractBuilderModern';
import SignaturePage from '../gestionEmploye/Vault/SignaturePage';
import NotificationCenter from './NotificationCenter';
import { useThemeMode } from '../../App';

/* ══════════════════════════════════════════════════════ */
/*  Types                                                 */
/* ══════════════════════════════════════════════════════ */
interface DemoProps {
  window?: () => Window;
}

interface DemoPageContentProps {
  pathname: string;
}

/* ══════════════════════════════════════════════════════ */
/*  useNavigationItems Hook                               */
/* ══════════════════════════════════════════════════════ */
const useNavigationItems = () => {
  const { t } = useTranslation();
  const { utiadm, isEmp, hasPermission } = useAuth();
  const isAdmin = utiadm === '1';

  const segmentToModule: Record<string, string> = {
    'gestion-societe': 'Données de Base',
    'structure-organisationnelle': 'Données de Base',
    'filiale': 'Données de Base',
    'pays': 'Données de Base',
    'ville': 'Données de Base',
    'fonction': 'Données de Base',
    'qualification': 'Données de Base',
    'rubrique': 'Données de Base',
    'lecture-pointeuse': 'Pointage et Temps',
    'liste-pointeuse': 'Pointage et Temps',
    // 'optimisation-pointage': 'Pointage et Temps',
    'etat-periodique': 'Pointage et Temps',
    'gestion-employe': 'Gestion Employés',
    'profil-employe': 'Gestion Employés',
    'contrat': 'Contrats et Avenants',
    'renouvellement-contrat': 'Contrats et Avenants',
    'allaitement': 'Gestion Employés',
    'gestion-de-conge': 'Demande de Congé',
    'gestion-de-solde': 'Gestion des Congés',
    'titre-de-conge': 'Gestion des Congés',
    'titre-de-conge-general': 'Gestion des Congés',
    'jour-de-compensation': 'Absences et Sanctions',
    'autorisation-de-sortie': 'Absences et Sanctions',
    'autorisation-de-sortie-generale': 'Absences et Sanctions',
    'demande-autorisation': 'Absences et Sanctions',
    'absence-et-sanction': 'Absences et Sanctions',
    'saisie-classe-horaire': 'Paramètres de Temps',
    'saisie-poste-de-travail': 'Paramètres de Temps',
    'intitule-des-absences': 'Paramètres de Temps',
    'Repos': 'Paramètres de Temps',
    'accompte-salaire': 'Paie et Rémunération',
    'pointage-du-mois': 'Paie et Rémunération',
    'droit-de-conge': 'Paie et Rémunération',
    'remboursement': 'Paie et Rémunération',
    'etat-de-presence': 'Rapports et Statistiques',
    'etat-de-retard': 'Rapports et Statistiques',
    'etat-des-absences': 'Rapports et Statistiques',
    'echeance-contrat': 'Rapports et Statistiques',
    'cahier-conge': 'Rapports et Statistiques',
    'gestion-utilisateur': 'Administration',
    'droit-accees': 'Administration',
    'societe': 'Administration',
    'calendrier-societe': 'Administration',
    'chat-bot': 'Administration',
    'coffre-fort': 'Gestion Employés',
    'sign-document': 'Gestion Employés',
    'admin-vault': 'Gestion Employés',
    'template-builder': 'Administration',
  };

  const filterNavigationTree = (items: any[]) => {
    return items.reduce<any[]>((acc, item) => {
      const filteredChildren = item.children
        ? filterNavigationTree(item.children)
        : undefined;

      let isAllowedItem = false;
      const moduleName = segmentToModule[item.segment];

      if (isAdmin) {
        isAllowedItem = true;
      } else if (!moduleName) {
        isAllowedItem = true;
      } else {
        isAllowedItem = hasPermission(moduleName, 'consult');
      }

      const hasAllowedChildren = Boolean(filteredChildren?.length);

      if (isAllowedItem || hasAllowedChildren) {
        acc.push({
          ...item,
          ...(filteredChildren ? { children: filteredChildren } : {}),
        });
      }

      return acc;
    }, []);
  };

  const baseNavigation = [
    {
      segment: 'dashboard',
      title: t('navigation.dashboard'),
      icon: <span className="material-symbols-outlined">dashboard</span>,
    },
    {
      segment: 'dashboard',
      title: t('navigation.dataBase'),
      style: { fontSize: '1px' },
      icon: <StorageIcon />,
      children: [
        { segment: 'gestion-societe', title: t('navigation.society'), icon: <Domain /> },
        { segment: 'structure-organisationnelle', title: 'Structure Org.', icon: <AccountBalance /> },
        { segment: 'filiale', title: t('navigation.branch'), icon: <FlagIcon /> },
        { segment: 'pays', title: t('navigation.country'), icon: <MapIcon /> },
        { segment: 'ville', title: t('navigation.city'), icon: <LocationCityIcon /> },
        { segment: 'fonction', title: t('navigation.function'), icon: <PeopleIcon /> },
        { segment: 'qualification', title: t('navigation.qualification'), icon: <Power /> },
        { segment: 'rubrique', title: t('navigation.rubric'), icon: <AttachMoney /> },
      ],
    },
    {
      segment: 'dashboard',
      title: t('navigation.clockingMachine'),
      icon: <span className="material-symbols-outlined">fingerprint</span>,
      children: [
        // { segment: 'lecture-pointeuse', title: t('navigation.clockingReading'), icon: <SyncAlt /> },
        { segment: 'liste-pointeuse', title: t('navigation.clockingList'), icon: <DevicesOther /> },
        // { segment: 'optimisation-pointage', title: t('navigation.clockingOptimization'), icon: <DevicesOther /> },
        { segment: 'etat-periodique', title: t('navigation.periodicReport'), icon: <Assessment /> },
      ],
    },
    {
      segment: 'dashboard',
      title: t('navigation.employee'),
      icon: <span className="material-symbols-outlined">badge</span>,
      children: [
        { segment: 'gestion-employe', title: t('navigation.employeeManagement'), icon: <PeopleIcon /> },
        { segment: 'profil-employe', title: 'Profil Employé', icon: <PeopleIcon /> },
        {
          segment: 'contrat',
          title: t('navigation.contract'),
          icon: <AssignmentIcon />,
          children: [
            { segment: 'contrat', title: t('navigation.contractManagement'), icon: <AssignmentIcon /> },
            { segment: 'renouvellement-contrat', title: t('navigation.renewal'), icon: <Autorenew /> },
          ],
        },
        { segment: 'allaitement', title: t('navigation.breastfeeding'), icon: <FamilyRestroomIcon /> },
        {
          segment: '',
          title: t('navigation.leave'),
          icon: <PersonIcon />,
          children: [
            { segment: 'gestion-de-conge', title: t('navigation.leaveRequest'), icon: <FamilyRestroomIcon /> },
            { segment: 'gestion-de-solde', title: t('navigation.leaveBalance'), icon: <CalendarTodayIcon /> },
            { segment: 'titre-de-conge', title: t('navigation.leaveTitle'), icon: <CalendarTodayIcon /> },
            { segment: 'titre-de-conge-general', title: t('navigation.generalLeave'), icon: <CalendarTodayIcon /> },
          ],
        },
        {
          segment: '',
          title: t('navigation.absences'),
          icon: <PersonIcon />,
          children: [
            { segment: 'jour-de-compensation', title: t('navigation.compensationDay'), icon: <FamilyRestroomIcon /> },
            { segment: 'autorisation-de-sortie', title: t('navigation.exitAuthorization'), icon: <WorkOutline /> },
            { segment: 'autorisation-de-sortie-generale', title: t('navigation.generalExit'), icon: <WorkOutline /> },
            { segment: 'demande-autorisation', title: "Demande d'Autorisation", icon: <AccessTime /> },
            { segment: 'absence-et-sanction', title: t('navigation.absenceAndSanction'), icon: <Gavel /> },
          ],
        },
        { segment: 'coffre-fort', title: 'Coffre-fort', icon: <span className="material-symbols-outlined">shield</span> },
        { segment: 'admin-vault', title: 'Vue Globale Vault', icon: <span className="material-symbols-outlined">admin_panel_settings</span> },
      ],
    },
    {
      segment: 'dashboard',
      title: t('navigation.timeClass'),
      icon: <span className="material-symbols-outlined">schedule</span>,
      children: [
        { segment: 'saisie-classe-horaire', title: t('navigation.workSchedule'), icon: <CorporateFareIcon /> },
        { segment: 'saisie-poste-de-travail', title: t('navigation.workStation'), icon: <CorporateFareIcon /> },
        { segment: 'intitule-des-absences', title: t('navigation.absenceTypes'), icon: <EventBusyIcon /> },
        { segment: 'Repos', title: t('navigation.publicHolidays'), icon: <HolidayVillageRounded /> },
      ],
    },
    {
      segment: 'dashboard',
      title: t('navigation.payrollPreparation'),
      icon: <span className="material-symbols-outlined">payments</span>,
      children: [
        { segment: 'accompte-salaire', title: t('navigation.salaryAdvance'), icon: <LocalAtm /> },
        { segment: 'pointage-du-mois', title: t('navigation.monthlyClocking'), icon: <Schedule /> },
        { segment: 'droit-de-conge', title: t('navigation.leaveRights'), icon: <HolidayVillageRounded /> },
        { segment: 'remboursement', title: 'Notes de Frais', icon: <AttachMoney /> },
      ],
    },
    {
      segment: 'dashboard',
      title: t('navigation.reports'),
      icon: <span className="material-symbols-outlined">analytics</span>,
      children: [
        { segment: 'etat-de-presence', title: t('navigation.attendanceReport'), icon: <PeopleIcon /> },
        { segment: 'etat-de-retard', title: t('navigation.lateReport'), icon: <AccessTime /> },
        { segment: 'etat-des-absences', title: t('navigation.absenceReport'), icon: <AccessTime /> },
        { segment: 'echeance-contrat', title: t('navigation.contractExpiry'), icon: <EventNote /> },
        { segment: 'cahier-conge', title: t('navigation.leaveBook'), icon: <EventNote /> },
      ],
    },
  ];

  const adminNavigation = {
    segment: 'dashboard',
    title: t('navigation.administrator'),
    style: { fontSize: '1px' },
    icon: <AdminPanelSettings />,
    children: [
      { segment: 'gestion-utilisateur', title: t('navigation.users'), icon: <AccountCircle /> },
      { segment: 'droit-accees', title: t('navigation.accessRights'), icon: <Accessible /> },
      { segment: 'template-builder', title: 'Modèles de Contrats', icon: <span className="material-symbols-outlined">description</span> },
    ],
  };

  const companySettingsNavigation = {
    segment: 'dashboard',
    title: t('navigation.companySettings'),
    icon: <Settings />,
    children: [
      { segment: 'profile', title: t('navigation.profile'), icon: <AccountBalance /> },
      ...(isAdmin ? [
        { segment: 'societe', title: t('navigation.companyParameter'), icon: <CorporateFareIcon /> },
        { segment: 'calendrier-societe', title: t('navigation.companyCalendar'), icon: <CalendarIcon /> },
        { segment: 'chat-bot', title: t('navigation.chatBot'), icon: <Chat /> },
      ] : []),
    ],
  };

  if (isEmp) {
    return [
      {
        segment: 'dashboard',
        title: t('navigation.dashboard'),
        icon: <span className="material-symbols-outlined">dashboard</span>,
      },
      {
        segment: 'dashboard',
        title: 'Mon Espace',
        icon: <AccountCircle />,
        children: [
          { segment: 'gestion-de-conge', title: t('navigation.leaveRequest'), icon: <span className="material-symbols-outlined">event_busy</span> },
          { segment: 'gestion-de-solde', title: t('navigation.leaveBalance'), icon: <span className="material-symbols-outlined">calendar_today</span> },
          { segment: 'remboursement', title: 'Notes de Frais', icon: <AttachMoney /> },
          { segment: 'demande-autorisation', title: "Demande d'Autorisation", icon: <AccessTime /> },
          { segment: 'profile', title: t('navigation.profile'), icon: <AccountCircle /> },
          { segment: 'coffre-fort', title: 'Mon Coffre-fort', icon: <span className="material-symbols-outlined">shield</span> },
        ],
      },
    ];
  }

  return filterNavigationTree([
    ...baseNavigation,
    adminNavigation,
    companySettingsNavigation,
  ]);
};

/* ══════════════════════════════════════════════════════ */
/*  DemoPageContent                                       */
/* ══════════════════════════════════════════════════════ */
function DemoPageContent({ pathname }: DemoPageContentProps) {
  let content;

  switch (pathname) {
    case '/': content = <CredentialsSignInPage />; break;
    case '/dashboard': content = <DashboardModern />; break;
    case '/dashboard/structure-organisationnelle': content = <OrgStructureModern />; break;
    case '/dashboard/ville': content = <VilleModern />; break;
    case '/dashboard/filiale': content = <FilialeModern />; break;
    case '/dashboard/rubrique': content = <RubriqueModern />; break;
    // case '/dashboard/lecture-pointeuse': content = <Lecture />; break;
    case '/dashboard/liste-pointeuse': content = <Pointeuse />; break;
    // case '/dashboard/optimisation-pointage': content = <Optimisation />; break;
    case '/dashboard/etat-periodique': content = <EtatPeriodiqueModern />; break;
    case '/dashboard/etat-de-presence': content = <EtatPresence />; break;
    case '/dashboard/etat-de-retard': content = <EtatRetard />; break;
    case '/dashboard/etat-des-absences': content = <EtatAbsence />; break;
    case '/dashboard/echeance-contrat': content = <EcheanceContrat />; break;
    case '/dashboard/cahier-conge': content = <CahierConge />; break;
    case '/dashboard/accompte-salaire': content = <Accompte />; break;
    case '/dashboard/pointage-du-mois': content = <PointageDuMoisModern />; break;
    case '/dashboard/droit-de-conge': content = <EtatDroitConge />; break;
    case '/dashboard/pays': content = <PaysModern />; break;
    case '/dashboard/qualification': content = <QualificationModern />; break;
    case '/dashboard/fonction': content = <FonctionModern />; break;
    case '/dashboard/gestion-employe': content = <EffectifsGlobaux />; break;
    case '/dashboard/profil-employe': content = <EmployeModern />; break;
    case '/dashboard/remboursement': content = <RemboursementModern />; break;
    case '/dashboard/gestion-utilisateur': content = <Utilisateur />; break;
    case '/dashboard/droit-accees': content = <DroitAccessPointeuse />; break;
    case '/dashboard/gestion-societe': content = <SocieteModern />; break;
    case '/dashboard/profile': content = <Profile />; break;
    case '/dashboard/societe': content = <BasicTabs />; break;
    case '/dashboard/allaitement': content = <AllaitementModern />; break;
    case '/dashboard/contrat/contrat': content = <GestionContratsModern />; break;
    case '/dashboard/contrat/renouvellement-contrat': content = <RenouvellementContrat />; break;
    case '/dashboard/saisie-classe-horaire': content = <ClasseHoraireModern />; break;
    case '/dashboard/saisie-poste-de-travail': content = <MainModern />; break;
    case '/dashboard/Repos': content = <ReposModern />; break;
    case '/dashboard/intitule-des-absences': content = <IntituleDesAbsencesModern />; break;
    case '/dashboard/absence-et-sanction': content = <AbsenceSanctionModern />; break;
    case '/dashboard/gestion-de-conge': content = <DemCongeModern />; break;
    case '/dashboard/coffre-fort': content = <CoffreFortModern />; break;
    case '/dashboard/admin-vault': content = <AdminVaultModern />; break;
    case '/dashboard/titre-de-conge': content = <TitreConge />; break;
    case '/dashboard/titre-de-conge-general': content = <CongeGneral />; break;
    case '/dashboard/jour-de-compensation': content = <JourDeCompensation />; break;
    case '/dashboard/autorisation-de-sortie': content = <AutSortieModern />; break;
    case '/dashboard/autorisation-de-sortie-generale': content = <AutSortieGenerale />; break;
    case '/dashboard/demande-autorisation': content = <DemandeAutorisationModern />; break;
    case '/dashboard/gestion-de-solde': content = <SoldeCongeModern />; break;
    case '/dashboard/calendrier-societe': content = <Calendrier />; break;
    case '/dashboard/chat-bot': content = <Box p={3}>Utilisez le bouton flottant de l'assistant en bas à droite.</Box>; break;
    case '/dashboard/template-builder': content = <ContractBuilderModern />; break;
    case '/dashboard/sign-document': content = <SignaturePage />; break;
  }

  return (
    <Box sx={{
      py: 0, px: 0,
      display: 'flex', flexDirection: 'column',
      width: '100%', height: '100%',
      minHeight: 'calc(100vh - 64px)',
    }}>
      {content}
    </Box>
  );
}

/* ══════════════════════════════════════════════════════ */
/*  makeToolbarActions — factory sans hooks React         */
/*  Toutes les valeurs viennent de la closure             */
/* ══════════════════════════════════════════════════════ */
function makeToolbarActions(
  isDark: boolean,
  mode: 'light' | 'dark',
  toggleTheme: () => void,
) {
  return function ToolbarActions() {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>

        {/* ── Recherche ── */}
        <Box sx={{ position: 'relative', display: { xs: 'none', md: 'block' } }}>
          <input
            placeholder="Rechercher un document..."
            style={{
              outline: 'none',
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f2f4f6',
              color: isDark ? '#f1f5f9' : '#1e293b',
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none',
              borderRadius: '12px',
              padding: '8px 16px 8px 36px',
              fontSize: '12px',
              fontWeight: 500,
              width: '256px',
              transition: 'all 0.2s',
            }}
          />
          <span
            className="material-symbols-outlined"
            style={{
              position: 'absolute', left: '10px', top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '18px',
              color: isDark ? '#64748b' : '#94a3b8',
              pointerEvents: 'none',
            }}
          >search</span>
        </Box>

        {/* ── Slot DOM pour NotificationCenter (injecté via portail) ── */}
        <div
          id="toolbar-notifications-slot"
          style={{ display: 'flex', alignItems: 'center' }}
        />

        {/* ── Theme switcher ── */}
        <Tooltip title={mode === 'dark' ? 'Mode clair' : 'Mode sombre'}>
          <IconButton
            onClick={toggleTheme}
            sx={{
              color: isDark ? '#94a3b8' : '#64748b',
              borderRadius: '12px',
              p: 1.2,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': { color: '#0040a1', bgcolor: 'rgba(0, 64, 161, 0.05)' },
            }}
          >
            {mode === 'dark'
              ? <Brightness7 sx={{ fontSize: 22 }} />
              : <Brightness4 sx={{ fontSize: 22 }} />}
          </IconButton>
        </Tooltip>

        {/* ── Aide ── */}
        <Tooltip title="Aide">
          <IconButton
            sx={{
              color: isDark ? '#94a3b8' : '#64748b',
              borderRadius: '12px',
              p: 1.2,
              '&:hover': { color: '#0040a1', bgcolor: 'rgba(0, 64, 161, 0.05)' },
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
              help_outline
            </span>
          </IconButton>
        </Tooltip>

      </Box>
    );
  };
}

/* ══════════════════════════════════════════════════════ */
/*  NotificationPortal                                    */
/*  Monté dans l'arbre React complet → accès à tous les  */
/*  contextes (Auth, QueryClient, Theme)                  */
/*  Rendu visuellement dans #toolbar-notifications-slot   */
/* ══════════════════════════════════════════════════════ */
function NotificationPortal() {
  const [container, setContainer] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    let attempts = 0;
    const interval = setInterval(() => {
      const el = document.getElementById('toolbar-notifications-slot');
      if (el) {
        setContainer(el);
        clearInterval(interval);
      }
      if (++attempts > 50) clearInterval(interval); // 5s max
    }, 100);
    return () => clearInterval(interval);
  }, []);

  if (!container) return null;
  return createPortal(<NotificationCenter />, container);
}

/* ══════════════════════════════════════════════════════ */
/*  DashboardLayoutAccount                                */
/* ══════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_REACT_APP_API_URL;

function DashboardLayoutAccount(props: DemoProps) {
  const { window: windowProp } = props;
  const navigate = useNavigate();
  const location = useLocation();
  const { userName, soclib, clearAuth } = useAuth();
  const { i18n } = useTranslation();
  const NAVIGATION = useNavigationItems();
  const outerTheme = useMuiTheme();
  const { mode, toggleTheme } = useThemeMode();
  const isDark = outerTheme.palette.mode === 'dark';

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

  React.useEffect(() => {
    const handleStorageChange = () => {
      const profile = localStorage.getItem('profileImage');
      const societe = localStorage.getItem('societeImage');
      if (profile) setProfileImage(`${BASE_URL}${profile}`);
      if (societe) setSocieteImage(`${BASE_URL}${societe}`);
    };
    globalThis.window.addEventListener('storage', handleStorageChange);
    globalThis.window.addEventListener('imageUpdated', handleStorageChange);
    return () => {
      globalThis.window.removeEventListener('storage', handleStorageChange);
      globalThis.window.removeEventListener('imageUpdated', handleStorageChange);
    };
  }, []);

  React.useEffect(() => {
    if (userName || soclib) {
      setSession({ user: { name: userName || 'Employé', image: profileImage } });
    } else {
      setSession(null);
    }
  }, [userName, profileImage, soclib]);

  React.useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const authentication = React.useMemo(() => ({
    signIn: () => navigate('/dashboard'),
    signOut: () => {
      apiInstance.post('/Utilisateurs/logout', {})
        .then(() => { localStorage.clear(); clearAuth(); setSession(null); navigate('/'); })
        .catch(() => { localStorage.clear(); clearAuth(); setSession(null); navigate('/'); });
    },
  }), [navigate]);

  const pathname = location.pathname;

  const router = React.useMemo<Router>(() => ({
    pathname,
    searchParams: new URLSearchParams(),
    navigate: (to) => {
      if (typeof to === 'number') (navigate as any)(to);
      else navigate(to, {});
    },
  }), [pathname, navigate]);

  // Recrée le slot à chaque changement de thème pour que la closure soit fraîche
  const ToolbarActions = React.useMemo(
    () => makeToolbarActions(isDark, mode, toggleTheme),
    [isDark, mode, toggleTheme]
  );

  const isHiddenPage =
    pathname === '/' ||
    pathname === '/dashboard/profil-employe';

  const demoWindow = windowProp !== undefined ? windowProp() : undefined;

  return (
    <AppProvider
      session={session}
      authentication={authentication}
      navigation={NAVIGATION}
      router={router}
      theme={outerTheme}
      window={demoWindow}
      branding={{
        title: sessionStorage.getItem('soclib') || 'Ledger.',
        logo: <img src={societeImage} alt="Societe" style={{ borderRadius: '8px' }} />,
      }}
    >
      {isHiddenPage ? (
        <DemoPageContent pathname={pathname} />
      ) : (
        <DashboardLayout
          navigation={NAVIGATION}
          defaultSidebarCollapsed={false}
          slots={{ toolbarActions: ToolbarActions }}
        >
          <DemoPageContent pathname={pathname} />
        </DashboardLayout>
      )}

      {/*
        NotificationPortal est monté ICI — dans l'arbre React complet.
        Il a accès à AuthProvider, QueryClientProvider, ThemeModeContext.
        Il se rend visuellement dans la div#toolbar-notifications-slot
        créée par makeToolbarActions via createPortal.
      */}
      {!isHiddenPage && <NotificationPortal />}

      {pathname !== '/' && <GeminiChat />}
    </AppProvider>
  );
}

/* ══════════════════════════════════════════════════════ */
/*  Export                                                */
/* ══════════════════════════════════════════════════════ */
export default function DashboardLayoutAccountWrapper(props: DemoProps) {
  return <DashboardLayoutAccount {...props} />;
}