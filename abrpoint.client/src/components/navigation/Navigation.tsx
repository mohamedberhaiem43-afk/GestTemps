import React from 'react';
import { Box, IconButton, Tooltip, useTheme as useMuiTheme, Typography, Avatar, Menu, MenuItem, ListItemIcon, ListItemText, Divider, CircularProgress } from '@mui/material';
import { Search as SearchIcon, X as CloseIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

/* ── Page components (lazy-loadées) ──
 * PERF — Avant : tous les composants de pages étaient chargés en synchrone au
 * boot, ce qui produisait un index.js > 530 KB gzippé (cf. audit perf front #1).
 * Maintenant : chaque page = un chunk séparé téléchargé à la demande. Le bundle
 * initial contient juste le shell de navigation + HomePage (landing publique).
 *
 * Composants gardés SYNCHRONES : ceux qui s'affichent dans le layout permanent
 * (sidebar, header, bannière, animations, palette, chatbot) ainsi que HomePage
 * (route '/' = LCP critique). Le reste est React.lazy.
 */
import HomePage from '../Home/HomePage';
import DownloadPage from '../Download/DownloadPage';
import { RequireAuth, RequireAdmin, classifyRoute } from '../helper/RouteGuards';
import NotificationCenter from './NotificationCenter';
import SidebarNavigationDualTier, { type NavGroup, type FooterItem } from './SidebarNavigationDualTier';
import LanguageSwitcher from '../LanguageSwitcher/LanguageSwitcher';
import TrialBanner from '../helper/TrialBanner';
import PageFade from '../helper/animations/PageFade';
import CommandPalette from '../helper/CommandPalette/CommandPalette';
import UnifiedAssistantHub from '../helper/Chatbot/UnifiedAssistantHub';

const FilialeModern = React.lazy(() => import('../DonneeDeBase/Filiale/FilialeModern'));
const FonctionModern = React.lazy(() => import('../DonneeDeBase/Fonction/FonctionModern'));
const BasicTabs = React.lazy(() => import('../ParamSoc/ParamSoc'));
const AllaitementModern = React.lazy(() => import('../gestionEmploye/Allaitement/AllaitementModern'));
const GestionContratsModern = React.lazy(() => import('../gestionEmploye/GestionContrats/GestionContratsModern'));
const ClasseHoraireModern = React.lazy(() => import('../ClasseHoraire/ClasseHoraireModern'));
const CredentialsSignInPage = React.lazy(() => import('../Login/Login'));
const SignupPage = React.lazy(() => import('../Signup/SignupPage'));
const IntituleDesAbsencesModern = React.lazy(() => import('../ClasseHoraire/IntituleDesAbsences/IntituleDesAbsencesModern'));
const ReposModern = React.lazy(() => import('../ClasseHoraire/Repos/ReposModern'));
const JourDeCompensation = React.lazy(() => import('../gestionEmploye/gestionAbsence/jourCompensation/JourCompensation'));
const AutSortieModern = React.lazy(() => import('../gestionEmploye/gestionAbsence/jourCompensation/AutSortie/AutSortieModern'));
const AbsenceSanctionModern = React.lazy(() => import('../gestionEmploye/gestionAbsence/jourCompensation/AbsenceSanction/AbsenceSanctionModern'));
const OrgStructureModern = React.lazy(() => import('../DonneeDeBase/OrgStructure/OrgStructureModern'));
const PaysModern = React.lazy(() => import('../DonneeDeBase/Pays/PaysModern'));
const VilleModern = React.lazy(() => import('../DonneeDeBase/Ville/VilleModern'));
const Pointeuse = React.lazy(() => import('../Pointeuse/Pointeuse'));
const AutSortieGenerale = React.lazy(() => import('../gestionEmploye/gestionAbsence/jourCompensation/AutSortieGenerale/AutSortieGenerale'));
const DashboardModernSync = React.lazy(() => import('../Dashboard/DashboardModern'));
const EtatPeriodiqueModern = React.lazy(() => import('../Pointeuse/EtatPeriodique/EtatPeriodiqueModern'));
const Utilisateur = React.lazy(() => import('../DonneeDeBase/Utilisteur/Utilisateur'));
const DemCongeModern = React.lazy(() => import('../gestionEmploye/gestionConge/DemConge/DemCongeModern'));
const DemandeAutorisationModern = React.lazy(() => import('../gestionEmploye/DemandeAutorisation/DemandeAutorisationModern'));
const SoldeCongeModern = React.lazy(() => import('../gestionEmploye/gestionConge/SoldeConge/SoldeCongeModern'));
const SoldeCongeAdmin = React.lazy(() => import('../gestionEmploye/gestionConge/SoldeConge/SoldeCongeAdmin'));
const TitreConge = React.lazy(() => import('../gestionEmploye/gestionConge/TitreConge/TitreConge'));
const CongeGneral = React.lazy(() => import('../gestionEmploye/gestionConge/TitreCongeGeneral/CongeGeneral'));
const SocieteModern = React.lazy(() => import('../DonneeDeBase/Societe/SocieteModern'));
const Calendrier = React.lazy(() => import('../ParamSoc/Calendrier/Calendrier'));
const RubriqueModern = React.lazy(() => import('../DonneeDeBase/Rubrique/RubriqueModern'));
const PointageDuMoisModern = React.lazy(() => import('../PreparationPaie/PointageDuMois/PointageDuMoisModern'));
const EtatDroitConge = React.lazy(() => import('../PreparationPaie/DroitConge/EtatDroitConge'));
const EcheanceContrat = React.lazy(() => import('../Etats/EchanceContrat/EcheanceContrat'));
const EtatPresence = React.lazy(() => import('../Etats/EtatPresence/EtatPresence'));
const EtatRetard = React.lazy(() => import('../Etats/EtatRetard/EtatRetard'));
const EtatAbsence = React.lazy(() => import('../Etats/EtatAbsence/EtatAbsence'));
const EmployeModern = React.lazy(() => import('../gestionEmploye/EmployeModern'));
const EmployeProfileView = React.lazy(() => import('../gestionEmploye/EmployeProfileView'));
const EffectifsGlobaux = React.lazy(() => import('../gestionEmploye/EffectifsGlobaux'));
const CahierConge = React.lazy(() => import('../Etats/CahierConge/CahierConge'));
const TeamCalendarPage = React.lazy(() => import('../Etats/TeamCalendar/TeamCalendarPage'));
const RemboursementModern = React.lazy(() => import('../gestionEmploye/Remboursement/RemboursementModern'));
const MissionPage = React.lazy(() => import('../gestionEmploye/Mission/MissionPage'));
const MainModern = React.lazy(() => import('../PosteTravail/MainModern'));
const DroitAccessPointeuse = React.lazy(() => import('../Admin/PointeuseAccees/DroitAcceesPointeuse'));
const SiteAccessPage = React.lazy(() => import('../Admin/SiteAccessPage'));
const Profile = React.lazy(() => import('../ParamSoc/Profile/Profile'));
const QualificationModern = React.lazy(() => import('../DonneeDeBase/Qualification/QualificationModern'));
const CoffreFortModern = React.lazy(() => import('../gestionEmploye/CoffreFortModern'));
const AdminVaultModern = React.lazy(() => import('../gestionEmploye/Vault/AdminVaultModern'));
const ContractBuilderModern = React.lazy(() => import('../gestionEmploye/Vault/ContractBuilderModern'));
const DocumentsModern = React.lazy(() => import('../Rag/Documents/DocumentsModern'));
const RagAuditTable = React.lazy(() => import('../Rag/Audit/RagAuditTable'));
const LetterTemplatesModern = React.lazy(() => import('../Rag/Letters/LetterTemplatesModern'));
const SignaturePage = React.lazy(() => import('../gestionEmploye/Vault/SignaturePage'));
const PricingPage = React.lazy(() => import('../Pricing/PricingPage'));
const PlanUpgradePage = React.lazy(() => import('../Pricing/PlanUpgradePage'));
const AboutPage = React.lazy(() => import('../About/AboutPage'));
const PlanConfigurationPage = React.lazy(() => import('../Pricing/PlanConfigurationPage'));
const MonAbonnementPage = React.lazy(() => import('../Pricing/MonAbonnementPage'));
const FacturesConcordePage = React.lazy(() => import('../Pricing/FacturesConcordePage'));
const DevisPackPage = React.lazy(() => import('../Pricing/DevisPackPage'));
const ContactSalesPage = React.lazy(() => import('../Pricing/ContactSalesPage'));
const CetPage = React.lazy(() => import('../gestionEmploye/gestionConge/Cet/CetPage'));
const SupportPage = React.lazy(() => import('../Support/SupportPage'));
const FAQPage = React.lazy(() => import('../Support/FAQPage'));
const FormationsPage = React.lazy(() => import('../Support/FormationsPage'));
const CoachingPage = React.lazy(() => import('../Support/CoachingPage'));
const PackMiseEnPlacePage = React.lazy(() => import('../Support/PackMiseEnPlacePage'));
const ContactPage = React.lazy(() => import('../Support/ContactPage'));

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
  History,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../helper/AuthProvider';
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
  const { authReady, isAdmin, isEmp, isManager, hasPermission, planAllows, utiadm, isTrialing } = useAuth();

  // PERF — Toute la construction d'allGroups (~250 lignes de spreads conditionnels et
  // de filtres) est mémoïsée. Avant, chaque render du layout reconstruisait l'array
  // → 3 useEffect en aval (cf. plus bas, openedTabs / recentPages / localStorage)
  // s'exécutaient en boucle à chaque keystroke.
  return React.useMemo<NavGroup[]>(() => {
  if (!authReady) return [];

  // utiadm='1' est un fallback admin — utile pendant la fenêtre où /me n'a pas encore
  // répondu mais où sessionStorage a hydraté utiadm. Évite que le sidebar perde la
  // plupart de ses items après un reload.
  const isAdminEffective = isAdmin || utiadm === '1';

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
    'documents': 'Administration',
    'courriers': 'Administration',
    'rag-audit': 'Administration',
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
        label: t('navigation.mySpace'),
        href: '/dashboard/mon-espace',
        icon: User,
        items: [
          ...(planAllows('leaveManagement') ? [{ label: t('navigation.leaveRequest'), href: '/dashboard/gestion-de-conge', icon: CalendarX }] : []),
          ...(planAllows('leaveManagement') ? [{ label: t('navigation.leaveBalance'), href: '/dashboard/gestion-de-solde', icon: CalendarCheck }] : []),
          ...(planAllows('missions') ? [{ label: t('navigation.myMissions'), href: '/dashboard/missions', icon: Briefcase }] : []),
          { label: t('navigation.expenseNotes'), href: '/dashboard/remboursement', icon: Receipt },
          ...(planAllows('authorizationManagement') ? [{ label: t('navigation.exitAuthorizationRequest'), href: '/dashboard/demande-autorisation', icon: Timer }] : []),
          { label: t('navigation.profile'), href: '/dashboard/profile', icon: CircleUser },
          ...(planAllows('digitalVault') ? [{ label: t('navigation.myVault'), href: '/dashboard/coffre-fort', icon: Shield }] : []),
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
        ...(canSee('structure-organisationnelle') ? [{ label: t('navigation.orgStructure'), href: '/dashboard/structure-organisationnelle', icon: Network }] : []),
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
        // 2026-05-12 : état périodique disponible sur tous les plans (y compris Starter)
        // — c'est le rapport de base du pointage. Le gating `!isTrialing` précédent
        // partait du principe que trial = Premium-pour-tous ; désormais le plan
        // dicte les modules, et Starter conserve explicitement ce rapport.
        ...(canSee('etat-periodique') ? [{ label: t('navigation.periodicReport'), href: '/dashboard/etat-periodique', icon: Activity }] : []),
      ],
    }] : []),
    {
      label: t('navigation.employee'),
      href: '/dashboard/employe',
      icon: Users,
      items: [
        ...(canSee('gestion-employe') ? [{ label: t('navigation.employeeManagement'), href: '/dashboard/gestion-employe', icon: Users }] : []),
        ...(canSee('profil-employe') ? [{ label: t('navigation.employeeProfile'), href: '/dashboard/profil-employe', icon: User }] : []),
        ...(canSee('contrat') ? [{ label: t('navigation.contractManagement'), href: '/dashboard/contrat', icon: FileText }] : []),
        ...(planAllows('missions') ? [{ label: t('navigation.missions'), href: '/dashboard/missions', icon: Briefcase }] : []),
        // Renouvellement de contrat : intégré directement dans la liste des contrats (bouton
        // "Renouveler" par ligne) et dans le dashboard (KPI échéance contrat → dialog).
        ...(canSee('allaitement') ? [{ label: t('navigation.breastfeeding'), href: '/dashboard/allaitement', icon: Baby }] : []),
        ...(canSee('coffre-fort') && planAllows('digitalVault') ? [{ label: t('navigation.vault'), href: '/dashboard/coffre-fort', icon: Shield }] : []),
        ...(canSee('admin-vault') && planAllows('digitalVault') ? [{ label: t('navigation.vaultGlobalView'), href: '/dashboard/admin-vault', icon: Eye }] : []),
      ],
    },
    // 2026-05-12 : groupes "Demandes et validations" + "Absences" entièrement masqués
    // sur Starter (positionnement "pointage simple, sans workflow RH"). On wrappe au
    // niveau du groupe — sinon les items résiduels non gatés (notes de frais,
    // affectation solde, CET, absence et sanction) feraient remonter le groupe vide
    // de sens commercial pour ce plan.
    ...(planAllows('leaveManagement') ? [{
      // Hub centralisé "Demandes et validations" : regroupe tout ce sur quoi un manager
      // attend une action (congé, autorisation, notes de frais...). Le label précédent
      // "Congé" était trop restrictif — la structure permet d'ajouter de nouveaux types
      // de demandes plus tard sans casser la navigation.
      label: t('navigation.requestsAndValidations'),
      href: '/dashboard/conges',
      icon: CalendarDays,
      items: [
        ...(canSee('gestion-de-conge') ? [{ label: t('navigation.leaveRequest'), href: '/dashboard/gestion-de-conge', icon: CalendarX }] : []),
        ...(canSee('gestion-de-solde') ? [{ label: t('navigation.leaveBalance'), href: '/dashboard/gestion-de-solde', icon: CalendarCheck }] : []),
        ...(canSee('titre-de-conge') ? [{ label: t('navigation.leaveTitle'), href: '/dashboard/titre-de-conge', icon: Notebook }] : []),
        ...(canSee('titre-de-conge-general') && planAllows('generalLeave') ? [{ label: t('navigation.generalLeave'), href: '/dashboard/titre-de-conge-general', icon: CalendarMinus }] : []),
        ...(canSee('remboursement') ? [{ label: t('navigation.expenseNotes'), href: '/dashboard/remboursement', icon: Receipt }] : []),
        ...(isAdminEffective ? [{ label: t('navigation.balanceAllocation'), href: '/dashboard/affectation-solde', icon: CalendarCheck }] : []),
        ...(isAdminEffective ? [{ label: t('navigation.timeSavingAccount'), href: '/dashboard/cet', icon: CalendarCheck }] : []),
      ],
    }] : []),
    ...(planAllows('authorizationManagement') || planAllows('compensationDays') ? [{
      label: t('navigation.absences'),
      href: '/dashboard/absences',
      icon: AlarmClock,
      items: [
        ...(canSee('jour-de-compensation') && planAllows('compensationDays') ? [{ label: t('navigation.compensationDay'), href: '/dashboard/jour-de-compensation', icon: Clock3 }] : []),
        ...(canSee('autorisation-de-sortie') && planAllows('authorizationManagement') ? [{ label: t('navigation.exitAuthorization'), href: '/dashboard/autorisation-de-sortie', icon: Timer }] : []),
        ...(canSee('autorisation-de-sortie-generale') && planAllows('generalExit') ? [{ label: t('navigation.generalExit'), href: '/dashboard/autorisation-de-sortie-generale', icon: Timer }] : []),
        ...(canSee('demande-autorisation') && planAllows('authorizationManagement') ? [{ label: t('navigation.exitAuthorizationRequest'), href: '/dashboard/demande-autorisation', icon: Timer }] : []),
        ...(canSee('absence-et-sanction') ? [{ label: t('navigation.absenceAndSanction'), href: '/dashboard/absence-et-sanction', icon: Gavel }] : []),
      ],
    }] : []),
    {
      label: t('navigation.timeClass'),
      href: '/dashboard/temps',
      icon: SlidersHorizontal,
      items: [
        ...(canSee('saisie-classe-horaire') ? [{ label: t('navigation.workSchedule'), href: '/dashboard/saisie-classe-horaire', icon: Clock3 }] : []),
        ...(canSee('saisie-poste-de-travail') ? [{ label: t('navigation.workStation'), href: '/dashboard/saisie-poste-de-travail', icon: Briefcase }] : []),
      ],
    },
    // Préparation paie & rapports analytiques : aligné sur le flag commercial
    // `advancedDashboards` (Standard+). Avant 2026-05-18, on masquait toute la
    // section pendant le trial sans distinction de pack, ce qui empêchait les
    // tenants Standard/Premium en essai d'évaluer la préparation paie — alors
    // que c'est précisément un argument clé de ces packs. Starter reste exclu
    // car AdvancedDashboards=false dans PlanCatalog.
    ...(planAllows('advancedDashboards') ? [{
      label: t('navigation.payrollPreparation'),
      href: '/dashboard/paie',
      icon: Banknote,
      items: [
        // ...(canSee('accompte-salaire') ? [{ label: t('navigation.salaryAdvance'), href: '/dashboard/accompte-salaire', icon: Wallet }] : []),
        ...(canSee('pointage-du-mois') ? [{ label: t('navigation.monthlyClocking'), href: '/dashboard/pointage-du-mois', icon: Clock3 }] : []),
        ...(canSee('droit-de-conge') ? [{ label: t('navigation.leaveRights'), href: '/dashboard/droit-de-conge', icon: CalendarCheck }] : []),
        // Notes de frais déplacé dans "Demandes et validations" (hub central de validation).
      ],
    }] : []),
    // Rapports analytiques (état présence, retards, absences, échéances, cahier congé).
    // Gating commercial : module « Reporting avancé » du pack Standard+. Sur Starter,
    // la section est masquée (un dashboard basique reste accessible via /home).
    // 2026-05-18 : on retire le filtre `!isTrialing` qui masquait les états MÊME aux
    // tenants Premium/Standard en essai gratuit — contraire à la promesse commerciale
    // « pack premium (test ou payant) a toutes les fonctionnalités ». PlanCatalog
    // garantit déjà que Starter.AdvancedDashboards=false → la section reste cachée
    // pour Starter qu'il soit en trial ou payant. Aucune raison d'avoir un cap trial
    // supplémentaire ici.
    ...(planAllows('advancedDashboards') ? [{
      label: t('navigation.reports'),
      href: '/dashboard/rapports',
      icon: BarChart2,
      items: [
        // Calendrier équipe : vue mensuelle agrégée (congés + missions + autorisations).
        // Visible pour tout utilisateur ayant accès aux états de présence —
        // c'est la même portée fonctionnelle (visualisation des absences).
        ...(canSee('etat-de-presence') ? [{ label: t('navigation.teamCalendar', 'Calendrier équipe'), href: '/dashboard/calendrier-equipe', icon: CalendarDays }] : []),
        ...(canSee('etat-de-presence') ? [{ label: t('navigation.attendanceReport'), href: '/dashboard/etat-de-presence', icon: Users }] : []),
        ...(canSee('etat-de-retard') ? [{ label: t('navigation.lateReport'), href: '/dashboard/etat-de-retard', icon: Clock3 }] : []),
        ...(canSee('etat-des-absences') ? [{ label: t('navigation.absenceReport'), href: '/dashboard/etat-des-absences', icon: AlarmClock }] : []),
        ...(canSee('echeance-contrat') ? [{ label: t('navigation.contractExpiry'), href: '/dashboard/echeance-contrat', icon: FileText }] : []),
        ...(canSee('cahier-conge') ? [{ label: t('navigation.leaveBook'), href: '/dashboard/cahier-conge', icon: BookOpen }] : []),
      ],
    }] : []),
    ...(isAdminEffective ? [{
      label: t('navigation.administrator'),
      href: '/dashboard/admin',
      icon: KeyRound,
      items: [
        { label: t('navigation.users'), href: '/dashboard/gestion-utilisateur', icon: Users },
        { label: t('navigation.accessRights'), href: '/dashboard/droit-accees', icon: Shield },
        // Affectation site → utilisateur (table Socuser). Visible admin only.
        { label: t('navigation.siteAccess', "Droits d'accès par site"), href: '/dashboard/droit-acces-site', icon: ShieldCheck },
        { label: t('navigation.contractTemplates'), href: '/dashboard/template-builder', icon: FileText },
        { label: t('navigation.legalDocuments'), href: '/dashboard/documents', icon: FileText },
        { label: t('navigation.letterTemplates'), href: '/dashboard/courriers', icon: FileText },
        ...(planAllows('ragAi') ? [{ label: t('navigation.ragAudit'), href: '/dashboard/rag-audit', icon: History }] : []),
        { label: t('navigation.companyParameter'), href: '/dashboard/societe', icon: Building2 },
        { label: t('navigation.companyCalendar'), href: '/dashboard/calendrier-societe', icon: CalendarDays },
        // Lien Chatbot retiré du sidebar : l'assistant reste accessible via le bouton flottant
        // en bas à droite, présent globalement sur le dashboard. Pas besoin d'un menu dédié.
        // L'entrée Tarification est volontairement absente du sidebar : la page est servie
        // sur la landing publique '/' (parcours d'inscription Odoo-style). La route reste
        // mappée plus bas pour les liens directs / paiement.
      ],
    }] : []),
    // Paiement : groupe réservé Admin/Manager regroupant la gestion d'abonnement et
    // l'historique de facturation. Remplace l'ancienne entrée footer « Mon abonnement »
    // qui était plate et ne donnait pas accès aux factures (cf. tasks 2026-05-19).
    ...((isAdmin || isManager) ? [{
      label: t('navigation.payment', 'Paiement'),
      href: '/dashboard/mon-abonnement',
      icon: Wallet,
      items: [
        { label: t('navigation.subscription', 'Abonnement'), href: '/dashboard/mon-abonnement', icon: Wallet },
        { label: t('navigation.concordeInvoices', 'Factures Concorde'), href: '/dashboard/factures-concorde', icon: Receipt },
      ],
    }] : []),
  ];

  // Filtre les groupes vides
  return allGroups.filter(
    (g) => g.items === undefined || g.items.length > 0 || g.href === '/dashboard'
  );
  }, [authReady, isAdmin, isEmp, isManager, hasPermission, planAllows, utiadm, isTrialing, t]);
};

/* ══════════════════════════════════════════════════════ */
/*  DemoPageContent                                       */
/* ══════════════════════════════════════════════════════ */
interface DemoPageContentProps {
  pathname: string;
}

function DemoPageContent({ pathname }: DemoPageContentProps) {
  const { t } = useTranslation();
  let content: React.ReactNode;

  switch (pathname) {
    // Landing publique : nouvelle homepage marketing (HomePage). PricingPage reste
    // accessible via /dashboard/pricing pour les utilisateurs authentifiés qui veulent
    // changer de plan, mais la racine '/' sert désormais la maquette commerciale.
    case '/': content = <HomePage />; break;
    case '/about': content = <AboutPage />; break;
    case '/login': content = <CredentialsSignInPage />; break;
    case '/signup': content = <SignupPage />; break;
    case '/download': content = <DownloadPage />; break;
    case '/plan-configuration': content = <PlanConfigurationPage />; break;
    case '/contact-sales': content = <ContactSalesPage />; break;
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
    case '/dashboard/calendrier-equipe': content = <TeamCalendarPage />; break;
    // case '/dashboard/accompte-salaire': content = <Accompte />; break;
    case '/dashboard/pointage-du-mois': content = <PointageDuMoisModern />; break;
    case '/dashboard/droit-de-conge': content = <EtatDroitConge />; break;
    case '/dashboard/pays': content = <PaysModern />; break;
    case '/dashboard/qualification': content = <QualificationModern />; break;
    case '/dashboard/fonction': content = <FonctionModern />; break;
    case '/dashboard/gestion-employe': content = <EffectifsGlobaux />; break;
    case '/dashboard/profil-employe': content = <EmployeModern />; break;
    case '/dashboard/fiche-employe':  content = <EmployeProfileView />; break;
    case '/dashboard/remboursement': content = <RemboursementModern />; break;
    case '/dashboard/missions': content = <MissionPage />; break;
    case '/dashboard/gestion-utilisateur': content = <Utilisateur />; break;
    case '/dashboard/droit-accees': content = <DroitAccessPointeuse />; break;
    case '/dashboard/droit-acces-site': content = <SiteAccessPage />; break;
    case '/dashboard/gestion-societe': content = <SocieteModern />; break;
    case '/dashboard/profile': content = <Profile />; break;
    case '/dashboard/societe': content = <BasicTabs />; break;
    case '/dashboard/parametres': content = <BasicTabs />; break;
    case '/dashboard/allaitement': content = <AllaitementModern />; break;
    case '/dashboard/contrat': content = <GestionContratsModern />; break;
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
    case '/dashboard/cet': content = <CetPage />; break;
    case '/dashboard/calendrier-societe': content = <Calendrier />; break;
    case '/dashboard/chat-bot': content = <Box p={3}>{t('navigation.chatBotPrompt')}</Box>; break;
    case '/dashboard/template-builder': content = <ContractBuilderModern />; break;
    case '/dashboard/documents': content = <DocumentsModern />; break;
    case '/dashboard/courriers': content = <LetterTemplatesModern />; break;
    case '/dashboard/rag-audit': content = <RagAuditTable />; break;
    case '/dashboard/sign-document': content = <SignaturePage />; break;
    case '/dashboard/pricing': content = <PricingPage />; break;
    case '/dashboard/plan-configuration': content = <PlanConfigurationPage />; break;
    case '/dashboard/mon-abonnement': content = <MonAbonnementPage />; break;
    case '/dashboard/factures-concorde': content = <FacturesConcordePage />; break;
    case '/dashboard/devis-pack': content = <DevisPackPage />; break;
    case '/upgrade': content = <PlanUpgradePage />; break;
    case '/dashboard/support': content = <SupportPage />; break;
    case '/dashboard/support/faq': content = <FAQPage />; break;
    case '/dashboard/support/formations': content = <FormationsPage />; break;
    case '/dashboard/support/coaching': content = <CoachingPage />; break;
    case '/dashboard/support/pack-mise-en-place': content = <PackMiseEnPlacePage />; break;
    case '/dashboard/support/contact': content = <ContactPage />; break;
    default: content = <DashboardModernSync />;
  }

  // SEC — Wrapper selon la classification de la route. Sans ce garde-fou, un
  // utilisateur non authentifié ou non-admin pouvait voir le squelette d'UI des
  // pages privilégiées avant que le backend ne renvoie 401/402. Ne remplace pas
  // la sécurité serveur — couvre la surface UI.
  const kind = classifyRoute(pathname);
  const guardedContent = kind === 'admin'
    ? <RequireAdmin>{content}</RequireAdmin>
    : kind === 'auth'
      ? <RequireAuth>{content}</RequireAuth>
      : content;

  // PERF — Suspense pour les pages React.lazy(). Sans Suspense, le 1er rendu d'une
  // page lazy throw et React démonte l'arbre. Le fallback est minimal (loader
  // centré) pour ne pas surcharger la transition entre routes.
  return (
    <Box sx={{
      py: 0, px: 0,
      display: 'flex', flexDirection: 'column',
      flexGrow: 1,
      minHeight: 0,
      bgcolor: (theme) => theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
    }}>
      <React.Suspense
        fallback={
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <CircularProgress />
          </Box>
        }
      >
        {guardedContent}
      </React.Suspense>
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
  const { t } = useTranslation();
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
          {t('navigation.recent')}: {item.label}
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
  _navigation: NavGroup[],
  onNavigate: (href: string) => void,
  clearAuth: () => void,
  userName?: string | null,
  onOpenPalette?: () => void
) {
  // Détection plateforme pour afficher le bon raccourci (⌘ vs Ctrl) sur le
  // bouton Recherche. Best-effort — sur SSR, navigator est undefined.
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

  function UserProfileMenu({ userName, isDark, clearAuth, onNavigate }: { userName?: string | null, isDark: boolean, clearAuth: () => void, onNavigate: (h: string) => void }) {
    const { t } = useTranslation();
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleClick = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);

    const handleProfile = () => { handleClose(); onNavigate('/dashboard/profile'); };
    // Application mobile : on ouvre la page /download dans un nouvel onglet pour
    // ne pas faire perdre le contexte de travail à l'utilisateur. La page propose
    // App Store / Play Store / APK direct + QR code (auto-détection iOS/Android).
    const handleDownloadApp = () => { handleClose(); window.open('/download', '_blank', 'noopener,noreferrer'); };
    const handleLogout = () => { handleClose(); clearAuth(); onNavigate('/'); };

    // Photo de profil : lue depuis localStorage (alimentée au login + au upload).
    // On écoute `imageUpdated` (dispatché par Profile.tsx après un upload) pour
    // que l'avatar de la navbar se rafraîchisse sans rechargement de page.
    const [avatarUrl, setAvatarUrl] = React.useState<string>(() => {
      const stored = localStorage.getItem('profileImage');
      return stored ? resolveAssetUrl(stored) : '';
    });
    React.useEffect(() => {
      const onImageUpdated = () => {
        const stored = localStorage.getItem('profileImage');
        setAvatarUrl(stored ? resolveAssetUrl(stored) : '');
      };
      window.addEventListener('imageUpdated', onImageUpdated);
      return () => window.removeEventListener('imageUpdated', onImageUpdated);
    }, []);

    return (
      <>
        <Tooltip title={userName || t('navigation.account')}>
          <Avatar
            src={avatarUrl || undefined}
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
            <ListItemText primary={t('navigation.myProfile')} primaryTypographyProps={{ fontSize: '13px', fontWeight: 600 }} />
          </MenuItem>
          <MenuItem onClick={handleDownloadApp}>
            <ListItemIcon><Smartphone size={22} /></ListItemIcon>
            <ListItemText
              primary={t('navigation.mobileApp', 'Application mobile')}
              secondary={t('navigation.mobileAppHint', 'Télécharger pour iOS / Android')}
              primaryTypographyProps={{ fontSize: '13px', fontWeight: 600 }}
              secondaryTypographyProps={{ fontSize: '11px' }}
            />
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout} sx={{ color: '#ba1a1a' }}>
            <ListItemIcon><LogOut size={22} color="#ba1a1a" /></ListItemIcon>
            <ListItemText primary={t('navigation.logout')} primaryTypographyProps={{ fontSize: '13px', fontWeight: 600 }} />
          </MenuItem>
        </Menu>
      </>
    );
  }

  return function ToolbarActions() {
    const { t } = useTranslation();
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

        {/* Search trigger : ouvre la Command Palette (Cmd/Ctrl+K).
            On garde l'apparence d'un input pour que l'utilisateur reconnaisse
            la zone de recherche, mais le clic ouvre une palette plus riche
            (pages + employés + demandes en attente, fuzzy matching, kbd nav). */}
        <Tooltip title={t('navigation.searchPage') + ' (' + (isMac ? '⌘K' : 'Ctrl+K') + ')'}>
          <Box
            onClick={() => onOpenPalette?.()}
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center', gap: 1,
              width: '280px', height: 36,
              px: 1.5,
              borderRadius: '12px',
              cursor: 'pointer',
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#f2f4f6',
              color: isDark ? '#94a3b8' : '#64748b',
              fontSize: '13px',
              transition: 'background-color 160ms ease',
              '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.10)' : '#e8ecef' },
            }}
          >
            <SearchIcon size={16} />
            <Typography sx={{ flex: 1, fontSize: '13px', color: 'inherit' }}>
              {t('navigation.searchPage')}
            </Typography>
            <Box sx={{
              fontSize: '10px', fontWeight: 700, fontFamily: 'monospace',
              px: 0.8, py: 0.2,
              borderRadius: '4px',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0',
              bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
              color: isDark ? '#cbd5e1' : '#475569',
            }}>
              {isMac ? '⌘K' : 'Ctrl K'}
            </Box>
          </Box>
        </Tooltip>

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
import { resolveAssetUrl } from '../../helpers/assetUrl';

function DashboardLayoutAccount(_props: DemoProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { authReady, clearAuth, userName, isAdmin, uticod, planAllows } = useAuth();
  const isAuthenticated = Boolean(uticod);
  // 2026-05-12 : l'assistant IA (RAG) est gaté au plan Premium. Sur Starter/Standard,
  // on masque le bouton flottant — sinon l'utilisateur l'ouvre et tous les appels
  // échouent en 402 côté backend (RagController gaté par RequirePlanFeature(RagAi)).
  const chatbotAllowed = planAllows('ragAi');
  const { i18n, t } = useTranslation();
  const NAVIGATION = useNavigationItems();
  const outerTheme = useMuiTheme();
  const isDark = outerTheme.palette.mode === 'dark';
  const pathname = location.pathname;

  // Réécriture transparente des URLs : on supprime le préfixe `/dashboard/` de toutes les pages
  // sauf `/dashboard` lui-même. Cela couvre :
  //   - Les clics sidebar (les hrefs sont gardés en /dashboard/X côté config pour ne pas casser
  //     les checks `pathname === '/dashboard/X'` éparpillés dans la codebase) → redirigés vers /X.
  //   - Les `navigate('/dashboard/X')` déclenchés depuis d'autres composants (chatbot, dashboards,
  //     liens Coffre-fort, etc.) → idem.
  // L'utilisateur voit donc /employes au lieu de /dashboard/employes dans la barre d'URL.
  React.useEffect(() => {
    if (pathname.startsWith('/dashboard/') && pathname !== '/dashboard') {
      const stripped = pathname.replace(/^\/dashboard/, '');
      navigate(stripped + location.search + location.hash, { replace: true });
    }
  }, [pathname, location.search, location.hash, navigate]);

  // Pour le rendu (tabs, breadcrumb, switch de la page courante), on raisonne toujours sur la
  // forme canonique avec /dashboard/ préfixée : la nav config et les case '/dashboard/X' du
  // switch restent inchangées. La barre d'URL, elle, montre la version courte.
  const PUBLIC_PATHS = ['/', '/about', '/login', '/signup', '/plan-configuration', '/payment', '/contact-sales', '/download'];
  const canonicalPathname = (pathname === '/dashboard' || pathname.startsWith('/dashboard/') || PUBLIC_PATHS.includes(pathname))
    ? pathname
    : `/dashboard${pathname}`;

  const [societeImage, setSocieteImage] = React.useState<string>(() => {
    const stored = localStorage.getItem('societeImage');
    return stored ? resolveAssetUrl(stored) : '/concorde-wrokly-logo.jpg';
  });

  React.useEffect(() => {
    const handleStorageChange = () => {
      const societe = localStorage.getItem('societeImage');
      setSocieteImage(societe ? resolveAssetUrl(societe) : '/concorde-wrokly-logo.jpg');
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
    const matched = navItems.find(n => n.href === canonicalPathname);

    // Format demandé : « Concorde Workforce | <page> » (la marque d'abord, le
    // nom de page en suffixe). Avant 2026-05-19 c'était l'inverse — décision
    // produit pour mettre la marque en premier dans l'onglet du navigateur.
    if (matched) {
      document.title = `Concorde Workforce | ${matched.label}`;
    } else if (canonicalPathname === '/dashboard') {
      document.title = `Concorde Workforce | ${t('navigation.dashboard')}`;
    } else if (pathname === '/login') {
      document.title = `Concorde Workforce | ${t('navigation.loginTitle')}`;
    } else if (pathname === '/signup') {
      document.title = `Concorde Workforce | ${t('navigation.signupTitle')}`;
    } else if (pathname === '/') {
      document.title = `Concorde Workforce | ${t('navigation.pricingTitle')}`;
    } else {
      document.title = `Concorde Workforce`;
    }
  }, [pathname, canonicalPathname, NAVIGATION, t]);

  // ── Tab Management State ──
  // Le label par défaut est lu depuis i18n pour rester cohérent avec la langue active.
  // Limite max d'onglets affichés simultanément. Au-delà, on évince l'onglet
  // le plus ancien (FIFO sur les non-dashboard) pour éviter la barre infinie.
  const MAX_OPEN_TABS = 4;

  // Cas particulier : les onglets persistés en localStorage gardent leur label sauvegardé
  // (snapshot de la langue à l'ouverture) — un changement de langue ne renomme donc pas
  // les onglets déjà ouverts.
  // À la 1re connexion (rien en localStorage) on démarre avec une barre VIDE :
  // l'objectif UX est de ne rien afficher avant que l'utilisateur navigue lui-même
  // sur une page. Avant, le tab "Dashboard" était auto-créé et encombrait la vue.
  // On filtre aussi le tab Dashboard et tronque à MAX_OPEN_TABS pour migrer en
  // douceur les utilisateurs ayant l'ancienne version persistée.
  const [openedTabs, setOpenedTabs] = React.useState<OpenedTab[]>(() => {
    const saved = localStorage.getItem('openedTabs');
    if (!saved) return [];
    try {
      const parsed: OpenedTab[] = JSON.parse(saved);
      const filtered = parsed.filter(t => t.href !== '/dashboard').slice(-MAX_OPEN_TABS);
      return filtered;
    } catch {
      return [];
    }
  });

  // Track navigation to add tabs (cap MAX_OPEN_TABS, FIFO eviction).
  React.useEffect(() => {
    if (pathname === '/' || pathname === '/about' || pathname === '/login' || pathname === '/signup' || pathname === '/plan-configuration' || pathname === '/payment' || pathname === '/contact-sales' || pathname === '/download') return;
    // Le dashboard est la page d'accueil par défaut, pas un onglet : on ne le
    // crée pas dans la barre d'onglets pour ne pas l'encombrer dès le login.
    if (canonicalPathname === '/dashboard' || pathname === '/dashboard') return;

    // Find the item in flattened navigation to get title and icon
    const flatten = (items: NavGroup[]): any[] => items.flatMap(g => [g, ...(g.items || [])]);
    const navItems = flatten(NAVIGATION);
    const matched = navItems.find(n => n.href === canonicalPathname);

    if (matched) {
      setOpenedTabs(prev => {
        if (prev.some(t => t.href === matched.href)) return prev;
        let next: OpenedTab[] = [...prev, { label: matched.label, href: matched.href, icon: matched.icon?.name || 'LayoutGrid' }];
        // FIFO eviction si on dépasse la limite — on enlève le plus ancien
        // (premier élément du tableau) sauf s'il s'agit de la page courante.
        while (next.length > MAX_OPEN_TABS) {
          const oldestIdx = next.findIndex(t => t.href !== pathname && t.href !== canonicalPathname);
          if (oldestIdx === -1) break;
          next.splice(oldestIdx, 1);
        }
        localStorage.setItem('openedTabs', JSON.stringify(next));
        return next;
      });
    }
  }, [pathname, canonicalPathname, NAVIGATION]);

  // ── Recent Pages Tracking ──
  React.useEffect(() => {
    if (pathname === '/' || pathname === '/about' || pathname === '/login' || pathname === '/signup' || pathname === '/plan-configuration' || pathname === '/payment' || pathname === '/contact-sales' || pathname === '/download' || canonicalPathname === '/dashboard') return;

    const flatten = (items: NavGroup[]): any[] => items.flatMap(g => [g, ...(g.items || [])]);
    const navItems = flatten(NAVIGATION);
    const matched = navItems.find(n => n.href === canonicalPathname);

    if (matched) {
      const saved = localStorage.getItem('recentPages');
      let recent: RecentItem[] = saved ? JSON.parse(saved) : [];
      // Remove if exists and put at start
      recent = recent.filter(r => r.href !== matched.href);
      recent.unshift({ label: matched.label, href: matched.href });
      recent = recent.slice(0, 5);
      localStorage.setItem('recentPages', JSON.stringify(recent));
    }
  }, [pathname, canonicalPathname, NAVIGATION]);


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
    // Tout fermer = barre vide. L'utilisateur revient au dashboard mais sans
    // créer un onglet de plus (cohérent avec le comportement de 1re connexion).
    setOpenedTabs([]);
    localStorage.setItem('openedTabs', JSON.stringify([]));
    if (pathname !== '/dashboard') navigate('/dashboard');
  };


  const ToolbarActions = React.useMemo(
    () => makeToolbarActions(isDark, NAVIGATION, (h) => navigate(h), clearAuth, userName, () => setPaletteOpen(true)),
    [isDark, NAVIGATION, navigate, clearAuth, userName]
  );

  // ── Command Palette (Cmd/Ctrl+K) ──
  // On écoute au niveau document : capture toutes les frappes même quand le
  // focus est dans une input (sauf si elle a déjà consommé l'événement). On
  // n'enregistre l'écouteur qu'une fois `authReady` car le palette dépend
  // de `soccod` pour ses fetches.
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  React.useEffect(() => {
    if (!authReady) return;
    const onKey = (e: KeyboardEvent) => {
      const isShortcut = (e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K');
      if (isShortcut) {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [authReady]);

  const footerItems: FooterItem[] = [
    { label: t('navigation.support'), href: '/dashboard/support', icon: LifeBuoy },
    // « Mon abonnement » a quitté le footer le 2026-05-19 : il est désormais regroupé
    // avec « Factures Concorde » sous le groupe Paiement de la nav principale (réservé
    // Admin/Manager). Voir allGroups plus haut.
    { label: t('navigation.settings'), href: '/dashboard/parametres', icon: Settings },
    { label: t('navigation.logout'), href: '#', icon: LogOut, onClick: () => { clearAuth(); navigate('/'); } },
  ];

  // Pages publiques (rendues sans la barre latérale) : landing pricing + login.
  const isPublicPage = pathname === '/' || pathname === '/about' || pathname === '/login' || pathname === '/signup' || pathname === '/plan-configuration' || pathname === '/payment' || pathname === '/contact-sales' || pathname === '/download';
  const isProfilePage = canonicalPathname === '/dashboard/profil-employe';

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
    return (
      <>
        <PageFade routeKey={canonicalPathname}>
          <DemoPageContent pathname={canonicalPathname} />
        </PageFade>
        {/* Assistant IA : réservé aux utilisateurs connectés ET au plan Premium
            (feature `RagAi` côté backend). Avant, on l'exposait sur la landing
            publique mais le backend renvoyait 401 ; depuis 2026-05-12 on ajoute
            aussi le gating de plan pour éviter les 402 sur Starter/Standard. */}
        {isAuthenticated && chatbotAllowed && (
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <UnifiedAssistantHub />
          </Box>
        )}
      </>
    );
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
        pathname={canonicalPathname}
        onNavigate={(to) => navigate(to)}
        title={title}
        logo={logo}
        isAdmin={isAdmin}
        toolbarActions={<ToolbarActions />}
      >
        <TrialBanner />
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
            const active = canonicalPathname === tab.href;
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
            <Tooltip title={t('navigation.closeAllTabs')} arrow>
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
                  {t('navigation.closeAll')}
                </Typography>
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <PageFade routeKey={canonicalPathname}>
          <DemoPageContent pathname={canonicalPathname} />
        </PageFade>
      </SidebarNavigationDualTier>

      {pathname !== '/' && isAuthenticated && chatbotAllowed && (
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <UnifiedAssistantHub />
        </Box>
      )}
      {/* Command Palette : ouvert via Cmd/Ctrl+K ou via le bouton Recherche
          du header. Monté ici pour rester accessible quelle que soit la page
          courante du dashboard. */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        navigation={NAVIGATION}
      />
    </>
  );
}

/* ══════════════════════════════════════════════════════ */
/*  Export                                                */
/* ══════════════════════════════════════════════════════ */
export default function DashboardLayoutBasic(props: DemoProps) {
  return <DashboardLayoutAccount {...props} />;
}
