import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from "@tanstack/react-query";
import apiInstance from "../API/apiInstance";
import { RolePermission } from "../../models/Role";

interface AuthContextType {
  soccod: string | null;
  soclib: string | null;
  sitcod: string | null;
  // Pays souscrit (FR/BE/MA/SN/TN/DZ…). Source : Tenant via /Utilisateurs/me. Sert aux
  // affichages dépendant du pays (ex : devise du cahier de congé).
  countryCode: string | null;
  userName: string | null;
  uticod: string | null;
  utiadm: string | null;
  // Nom du rôle RBAC (ex: "Administrator", "Manager", "Employee", ou rôle custom).
  // Source de vérité côté front : prefer to use `isAdmin` / `hasPermission` rather than
  // comparing to roleName directly, sauf pour des libellés UI.
  roleName: string | null;
  // Computed côté backend dans /me. True ssi roleName === "Administrator" ou utiadm === "1".
  isAdmin: boolean;
  isEmp: boolean;
  isManager: boolean;
  sercod: string | null;
  // Vrai si l'utilisateur cumule un rôle de GESTION (admin / manager / responsable RH) ET une
  // fiche employé : il peut alors basculer entre l'interface de gestion et son espace salarié.
  isDualRole: boolean;
  // Vue active choisie par un utilisateur dual-role : 'management' = interface manager/RH/admin,
  // 'employee' = espace salarié. Front-only — le backend continue d'appliquer les VRAIES
  // permissions ; la bascule ne fait que MASQUER des modules, jamais en débloquer (donc sûre).
  viewMode: 'management' | 'employee';
  // Raccourci dérivé (isDualRole && viewMode === 'employee'). Consommé par la navigation et le
  // dashboard pour forcer l'expérience salarié quand l'utilisateur a choisi sa vue « salarié ».
  viewAsEmployee: boolean;
  // Vrai quand l'utilisateur doit voir les données de GESTION (listes de tous les employés /
  // demandes de l'équipe) plutôt que ses seules données salarié. = rôle de gestion (admin /
  // manager / ResponsableRH) ET pas en vue « salarié ». Source unique de vérité pour les hooks
  // qui choisissaient l'endpoint via `isEmp` brut — ce qui cassait pour un dual-rôle (employé +
  // manager) resté scopé à lui-même en mode Gestion. À utiliser à la place de `!isEmp`.
  isManagementView: boolean;
  setViewMode: (mode: 'management' | 'employee') => void;
  // État de l'abonnement / essai gratuit. isTrialing === true ⇒ limites Trial actives
  // (10 collaborateurs, 1 société/filiale, états & paie masqués). Source : /Utilisateurs/me.
  isTrialing: boolean;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  // True ssi l'utilisateur a confirmé son email via le code OTP envoyé au signup.
  // Source : Utilisateur.UtiEmailVerified == "1". Consommé par /verify-email pour
  // sortir de la page une fois vérifié, et par le dashboard pour afficher un bandeau
  // de rappel tant que false.
  emailVerified: boolean;
  // Email courant — utile pour pré-remplir /verify-email + afficher dans la bannière.
  utimail: string | null;
  planCode: string | null;
  planLimits: {
    maxEmployees: number | null;
    maxSocietes: number | null;
    maxSites: number | null;
    includedEmployees?: number;
    overageRatePerEmployee?: number;
  } | null;
  // Matrice fonctionnelle envoyée par le backend (cf. PlanCatalog.cs). En essai, les flags
  // sont forcés à true côté serveur pour que l'utilisateur teste l'intégralité de la solution.
  planFeatures: PlanFeatures | null;
  /**
   * Addons EXPLICITEMENT souscrits par le tenant en plus de son pack (cf. Tenant.Addons,
   * signupController.NormalizeAddons). Les clés correspondent à ValidAddonKeys côté backend
   * (`aiAssistantRh`, `iaDocumentaireAvancee`, `signatureElectronique`, `apiAvancee`,
   * `supportPrioritaire`). Utilisé par MonAbonnementPage pour distinguer "inclus dans le
   * pack" vs "module additionnel". Les fonctionnalités correspondantes sont déjà fusionnées
   * dans `planFeatures` côté backend — cette liste est juste un détail de souscription.
   */
  addons: string[];
  /**
   * Couleurs de base personnalisées du tenant (option « Branding personnalisé », Premium ou
   * addon CustomBranding). null = thème par défaut. Le backend ne renvoie ces couleurs que si
   * le tenant y a droit, donc un downgrade rebascule automatiquement sur le thème standard.
   * Appliquées au thème MUI via App.tsx (lu aussi depuis localStorage 'tenantBranding').
   */
  branding: TenantBranding | null;
  authReady: boolean;
  permissions: RolePermission[];
  hasPermission: (module: string, action: 'consult' | 'add' | 'modify' | 'delete') => boolean;
  /** True si la feature est activée pour le plan courant (ou pendant l'essai). */
  planAllows: (feature: keyof PlanFeatures) => boolean;
  setAuthData: (data: Partial<AuthContextType>) => void;
  refreshAuth: () => Promise<void>;
  clearAuth: () => void;
}

export interface PlanFeatures {
  mobileApp: boolean;
  geolocation: boolean;
  digitalVault: boolean;
  electronicSignature: boolean;
  multiSite: boolean;
  multiSociete: boolean;
  advancedDashboards: boolean;
  ragAi: boolean;
  advancedAuditLogs: boolean;
  customBranding: boolean;
  deviceTrustEnforced: boolean;
  screenshotProtection: boolean;
  certificatePinning: boolean;
  // Modules RH avancés réservés Standard/Premium.
  missions: boolean;
  compensationDays: boolean;
  generalLeave: boolean;
  generalExit: boolean;
  // 2026-05-12 : workflow congé + autorisation, exclus du pack Starter
  // (positionnement "pointage simple" — seul l'état périodique reste accessible).
  leaveManagement: boolean;
  authorizationManagement: boolean;
  // 2026-05-23 : modules métier facturables — exclus du Starter par défaut.
  expenseReports: boolean;            // Notes de frais (NoteDeFraisController)
  breastfeedingManagement: boolean;   // Allaitement (AllaitementsController)
  contractManagement: boolean;        // Gestion des contrats (ContratsController)
  documentScanOcr: boolean;           // Scan OCR de pièces d'identité (DocumentScanController)
  bulkImport: boolean;                // Import Excel en masse de toutes les données de base (BulkImportController)
  // 2026-05-26 — Flags addon-only (jamais inclus nativement dans un pack) :
  // apiAccess         = débloqué par l'addon apiAvancee → sidebar "API & Intégrations".
  // prioritySupport   = débloqué par l'addon supportPrioritaire → badge "Prioritaire" sur menu Support.
  apiAccess: boolean;
  prioritySupport: boolean;
  // Assistant IA conversationnel (addon « Assistant RH IA » / aiAssistantRh). Distinct du RAG
  // documentaire (ragAi, sur devis). Contrôle l'affichage du chatbot flottant (onglet Assistant).
  aiChatbot: boolean;
}

/** Couleurs de base personnalisables via l'option « Branding personnalisé ». */
export interface TenantBranding {
  primary?: string | null;
  background?: string | null;
  title?: string | null;
}

const AuthContext = createContext<AuthContextType>({
  soccod: null,
  soclib: null,
  sitcod: null,
  countryCode: null,
  userName: null,
  uticod: null,
  utiadm: null,
  roleName: null,
  isAdmin: false,
  isEmp: false,
  isManager: false,
  sercod: null,
  isDualRole: false,
  viewMode: 'management',
  viewAsEmployee: false,
  isManagementView: false,
  setViewMode: () => { },
  isTrialing: false,
  trialEndsAt: null,
  trialDaysRemaining: null,
  emailVerified: false,
  utimail: null,
  planCode: null,
  planLimits: null,
  planFeatures: null,
  addons: [],
  branding: null,
  authReady: false,
  permissions: [],
  hasPermission: () => false,
  planAllows: () => false,
  setAuthData: () => { },
  refreshAuth: async () => { },
  clearAuth: () => { },
});

// SEC — `utiadm` n'est PLUS persisté : sa valeur est lisible/modifiable depuis la
// console DevTools, donc un attaquant pouvait écrire `sessionStorage.setItem('utiadm','1')`
// pour obtenir l'UI admin (le backend restait le vrai garde-fou, mais l'UI exposait
// la matrice de modules privilégiés). L'état admin n'est désormais dérivé que de la
// réponse `/me` authentifiée.
const persistedKeys = new Set(["soccod", "soclib", "sitcod", "userName", "uticod"]);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const requestIdRef = useRef(0);
  // Cache React Query partagé (singleton). On le vide au logout ET au changement
  // de tenant pour empêcher qu'un compte voie les données mises en cache du compte
  // précédent (bug observé : mêmes KPI dashboard après reconnexion sur un autre
  // compte). Sans ça, les requêtes au staleTime non expiré (5 min) resservaient des
  // valeurs périmées tant que la clé de requête coïncidait.
  const queryClient = useQueryClient();
  // Dernier soccod authentifié — sert à détecter un changement de tenant pour purger
  // le cache même quand l'utilisateur enchaîne deux connexions sans logout explicite.
  const prevSoccodRef = useRef<string | null>(sessionStorage.getItem('soccod'));
  // Hydrate l'état initial depuis sessionStorage uniquement pour les libellés
  // d'affichage non sensibles (soccod, soclib, sitcod, userName, uticod). Les flags
  // de privilège (isAdmin, utiadm, isManager, permissions, planFeatures) restent
  // null/false jusqu'à la réponse `/me`.
  const persistedUticod = sessionStorage.getItem('uticod');
  const [authReady, setAuthReady] = useState(false);

  // Vue active d'un utilisateur dual-role (manager/RH/admin également salarié). Persistée en
  // sessionStorage car purement cosmétique (elle ne fait que masquer des modules — le
  // backend reste l'autorité sur les permissions, donc aucun risque à la persister, contrairement
  // à `utiadm`). Réinitialisée à 'management' au logout.
  const [viewMode, setViewModeState] = useState<'management' | 'employee'>(
    (sessionStorage.getItem('viewMode') as 'management' | 'employee') || 'management'
  );
  const setViewMode = useCallback((mode: 'management' | 'employee') => {
    sessionStorage.setItem('viewMode', mode);
    setViewModeState(mode);
  }, []);
  const [authData, setAuthData] = useState({
    soccod: sessionStorage.getItem('soccod'),
    sitcod: sessionStorage.getItem('sitcod'),
    soclib: sessionStorage.getItem('soclib'),
    countryCode: null as string | null,
    userName: sessionStorage.getItem('userName') || null,
    uticod: persistedUticod,
    utiadm: null as string | null,
    roleName: null as string | null,
    isAdmin: false,
    isEmp: false,
    isManager: false,
    sercod: null as string | null,
    isTrialing: false,
    trialEndsAt: null as string | null,
    trialDaysRemaining: null as number | null,
    emailVerified: false,
    utimail: null as string | null,
    planCode: null as string | null,
    planLimits: null as {
      maxEmployees: number | null;
      maxSocietes: number | null;
      maxSites: number | null;
      includedEmployees?: number;
      overageRatePerEmployee?: number;
    } | null,
    planFeatures: null as PlanFeatures | null,
    addons: [] as string[],
    // Hydraté depuis localStorage pour que le thème personnalisé soit dispo dès le 1er rendu
    // (avant le retour de /me), évitant un flash de couleurs par défaut au rechargement.
    branding: ((): TenantBranding | null => {
      try { const s = localStorage.getItem('tenantBranding'); return s ? JSON.parse(s) : null; } catch { return null; }
    })(),
    permissions: [] as RolePermission[],
  });

  // Routes où l'utilisateur est attendu DÉCONNECTÉ. Sur ces pages, déclencher
  // GET /me + POST /refresh provoque deux 401 inutiles et bruite les logs serveur
  // (cf. cycle redondant observé après logout : /parametres → /me 401 → /refresh
  // 401 → redirect /login → /me 401 + /refresh 401 à nouveau). On court-circuite
  // donc refreshAuth() en posant immédiatement l'état "logged-out".
  // NB : /, /download, /contact-sales restent intacts — sur ces landing
  // pages publiques, savoir si le visiteur est déjà connecté reste utile (lien
  // « Dashboard » dans la nav vs « Connexion »).
  const AUTH_FREE_PATHS = new Set(['/login', '/signup', '/reset-password', '/forgot-password']);

  const refreshAuth = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setAuthReady(false);

    // Court-circuit : sur les pages d'auth, l'utilisateur est par définition
    // déconnecté. On évite l'aller-retour /me + /refresh qui retourneront 401.
    // SAUF si `setAuthData` vient juste de poser un `uticod` (cas Login.tsx :
    // après POST /Utilisateurs/connect, processLoginSuccess fait setAuthData()
    // PUIS appelle refreshAuth() AVANT de naviguer). Sans cette garde, le
    // raccourci écrasait l'uticod fraîchement posé et le user se voyait
    // re-rediriger vers /login alors que la connexion avait réussi. setAuth()
    // ci-dessous persiste uticod dans sessionStorage de façon synchrone — on
    // peut donc s'en servir comme « tampon » pour distinguer « pas encore
    // authentifié » de « tout juste authentifié ».
    if (typeof window !== 'undefined'
        && AUTH_FREE_PATHS.has(window.location.pathname)
        && !sessionStorage.getItem('uticod')) {
      setAuthData((prev) => ({
        ...prev,
        uticod: null, utiadm: null, roleName: null,
        isAdmin: false, isEmp: false, isManager: false,
        sercod: null, isTrialing: false, trialEndsAt: null,
        trialDaysRemaining: null, planCode: null,
        planLimits: null, planFeatures: null, addons: [], permissions: [],
        emailVerified: false, utimail: null,
      }));
      setAuthReady(true);
      return;
    }

    try {
      // apiInstance injecte automatiquement le header X-Tenant-Slug depuis localStorage('tenantSlug')
      // ou depuis le sous-domaine. Critique pour que le TenantResolverMiddleware route vers
      // la bonne base et que /me trouve l'admin du tenant courant (au lieu de la base legacy).
      const response = await apiInstance.get(`/Utilisateurs/me`);

      if (requestId !== requestIdRef.current) return;

      setAuthData((prev) => ({
        ...prev,
        uticod: response.data.uticod ?? null,
        utiadm: response.data.utiadm ?? null,
        roleName: response.data.roleName ?? null,
        isAdmin: Boolean(response.data.isAdmin),
        isManager: Boolean(response.data.isManager),
        isEmp: Boolean(response.data.isEmp),
        sercod: response.data.sercod ?? null,
        userName: response.data.utilib ?? prev.userName ?? null,
        permissions: response.data.permissions ?? [],
        // Société/site du tenant — propagés en sessionStorage en dessous pour que les
        // composants legacy qui lisent sessionStorage('soccod') fonctionnent après signup direct.
        soccod: response.data.soccod ?? prev.soccod ?? null,
        sitcod: response.data.sitcod ?? prev.sitcod ?? null,
        soclib: response.data.soclib ?? prev.soclib ?? null,
        countryCode: response.data.countryCode ?? prev.countryCode ?? null,
        isTrialing: Boolean(response.data.isTrialing),
        trialEndsAt: response.data.trialEndsAt ?? null,
        trialDaysRemaining: response.data.trialDaysRemaining ?? null,
        emailVerified: Boolean(response.data.emailVerified),
        utimail: response.data.utimail ?? null,
        planCode: response.data.planCode ?? null,
        planLimits: response.data.planLimits ?? null,
        planFeatures: response.data.planFeatures ?? null,
        addons: Array.isArray(response.data.addons) ? response.data.addons : [],
        branding: (response.data.branding ?? null) as TenantBranding | null,
      }));

      // Persist société/site/userName dans sessionStorage : le dashboard et les autres pages
      // les lisent directement depuis sessionStorage pour éviter de re-fetcher à chaque navigation.
      // Indispensable pour que le post-signup → /dashboard fonctionne sans repasser par /login.
      if (response.data.soccod) sessionStorage.setItem('soccod', response.data.soccod);
      if (response.data.sitcod) sessionStorage.setItem('sitcod', response.data.sitcod);
      if (response.data.soclib) sessionStorage.setItem('soclib', response.data.soclib);
      if (response.data.utilib) sessionStorage.setItem('userName', response.data.utilib);
      if (response.data.uticod) sessionStorage.setItem('uticod', response.data.uticod);
      // SEC — utiadm N'EST PLUS persisté côté client (cf. note en tête du fichier).
      // L'état admin se redérive de /me à chaque init de l'app.

      // Photo de profil : on synchronise localStorage('profileImage') dès que /me
      // remonte une nouvelle valeur, et on dispatche `imageUpdated` pour que la
      // navbar (UserProfileMenu) bascule sur la photo immédiatement. Sans ça, un
      // user qui upload sa photo sur mobile devait se déconnecter du web pour
      // voir la photo apparaître dans la nav.
      const newUtiimg = response.data.utiimg as string | null | undefined;
      const prevUtiimg = localStorage.getItem('profileImage');
      if (newUtiimg) {
        if (newUtiimg !== prevUtiimg) {
          localStorage.setItem('profileImage', newUtiimg);
          window.dispatchEvent(new Event('imageUpdated'));
        }
      } else if (prevUtiimg) {
        // L'utilisateur a supprimé sa photo côté serveur — on retire aussi le cache local.
        localStorage.removeItem('profileImage');
        window.dispatchEvent(new Event('imageUpdated'));
      }

      // Branding personnalisé : on cache les couleurs en localStorage et on notifie App.tsx
      // (`brandingUpdated`) pour reconstruire le thème MUI immédiatement. Le backend ne renvoie
      // `branding` que si le tenant y a droit → un downgrade renvoie null et réinitialise le thème.
      try {
        if (response.data.branding) {
          localStorage.setItem('tenantBranding', JSON.stringify(response.data.branding));
        } else {
          localStorage.removeItem('tenantBranding');
        }
        window.dispatchEvent(new Event('brandingUpdated'));
      } catch { /* localStorage indispo (mode privé) : le thème par défaut s'applique. */ }
    } catch {
      if (requestId !== requestIdRef.current) return;

      setAuthData((prev) => ({
        ...prev,
        uticod: null,
        utiadm: null,
        roleName: null,
        isAdmin: false,
        isEmp: false,
        isManager: false,
        sercod: null,
        isTrialing: false,
        trialEndsAt: null,
        trialDaysRemaining: null,
        emailVerified: false,
        utimail: null,
        planCode: null,
        planLimits: null,
        planFeatures: null,
        addons: [],
        branding: null,
        permissions: [],
        countryCode: null,
      }));
    } finally {
      if (requestId === requestIdRef.current) {
        setAuthReady(true);
      }
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  // Purge du cache au CHANGEMENT DE TENANT : si /me révèle un soccod différent du
  // précédent (reconnexion sur un autre compte sans logout explicite, ou bascule de
  // société), on jette le cache React Query pour éviter que le nouveau compte voie
  // les KPI/listes mis en cache de l'ancien. On NE purge PAS quand soccod est
  // inchangé (refresh normal) ni au tout premier passage null→valeur (cache déjà vide).
  useEffect(() => {
    const current = authData.soccod;
    const prev = prevSoccodRef.current;
    if (current && prev && current !== prev) {
      queryClient.clear();
    }
    if (current) prevSoccodRef.current = current;
  }, [authData.soccod, queryClient]);

  // PERF — useCallback stables : ces fonctions sont passées dans value={...} du
  // Provider. Sans ça, chaque render du Provider créait de nouvelles références →
  // tous les consumers de useAuth (Navigation, dashboards, pages) re-rendaient.
  const setAuth = useCallback((data: Partial<AuthContextType>) => {
    setAuthData((prev) => ({ ...prev, ...data }));

    Object.entries(data).forEach(([key, value]) => {
      if (!persistedKeys.has(key)) return;

      if (typeof value === 'string' && value !== null) {
        sessionStorage.setItem(key, value);
      } else if (value == null) {
        sessionStorage.removeItem(key);
      }
    });
  }, []);

  const clearAuth = useCallback(() => {
    requestIdRef.current += 1;
    // SEC — Best-effort : informer le serveur de révoquer le refresh-token. Pas
    // d'await sur le contrôle de flux UI — si le serveur est down, on logout
    // quand même côté client. apiInstance retourne 401 silencieusement si déjà
    // expiré, ce qui est OK.
    apiInstance.post('/Utilisateurs/logout').catch(() => { /* best-effort */ });

    // Purge TOTALE du cache React Query : aucune donnée du compte sortant ne doit
    // survivre pour le prochain login (KPI dashboard, listes employés, etc.).
    queryClient.clear();
    prevSoccodRef.current = null;

    sessionStorage.removeItem('soccod');
    sessionStorage.removeItem('soclib');
    sessionStorage.removeItem('sitcod');
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('uticod');
    sessionStorage.removeItem('utiadm'); // nettoyage rétrocompat
    sessionStorage.removeItem('viewMode');
    setViewModeState('management');
    localStorage.removeItem('profileImage');
    localStorage.removeItem('societeImage');
    // Réinitialise le thème personnalisé au logout (le prochain compte n'hérite pas des couleurs).
    localStorage.removeItem('tenantBranding');
    window.dispatchEvent(new Event('brandingUpdated'));

    setAuthReady(true);
    setAuthData({
      soccod: null,
      soclib: null,
      sitcod: null,
      countryCode: null,
      userName: null,
      uticod: null,
      utiadm: null,
      roleName: null,
      isAdmin: false,
      isEmp: false,
      isManager: false,
      sercod: null,
      isTrialing: false,
      trialEndsAt: null,
      trialDaysRemaining: null,
      emailVerified: false,
      utimail: null,
      planCode: null,
      planLimits: null,
      planFeatures: null,
      addons: [],
      branding: null,
      permissions: [],
    });
  }, [queryClient]);

  /**
   * Vérifie qu'une feature commerciale (cf. PlanCatalog côté backend) est ouverte au plan
   * courant. Pendant l'essai, le backend force tous les flags à true.
   *
   * SEC — Fail-closed : si planFeatures est null (tenant legacy, /me pas encore appelé,
   * erreur réseau), on refuse l'accès au lieu de l'autoriser. Avant ce durcissement, une
   * erreur transitoire ouvrait toute la matrice Premium côté UI (le backend renvoyait 402
   * mais l'expérience révélait toutes les features payantes). Le rendu des sections
   * premium doit accepter le state "loading" pendant que /me est en vol.
   */
  const planAllows = useCallback((feature: keyof PlanFeatures) => {
    if (!authData.planFeatures) return false;
    return Boolean(authData.planFeatures[feature]);
  }, [authData.planFeatures]);

  const hasPermission = useCallback((module: string, action: 'consult' | 'add' | 'modify' | 'delete') => {
    // Bypass admin uniquement (god mode). Un manager ou tout autre rôle doit avoir la
    // permission explicite dans sa matrice — sinon le RBAC n'a aucune valeur.
    if (authData.isAdmin || authData.utiadm === '1') return true;
    const perm = authData.permissions.find(p => p.rpModule === module);
    if (!perm) return false;

    switch (action) {
      case 'consult': return perm.rpConsult === '1';
      case 'add': return perm.rpAdd === '1';
      case 'modify': return perm.rpModify === '1';
      case 'delete': return perm.rpDelete === '1';
      default: return false;
    }
  }, [authData.permissions, authData.utiadm, authData.isAdmin]);

  // PERF — `value` mémoïsé : sans cette mémoïsation, un nouvel objet était créé à
  // chaque render du Provider (les callbacks/data étant identiques), forçant tous
  // les consumers de `useAuth()` (Navigation, dashboards, ~70 pages) à re-render.
  // Avec useMemo, on ne reconstruit qu'aux vrais changements de state authentif.
  // Dual-role = fiche employé + rôle de gestion (admin, manager, ou Responsable RH). Seuls ces
  // utilisateurs voient le sélecteur d'interface. `viewAsEmployee` force l'espace salarié quand
  // ils ont choisi la vue « salarié » ; sinon (non dual-role, ou vue gestion) il reste false.
  const isDualRole = Boolean(
    authData.isEmp && (authData.isAdmin || authData.isManager || authData.roleName === 'ResponsableRH')
  );
  const viewAsEmployee = isDualRole && viewMode === 'employee';
  // Vue de gestion effective : rôle de gestion ET pas en train de regarder son espace salarié.
  // Pour un non-employé (admin/manager pur) viewAsEmployee est toujours false → management.
  // Pour un dual-rôle, suit le sélecteur d'interface. Pour un employé simple → false.
  const isManagementView = Boolean(
    (authData.isAdmin || authData.isManager || authData.roleName === 'ResponsableRH') && !viewAsEmployee
  );

  const value = useMemo(
    () => ({
      ...authData, authReady, hasPermission, planAllows, setAuthData: setAuth, refreshAuth, clearAuth,
      isDualRole, viewMode, viewAsEmployee, isManagementView, setViewMode,
    }),
    [authData, authReady, hasPermission, planAllows, setAuth, refreshAuth, clearAuth,
     isDualRole, viewMode, viewAsEmployee, isManagementView, setViewMode]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);