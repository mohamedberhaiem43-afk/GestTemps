import { Box, IconButton, Tooltip, useTheme as useMuiTheme, Autocomplete, TextField, InputAdornment, Typography, Avatar, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import { Search as SearchIcon, X as CloseIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

/* ── Page components (Synchronous for maximum compatibility) ── */
import FilialeModern from '../DonneeDeBase/Filiale/FilialeModern';
import FonctionModern from '../DonneeDeBase/Fonction/FonctionModern';
import BasicTabs from '../ParamSoc/ParamSoc';
import AllaitementModern from '../gestionEmploye/Allaitement/AllaitementModern';
import GestionContratsModern from '../gestionEmploye/GestionContrats/GestionContratsModern';
import ClasseHoraireModern from '../ClasseHoraire/ClasseHoraireModern';
import CredentialsSignInPage from '../Login/Login';
import SignupPage from '../Signup/SignupPage';
import IntituleDesAbsencesModern from '../ClasseHoraire/IntituleDesAbsences/IntituleDesAbsencesModern';
import ReposModern from '../ClasseHoraire/Repos/ReposModern';
import JourDeCompensation from '../gestionEmploye/gestionAbsence/jourCompensation/JourCompensation';
import AutSortieModern from '../gestionEmploye/gestionAbsence/jourCompensation/AutSortie/AutSortieModern';
import AbsenceSanctionModern from '../gestionEmploye/gestionAbsence/jourCompensation/AbsenceSanction/AbsenceSanctionModern';
import OrgStructureModern from '../DonneeDeBase/OrgStructure/OrgStructureModern';
import PaysModern from '../DonneeDeBase/Pays/PaysModern';
import VilleModern from '../DonneeDeBase/Ville/VilleModern';
import Pointeuse from '../Pointeuse/Pointeuse';
import AutSortieGenerale from '../gestionEmploye/gestionAbsence/jourCompensation/AutSortieGenerale/AutSortieGenerale';
import DashboardModernSync from '../Dashboard/DashboardModern';
import EtatPeriodiqueModern from '../Pointeuse/EtatPeriodique/EtatPeriodiqueModern';
// RenouvellementContrat (page autonome) supprimée : le renouvellement est intégré à la liste
// des contrats (bouton "Renouveler" par ligne) et au dashboard (KPI échéance → dialog).
import Utilisateur from '../DonneeDeBase/Utilisteur/Utilisateur';
import DemCongeModern from '../gestionEmploye/gestionConge/DemConge/DemCongeModern';
import DemandeAutorisationModern from '../gestionEmploye/DemandeAutorisation/DemandeAutorisationModern';
import SoldeCongeModern from '../gestionEmploye/gestionConge/SoldeConge/SoldeCongeModern';
import SoldeCongeAdmin from '../gestionEmploye/gestionConge/SoldeConge/SoldeCongeAdmin';
import TitreConge from '../gestionEmploye/gestionConge/TitreConge/TitreConge';
import CongeGneral from '../gestionEmploye/gestionConge/TitreCongeGeneral/CongeGeneral';
import SocieteModern from '../DonneeDeBase/Societe/SocieteModern';
import Calendrier from '../ParamSoc/Calendrier/Calendrier';
import RubriqueModern from '../DonneeDeBase/Rubrique/RubriqueModern';
// import Accompte from '../PreparationPaie/Accompte/Accompte';
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
import QualificationModern from '../DonneeDeBase/Qualification/QualificationModern';
import CoffreFortModern from '../gestionEmploye/CoffreFortModern';
import AdminVaultModern from '../gestionEmploye/Vault/AdminVaultModern';
import ContractBuilderModern from '../gestionEmploye/Vault/ContractBuilderModern';
import SignaturePage from '../gestionEmploye/Vault/SignaturePage';
import PricingPage from '../Pricing/PricingPage';
import AboutPage from '../About/AboutPage';
import PaymentPage from '../Pricing/PaymentPage';
import PlanConfigurationPage from '../Pricing/PlanConfigurationPage';
import NotificationCenter from './NotificationCenter';
import SidebarNavigationDualTier, { type NavGroup, type FooterItem } from './SidebarNavigationDualTier';
import LanguageSwitcher from '../LanguageSwitcher/LanguageSwitcher';

/* ── Lucide icons ── */
import {
  LayoutGrid,
  Database,
  Building2,
  Network,
  Flag,
  Map,
  MapPin,
  Globe,
  Briefcase,
  Award,
  BookOpen,
  Fingerprint,
  MonitorDot,
  Activity,
  FileText,
  RefreshCw,
  Baby,
  CalendarDays,
  CalendarX,
  Timer,
  Gavel,
  Shield,
  Eye,
  Wallet,
  CalendarCheck,
  Banknote,
  Receipt,
  Clock3,
  ClipboardList,
  CalendarMinus,
  Notebook,
  CircleUser,
  KeyRound,
  MessageSquare,
  SlidersHorizontal,
  Users,
  Settings,
  LifeBuoy,
  AlarmClock,
  User,
  BarChart2,
  Home,
  DollarSign,
  LogOut,
  XCircle,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../helper/AuthProvider';
import GeminiChat from '../helper/Chatbot/GeminiChat';
/* ══════════════════════════════════════════════════════ */
/*  Types                                                 */
/* ══════════════════════════════════════════════════════ */
interface DemoProps {
  window?: () => Window;
}

interface OpenedTab {
  label: string;
  href: string;
  icon: any;
}

/* ══════════════════════════════════════════════════════ */
/*  useNavigationItems Hook                               */
/* ══════════════════════════════════════════════════════ */
const useNavigationItems = (): NavGroup[] => {
  const { t } = useTranslation();
  const { authReady, isAdmin, isEmp, isManager, hasPermission, utiadm } = useAuth();

  // utiadm='1' est un fallback admin — utile pendant la fenêtre où /me n'a pas encore
  // répondu mais où sessionStorage a hydraté utiadm. Évite que le sidebar perde la
  // plupart de ses items après un reload.
  const isAdminEffective = isAdmin || utiadm === '1';

  if (!authReady) return [];

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
    'etat-periodique': 'Pointage et Temps',
    'gestion-employe': 'Gestion Employés',
    'profil-employe': 'Gestion Employés',
    'contrat': 'Contrats et Avenants',
    'allaitement': 'Gestion Employés',
    'gestion-de-conge': 'Demande de Congé',
    'gestion-de-solde': 'Gestion des Congés',
    'affectation-solde': 'Gestion des Congés',
    'titre-de-conge': 'Gestion des Congés',
    'titre-de-conge-general': 'Gestion des Congés',
    'jour-de-compensation': 'Absences et Sanctions',
    'autorisation-de-sortie': 'Absences et Sanctions',
    'autorisation-de-sortie-generale': 'Absences et Sanctions',
    'demande-autorisation': 'Absences et Sanctions',
    'absence-et-sanction': 'Absences et Sanctions',
    'saisie-classe-horaire': 'Paramètres de Temps',
    'saisie-poste-de-travail': 'Paramètres de Temps',
    'intitule-des-absences': 'Données de Base',
    'Repos': 'Données de Base',
    // 'accompte-salaire': 'Paie et Rémunération',
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

  const canSee = (segment: string) => {
    if (isAdminEffective) return true;
    const mod = segmentToModule[segment];
    if (!mod) return true;
    return hasPermission(mod, 'consult');
  };

  /* ── Employee (minimal) navigation ── */
  if (isEmp && !isManager && !isAdminEffective) {
    return [
      {
        label: t('navigation.dashboard'),
        href: '/dashboard',
        icon: Home,
        items: [],
      },
      {
        label: 'Mon Espace',
        href: '/dashboard/mon-espace',
        icon: User,
        items: [
          { label: t('navigation.leaveRequest'), href: '/dashboard/gestion-de-conge', icon: CalendarX },
          { label: t('navigation.leaveBalance'), href: '/dashboard/gestion-de-solde', icon: CalendarCheck },
          { label: "Notes de Frais", href: '/dashboard/remboursement', icon: Receipt },
          { label: "Demande d'Autorisation", href: '/dashboard/demande-autorisation', icon: Timer },
          { label: t('navigation.profile'), href: '/dashboard/profile', icon: CircleUser },
          { label: 'Mon Coffre-fort', href: '/dashboard/coffre-fort', icon: Shield },
        ],
      },
    ];
  }

  /* ── Full navigation ── */
  const allGroups: NavGroup[] = [
    {
      label: t('navigation.dashboard'),
      href: '/dashboard',
      icon: Home,
      items: [],
    },
    ...(canSee('gestion-societe') || canSee('structure-organisationnelle') || canSee('intitule-des-absences') || canSee('Repos') ? [{
      label: t('navigation.dataBase'),
      href: '/dashboard/donnees-de-base',
      icon: Database,
      items: [
        ...(canSee('gestion-societe') ? [{ label: t('navigation.society'), href: '/dashboard/gestion-societe', icon: Building2 }] : []),
        ...(canSee('structure-organisationnelle') ? [{ label: 'Structure Org.', href: '/dashboard/structure-organisationnelle', icon: Network }] : []),
        ...(canSee('filiale') ? [{ label: t('navigation.branch'), href: '/dashboard/filiale', icon: Flag }] : []),
        ...(canSee('pays') ? [{ label: t('navigation.country'), href: '/dashboard/pays', icon: Globe }] : []),
        ...(canSee('ville') ? [{ label: t('navigation.city'), href: '/dashboard/ville', icon: MapPin }] : []),
        ...(canSee('fonction') ? [{ label: t('navigation.function'), href: '/dashboard/fonction', icon: Briefcase }] : []),
        ...(canSee('qualification') ? [{ label: t('navigation.qualification'), href: '/dashboard/qualification', icon: Award }] : []),
        ...(canSee('rubrique') ? [{ label: t('navigation.rubric'), href: '/dashboard/rubrique', icon: DollarSign }] : []),
        ...(canSee('intitule-des-absences') ? [{ label: t('navigation.absenceTypes'), href: '/dashboard/intitule-des-absences', icon: ClipboardList }] : []),
        ...(canSee('Repos') ? [{ label: t('navigation.publicHolidays'), href: '/dashboard/Repos', icon: CalendarCheck }] : []),
      ],
    }] : []),
    ...(canSee('liste-pointeuse') ? [{
      label: t('navigation.clockingMachine'),
      href: '/dashboard/pointage',
      icon: Fingerprint,
      items: [
        ...(canSee('liste-pointeuse') ? [{ label: t('navigation.clockingList'), href: '/dashboard/liste-pointeuse', icon: MonitorDot }] : []),
        ...(canSee('etat-periodique') ? [{ label: t('navigation.periodicReport'), href: '/dashboard/etat-periodique', icon: Activity }] : []),
      ],
    }] : []),
    {
      label: t('navigation.employee'),
      href: '/dashboard/employe',
      icon: Users,
      items: [
        ...(canSee('gestion-employe') ? [{ label: t('navigation.employeeManagement'), href: '/dashboard/gestion-employe', icon: Users }] : []),
        ...(canSee('profil-employe') ? [{ label: 'Profil Employé', href: '/dashboard/profil-employe', icon: User }] : []),
        ...(canSee('contrat') ? [{ label: t('navigation.contractManagement'), href: '/dashboard/contrat/contrat', icon: FileText }] : []),
        // Renouvellement de contrat : intégré directement dans la liste des contrats (bouton
        // "Renouveler" par ligne) et dans le dashboard (KPI échéance contrat → dialog).
        ...(canSee('allaitement') ? [{ label: t('navigation.breastfeeding'), href: '/dashboard/allaitement', icon: Baby }] : []),
        ...(canSee('coffre-fort') ? [{ label: 'Coffre-fort', href: '/dashboard/coffre-fort', icon: Shield }] : []),
        ...(canSee('admin-vault') ? [{ label: 'Vue Globale Vault', href: '/dashboard/admin-vault', icon: Eye }] : []),
      ],
    },
    {
      label: t('navigation.leave'),
      href: '/dashboard/conges',
      icon: CalendarDays,
      items: [
        ...(canSee('gestion-de-conge') ? [{ label: t('navigation.leaveRequest'), href: '/dashboard/gestion-de-conge', icon: CalendarX }] : []),
        ...(canSee('gestion-de-solde') ? [{ label: t('navigation.leaveBalance'), href: '/dashboard/gestion-de-solde', icon: CalendarCheck }] : []),
        ...(canSee('titre-de-conge') ? [{ label: t('navigation.leaveTitle'), href: '/dashboard/titre-de-conge', icon: Notebook }] : []),
        ...(canSee('titre-de-conge-general') ? [{ label: t('navigation.generalLeave'), href: '/dashboard/titre-de-conge-general', icon: CalendarMinus }] : []),
        ...(isAdminEffective ? [{ label: 'Affectation Soldes', href: '/dashboard/affectation-solde', icon: CalendarCheck }] : []),
      ],
    },
    {
      label: t('navigation.absences'),
      href: '/dashboard/absences',
      icon: AlarmClock,
      items: [
        ...(canSee('jour-de-compensation') ? [{ label: t('navigation.compensationDay'), href: '/dashboard/jour-de-compensation', icon: Clock3 }] : []),
        ...(canSee('autorisation-de-sortie') ? [{ label: t('navigation.exitAuthorization'), href: '/dashboard/autorisation-de-sortie', icon: Timer }] : []),
        ...(canSee('autorisation-de-sortie-generale') ? [{ label: t('navigation.generalExit'), href: '/dashboard/autorisation-de-sortie-generale', icon: Timer }] : []),
        ...(canSee('demande-autorisation') ? [{ label: "Demande d'Autorisation", href: '/dashboard/demande-autorisation', icon: Timer }] : []),
        ...(canSee('absence-et-sanction') ? [{ label: t('navigation.absenceAndSanction'), href: '/dashboard/absence-et-sanction', icon: Gavel }] : []),
      ],
    },
    {
      label: t('navigation.timeClass'),
      href: '/dashboard/temps',
      icon: SlidersHorizontal,
      items: [
        ...(canSee('saisie-classe-horaire') ? [{ label: t('navigation.workSchedule'), href: '/dashboard/saisie-classe-horaire', icon: Clock3 }] : []),
        ...(canSee('saisie-poste-de-travail') ? [{ label: t('navigation.workStation'), href: '/dashboard/saisie-poste-de-travail', icon: Briefcase }] : []),
      ],
    },
    {
      label: t('navigation.payrollPreparation'),
      href: '/dashboard/paie',
      icon: Banknote,
      items: [
        // ...(canSee('accompte-salaire') ? [{ label: t('navigation.salaryAdvance'), href: '/dashboard/accompte-salaire', icon: Wallet }] : []),
        ...(canSee('pointage-du-mois') ? [{ label: t('navigation.monthlyClocking'), href: '/dashboard/pointage-du-mois', icon: Clock3 }] : []),
        ...(canSee('droit-de-conge') ? [{ label: t('navigation.leaveRights'), href: '/dashboard/droit-de-conge', icon: CalendarCheck }] : []),
        ...(canSee('remboursement') ? [{ label: 'Notes de Frais', href: '/dashboard/remboursement', icon: Receipt }] : []),
      ],
    },
    {
      label: t('navigation.reports'),
      href: '/dashboard/rapports',
      icon: BarChart2,
      items: [
        ...(canSee('etat-de-presence') ? [{ label: t('navigation.attendanceReport'), href: '/dashboard/etat-de-presence', icon: Users }] : []),
        ...(canSee('etat-de-retard') ? [{ label: t('navigation.lateReport'), href: '/dashboard/etat-de-retard', icon: Clock3 }] : []),
        ...(canSee('etat-des-absences') ? [{ label: t('navigation.absenceReport'), href: '/dashboard/etat-des-absences', icon: AlarmClock }] : []),
        ...(canSee('echeance-contrat') ? [{ label: t('navigation.contractExpiry'), href: '/dashboard/echeance-contrat', icon: FileText }] : []),
        ...(canSee('cahier-conge') ? [{ label: t('navigation.leaveBook'), href: '/dashboard/cahier-conge', icon: BookOpen }] : []),
      ],
    },
    ...(isAdminEffective ? [{
      label: t('navigation.administrator'),
      href: '/dashboard/admin',
      icon: KeyRound,
      items: [
        { label: t('navigation.users'), href: '/dashboard/gestion-utilisateur', icon: Users },
        { label: t('navigation.accessRights'), href: '/dashboard/droit-accees', icon: Shield },
        { label: 'Modèles de Contrats', href: '/dashboard/template-builder', icon: FileText },
        { label: t('navigation.companyParameter'), href: '/dashboard/societe', icon: Building2 },
        { label: t('navigation.companyCalendar'), href: '/dashboard/calendrier-societe', icon: CalendarDays },
        // Lien Chatbot retiré du sidebar : l'assistant reste accessible via le bouton flottant
        // en bas à droite, présent globalement sur le dashboard. Pas besoin d'un menu dédié.
        // L'entrée Tarification est volontairement absente du sidebar : la page est servie
        // sur la landing publique '/' (parcours d'inscription Odoo-style). La route reste
        // mappée plus bas pour les liens directs / paiement.
      ],
    }] : []),
  ];

  // Filtre les groupes vides
  return allGroups.filter(
    (g) => g.items === undefined || g.items.length > 0 || g.href === '/dashboard'
  );
};

/* ══════════════════════════════════════════════════════ */
/*  DemoPageContent                                       */
/* ══════════════════════════════════════════════════════ */
interface DemoPageContentProps {
  pathname: string;
}

function DemoPageContent({ pathname }: DemoPageContentProps) {
  let content: React.ReactNode;

  switch (pathname) {
    // Public marketing/pricing landing — visible sans authentification (approche Odoo).
    case '/': content = <PricingPage />; break;
    case '/about': content = <AboutPage />; break;
    case '/login': content = <CredentialsSignInPage />; break;
    case '/signup': content = <SignupPage />; break;
    case '/plan-configuration': content = <PlanConfigurationPage />; break;
    case '/payment': content = <PaymentPage />; break;
    case '/dashboard': content = <DashboardModernSync />; break;
    case '/dashboard/structure-organisationnelle': content = <OrgStructureModern />; break;
    case '/dashboard/ville': content = <VilleModern />; break;
    case '/dashboard/filiale': content = <FilialeModern />; break;
    case '/dashboard/rubrique': content = <RubriqueModern />; break;
    case '/dashboard/liste-pointeuse': content = <Pointeuse />; break;
    case '/dashboard/etat-periodique': content = <EtatPeriodiqueModern />; break;
    case '/dashboard/etat-de-presence': content = <EtatPresence />; break;
    case '/dashboard/etat-de-retard': content = <EtatRetard />; break;
    case '/dashboard/etat-des-absences': content = <EtatAbsence />; break;
    case '/dashboard/echeance-contrat': content = <EcheanceContrat />; break;
    case '/dashboard/cahier-conge': content = <CahierConge />; break;
    // case '/dashboard/accompte-salaire': content = <Accompte />; break;
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
    case '/dashboard/parametres': content = <BasicTabs />; break;
    case '/dashboard/allaitement': content = <AllaitementModern />; break;
    case '/dashboard/contrat/contrat': content = <GestionContratsModern />; break;
    // /dashboard/contrat/renouvellement-contrat retiré : flux intégré à la liste des contrats
    // et au dashboard (KPI échéance → dialog).
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
    case '/dashboard/affectation-solde': content = <SoldeCongeAdmin />; break;
    case '/dashboard/calendrier-societe': content = <Calendrier />; break;
    case '/dashboard/chat-bot': content = <Box p={3}>Utilisez le bouton flottant de l'assistant en bas à droite.</Box>; break;
    case '/dashboard/template-builder': content = <ContractBuilderModern />; break;
    case '/dashboard/sign-document': content = <SignaturePage />; break;
    case '/dashboard/pricing': content = <PricingPage />; break;
    case '/dashboard/payment': content = <PaymentPage />; break;
    case '/dashboard/plan-configuration': content = <PlanConfigurationPage />; break;
    default: content = <DashboardModernSync />;
  }

  return (
    <Box sx={{
      py: 0, px: 0,
      display: 'flex', flexDirection: 'column',
      flexGrow: 1,
      minHeight: 0,
      bgcolor: (theme) => theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
    }}>
      {content}
    </Box>
  );
}

/* ══════════════════════════════════════════════════════ */
/*  Recent Items & Tab Helpers                            */
/* ══════════════════════════════════════════════════════ */

const iconMap: Record<string, any> = {
  Home, LayoutGrid, Database, Building2, Network, Flag, Map, MapPin, Globe, Briefcase,
  Award, BookOpen, Fingerprint, MonitorDot, Activity, FileText, RefreshCw, Baby,
  CalendarDays, CalendarX, Timer, Gavel, Shield, Eye, Wallet, CalendarCheck,
  Banknote, Receipt, Clock3, ClipboardList, CalendarMinus, Notebook, CircleUser,
  KeyRound, MessageSquare, SlidersHorizontal, Users, Settings, LifeBuoy, AlarmClock,
  User, BarChart2, DollarSign, LogOut
};

function DynamicIcon({ name, size = 16, color }: { name: string, size?: number, color?: string }) {
  const Icon = iconMap[name] || LayoutGrid;
  return <Icon size={size} color={color} />;
}

interface RecentItem {
  label: string;
  href: string;
}

function RecentItemsBar({ items, onNavigate }: { items: RecentItem[], onNavigate: (h: string) => void }) {
  if (items.length === 0) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 2, overflow: 'hidden' }}>
      {items.slice(0, 3).map((item, i) => (
        <Typography
          key={i}
          onClick={() => onNavigate(item.href)}
          sx={{
            fontSize: '12px',
            color: '#64748b',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            '&:hover': { color: '#0040a1', textDecoration: 'underline' }
          }}
        >
          Recent: {item.label}
        </Typography>
      ))}
    </Box>
  );
}

/* ══════════════════════════════════════════════════════ */
/*  Toolbar Actions                                        */
/* ══════════════════════════════════════════════════════ */
function makeToolbarActions(
  isDark: boolean,
  navigation: NavGroup[],
  onNavigate: (href: string) => void,
  clearAuth: () => void,
  userName?: string | null
) {
  // Flatten navigation for search
  const searchItems = navigation.flatMap((group) => {
    const parent = { label: group.label, href: group.href };
    const children = (group.items ?? []).map((item) => ({
      label: `${group.label} > ${item.label}`,
      href: item.href,
      shortLabel: item.label
    }));
    // Return group if it's a direct link, plus its children
    const list = group.href && group.href !== '#' ? [parent, ...children] : children;
    // Remove duplicates by href
    return list;
  }).filter((v, i, a) => v.href && v.href !== '#' && a.findIndex(t => t.href === v.href) === i);

  function UserProfileMenu({ userName, isDark, clearAuth, onNavigate }: { userName?: string | null, isDark: boolean, clearAuth: () => void, onNavigate: (h: string) => void }) {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleClick = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);

    const handleProfile = () => { handleClose(); onNavigate('/dashboard/profile'); };
    const handleLogout = () => { handleClose(); clearAuth(); onNavigate('/'); };

    return (
      <>
        <Tooltip title={userName || 'Compte'}>
          <Avatar
            onClick={handleClick}
            sx={{
              width: 34, height: 34,
              bgcolor: isDark ? 'rgba(147,197,253,0.1)' : 'rgba(0,64,161,0.06)',
              color: isDark ? '#93c5fd' : '#0040a1',
              fontSize: '14px', fontWeight: 800,
              border: '1px solid',
              borderColor: isDark ? 'rgba(147,197,253,0.2)' : 'rgba(0,64,161,0.1)',
              cursor: 'pointer'
            }}
          >
            {userName?.charAt(0).toUpperCase() || 'A'}
          </Avatar>
        </Tooltip>
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          onClick={handleClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{
            elevation: 0,
            sx: {
              overflow: 'visible',
              filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
              mt: 1.5,
              borderRadius: '12px',
              minWidth: '180px',
              '& .MuiAvatar-root': { width: 32, height: 32, ml: -0.5, mr: 1 },
              '&:before': {
                content: '""', display: 'block', position: 'absolute', top: 0, right: 14, width: 10, height: 10,
                bgcolor: 'background.paper', transform: 'translateY(-50%) rotate(45deg)', zIndex: 0,
              },
            },
          }}
        >
          <MenuItem onClick={handleProfile}>
            <ListItemIcon><User size={22} /></ListItemIcon>
            <ListItemText primary="Mon Profil" primaryTypographyProps={{ fontSize: '13px', fontWeight: 600 }} />
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout} sx={{ color: '#ba1a1a' }}>
            <ListItemIcon><LogOut size={22} color="#ba1a1a" /></ListItemIcon>
            <ListItemText primary="Déconnexion" primaryTypographyProps={{ fontSize: '13px', fontWeight: 600 }} />
          </MenuItem>
        </Menu>
      </>
    );
  }

  return function ToolbarActions() {
    const [recentPages, _setRecentPages] = React.useState<RecentItem[]>(() => {
      const saved = localStorage.getItem('recentPages');
      return saved ? JSON.parse(saved) : [];
    });

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0, flexWrap: 'nowrap', width: '100%', justifyContent: 'flex-end' }}>
        {/* Recent Items - Left aligned in the actions area if space permits */}
        <Box sx={{ display: { xs: 'none', lg: 'flex' }, flex: 1, justifyContent: 'flex-start' }}>
          <RecentItemsBar items={recentPages} onNavigate={onNavigate} />
        </Box>

        {/* Functional Search Box */}
        <Autocomplete
          size="small"
          options={searchItems}
          getOptionLabel={(option) => option.label}
          onChange={(_, value) => {
            if (value) onNavigate(value.href);
          }}
          sx={{
            display: { xs: 'none', md: 'block' },
            width: '280px',
            '& .MuiOutlinedInput-root': {
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#f2f4f6',
              borderRadius: '12px',
              fontSize: '13px',
              '& fieldset': { border: 'none' },
              '&:hover fieldset': { border: 'none' },
              '&.Mui-focused fieldset': { border: 'none' },
            }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Rechercher une page..."
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                  </InputAdornment>
                ),
              }}
            />
          )}
        />

        {/* Language Switcher */}
        <Box sx={{ flexShrink: 0, '& .MuiFormControl-root': { minWidth: 'auto' }, '& .MuiSelect-select': { py: 0.5, px: 1, fontSize: '12px', fontWeight: 700 } }}>
          <LanguageSwitcher />
        </Box>

        {/* Notification Center — toujours visible (flexShrink: 0 pour ne pas être tronqué) */}
        <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <NotificationCenter />
        </Box>

        {/* User Profile instead of Help */}
        <Box sx={{ flexShrink: 0, ml: 1, display: 'flex', alignItems: 'center' }}>
          <UserProfileMenu userName={userName} isDark={isDark} clearAuth={clearAuth} onNavigate={onNavigate} />
        </Box>
      </Box>
    );
  };
}

/* ══════════════════════════════════════════════════════ */
/*  Main Layout                                           */
/* ══════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_REACT_APP_API_URL;

function DashboardLayoutAccount(_props: DemoProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { authReady, clearAuth, userName, isAdmin } = useAuth();
  const { i18n } = useTranslation();
  const NAVIGATION = useNavigationItems();
  const outerTheme = useMuiTheme();
  const isDark = outerTheme.palette.mode === 'dark';
  const pathname = location.pathname;

  const [societeImage, setSocieteImage] = React.useState<string>(
    localStorage.getItem('societeImage')
      ? `${BASE_URL}${localStorage.getItem('societeImage')}`
      : '/Concorde.png'
  );

  React.useEffect(() => {
    const handleStorageChange = () => {
      const societe = localStorage.getItem('societeImage');
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
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // ── Browser Tab Title Management ──
  React.useEffect(() => {
    const flatten = (items: NavGroup[]): any[] => items.flatMap(g => [g, ...(g.items || [])]);
    const navItems = flatten(NAVIGATION);
    const matched = navItems.find(n => n.href === pathname);

    if (matched) {
      document.title = `${matched.label} | Concorde Workforce`;
    } else if (pathname === '/dashboard') {
      document.title = `Tableau de bord | Concorde Workforce`;
    } else if (pathname === '/login') {
      document.title = `Connexion | Concorde Workforce`;
    } else if (pathname === '/signup') {
      document.title = `Créer mon espace | Concorde Workforce`;
    } else if (pathname === '/') {
      document.title = `Tarifs | Concorde Workforce`;
    } else {
      document.title = `Concorde Workforce`;
    }
  }, [pathname, NAVIGATION]);

  // ── Tab Management State ──
  const [openedTabs, setOpenedTabs] = React.useState<OpenedTab[]>(() => {
    const saved = localStorage.getItem('openedTabs');
    return saved ? JSON.parse(saved) : [{ label: 'Tableau de bord', href: '/dashboard', icon: 'Home' }];
  });

  // Track navigation to add tabs
  React.useEffect(() => {
    if (pathname === '/' || pathname === '/about' || pathname === '/login' || pathname === '/signup' || pathname === '/plan-configuration' || pathname === '/payment') return;

    // Find the item in flattened navigation to get title and icon
    const flatten = (items: NavGroup[]): any[] => items.flatMap(g => [g, ...(g.items || [])]);
    const navItems = flatten(NAVIGATION);
    const matched = navItems.find(n => n.href === pathname);

    if (matched) {
      setOpenedTabs(prev => {
        if (prev.some(t => t.href === pathname)) return prev;
        const newTabs = [...prev, { label: matched.label, href: matched.href, icon: matched.icon?.name || 'LayoutGrid' }];
        localStorage.setItem('openedTabs', JSON.stringify(newTabs));
        return newTabs;
      });
    }
  }, [pathname, NAVIGATION]);

  // ── Recent Pages Tracking ──
  React.useEffect(() => {
    if (pathname === '/' || pathname === '/about' || pathname === '/login' || pathname === '/signup' || pathname === '/plan-configuration' || pathname === '/payment' || pathname === '/dashboard') return;

    const flatten = (items: NavGroup[]): any[] => items.flatMap(g => [g, ...(g.items || [])]);
    const navItems = flatten(NAVIGATION);
    const matched = navItems.find(n => n.href === pathname);

    if (matched) {
      const saved = localStorage.getItem('recentPages');
      let recent: RecentItem[] = saved ? JSON.parse(saved) : [];
      // Remove if exists and put at start
      recent = recent.filter(r => r.href !== pathname);
      recent.unshift({ label: matched.label, href: matched.href });
      recent = recent.slice(0, 5);
      localStorage.setItem('recentPages', JSON.stringify(recent));
    }
  }, [pathname, NAVIGATION]);


  const handleCloseTab = (e: React.MouseEvent, href: string) => {
    e.stopPropagation();
    const newTabs = openedTabs.filter(t => t.href !== href);
    setOpenedTabs(newTabs);
    localStorage.setItem('openedTabs', JSON.stringify(newTabs));

    if (pathname === href && newTabs.length > 0) {
      navigate(newTabs[newTabs.length - 1].href);
    } else if (newTabs.length === 0) {
      navigate('/dashboard');
    }
  };

  const handleCloseAllTabs = (e: React.MouseEvent) => {
    e.stopPropagation();
    const dashboardTab: OpenedTab = { label: 'Tableau de bord', href: '/dashboard', icon: 'Home' };
    setOpenedTabs([dashboardTab]);
    localStorage.setItem('openedTabs', JSON.stringify([dashboardTab]));
    if (pathname !== '/dashboard') navigate('/dashboard');
  };


  const ToolbarActions = React.useMemo(
    () => makeToolbarActions(isDark, NAVIGATION, (h) => navigate(h), clearAuth, userName),
    [isDark, NAVIGATION, navigate, clearAuth, userName]
  );

  const footerItems: FooterItem[] = [
    { label: 'Support', href: '/dashboard/support', icon: LifeBuoy },
    { label: 'Paramètres', href: '/dashboard/parametres', icon: Settings },
    { label: 'Déconnexion', href: '#', icon: LogOut, onClick: () => { clearAuth(); navigate('/'); } },
  ];

  // Pages publiques (rendues sans la barre latérale) : landing pricing + login.
  const isPublicPage = pathname === '/' || pathname === '/about' || pathname === '/login' || pathname === '/signup' || pathname === '/plan-configuration' || pathname === '/payment';
  const isProfilePage = pathname === '/dashboard/profil-employe';

  if (!authReady) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#64748b' }}>
          progress_activity
        </span>
      </Box>
    );
  }

  if (isPublicPage || isProfilePage) {
    return <DemoPageContent pathname={pathname} />;
  }

  const title = sessionStorage.getItem('soclib') || 'Concorde';
  const logo = (
    <img
      src={societeImage}
      alt="Societe"
      style={{ borderRadius: '8px', width: 32, height: 32, objectFit: 'contain' }}
    />
  );

  return (
    <>
      <SidebarNavigationDualTier
        items={NAVIGATION}
        footerItems={footerItems}
        pathname={pathname}
        onNavigate={(to) => navigate(to)}
        title={title}
        logo={logo}
        isAdmin={isAdmin}
        toolbarActions={<ToolbarActions />}
      >
        {/* Dynamic Tab Bar */}
        <Box sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          borderBottom: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
          bgcolor: isDark ? '#1e293b' : '#f8f9fa',
          px: 1.5,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 0.25,
          overflowX: 'auto',
          minHeight: '40px',
          '&::-webkit-scrollbar': { display: 'none' }
        }}>
          {openedTabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Box
                key={tab.href}
                onClick={() => navigate(tab.href)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  px: 2,
                  py: 0.75,
                  cursor: 'pointer',
                  position: 'relative',
                  borderTopRightRadius: '6px',
                  borderTopLeftRadius: '6px',
                  border: active ? '1px solid' : '1px solid transparent',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                  borderBottom: active ? (isDark ? '1px solid #0f172a' : '1px solid white') : 'none',
                  mb: '-1px',
                  bgcolor: active ? (isDark ? '#0f172a' : 'white') : 'transparent',
                  color: active ? (isDark ? '#93c5fd' : '#0040a1') : (isDark ? '#64748b' : '#94a3b8'),
                  boxShadow: active ? '0 -4px 12px rgba(0,0,0,0.04)' : 'none',
                  zIndex: active ? 2 : 1,
                  transition: 'all 0.15s ease',
                  '&:before': active ? {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2.5px',
                    bgcolor: (theme) => theme.palette.primary.main,
                    borderTopRightRadius: '6px',
                    borderTopLeftRadius: '6px',
                  } : {},
                  '&:after': !active && openedTabs.indexOf(tab) < openedTabs.length - 1 ? {
                    content: '""',
                    position: 'absolute',
                    right: 0,
                    top: '25%',
                    bottom: '25%',
                    width: '1px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                  } : {},
                  '&:hover': !active ? {
                    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
                    color: isDark ? '#f1f5f9' : '#1e293b'
                  } : {},
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', opacity: active ? 1 : 0.7 }}>
                  <DynamicIcon name={tab.icon} size={14} />
                </Box>
                <Typography sx={{
                  fontSize: '12px',
                  fontWeight: active ? 700 : 600,
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.01em'
                }}>
                  {tab.label}
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) => handleCloseTab(e, tab.href)}
                  sx={{
                    p: 0.1,
                    ml: 0.25,
                    opacity: active ? 0.6 : 0,
                    transform: 'scale(0.8)',
                    color: 'inherit',
                    transition: 'opacity 0.2s, background 0.2s',
                    '&:hover': { opacity: 1, bgcolor: 'rgba(0,0,0,0.06)' }
                  }}
                  className="tab-close-btn"
                >
                  <CloseIcon size={12} />
                </IconButton>
                <style>{`
                  .MuiBox-root:hover .tab-close-btn { opacity: 0.6; }
                `}</style>
              </Box>
            );
          })}
          {openedTabs.length > 1 && (
            <Tooltip title="Fermer tous les onglets" arrow>
              <IconButton
                size="small"
                onClick={handleCloseAllTabs}
                sx={{
                  ml: 'auto',
                  alignSelf: 'center',
                  mb: 0.5,
                  color: isDark ? '#fca5a5' : '#dc2626',
                  bgcolor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(220,38,38,0.06)',
                  borderRadius: '6px',
                  px: 0.75,
                  py: 0.25,
                  fontSize: '11px',
                  fontWeight: 600,
                  gap: 0.5,
                  flexShrink: 0,
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(220,38,38,0.12)',
                  }
                }}
              >
                <XCircle size={14} />
                <Typography sx={{ fontSize: '11px', fontWeight: 600, ml: 0.25 }}>
                  Fermer tout
                </Typography>
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <DemoPageContent pathname={pathname} />
      </SidebarNavigationDualTier>

      {pathname !== '/' && (
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <GeminiChat />
        </Box>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════ */
/*  Export                                                */
/* ══════════════════════════════════════════════════════ */
export default function DashboardLayoutBasic(props: DemoProps) {
  return <DashboardLayoutAccount {...props} />;
}
