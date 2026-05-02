import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import apiInstance from "../API/apiInstance";
import { RolePermission } from "../../models/Role";

interface AuthContextType {
  soccod: string | null;
  soclib: string | null;
  sitcod: string | null;
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
  // État de l'abonnement / essai gratuit. isTrialing === true ⇒ limites Trial actives
  // (10 collaborateurs, 1 société/filiale, états & paie masqués). Source : /Utilisateurs/me.
  isTrialing: boolean;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  planCode: string | null;
  planLimits: { maxEmployees: number | null; maxSocietes: number | null; maxSites: number | null } | null;
  authReady: boolean;
  permissions: RolePermission[];
  hasPermission: (module: string, action: 'consult' | 'add' | 'modify' | 'delete') => boolean;
  setAuthData: (data: Partial<AuthContextType>) => void;
  refreshAuth: () => Promise<void>;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType>({
  soccod: null,
  soclib: null,
  sitcod: null,
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
  planCode: null,
  planLimits: null,
  authReady: false,
  permissions: [],
  hasPermission: () => false,
  setAuthData: () => { },
  refreshAuth: async () => { },
  clearAuth: () => { },
});

const persistedKeys = new Set(["soccod", "soclib", "sitcod", "userName", "uticod", "utiadm"]);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const requestIdRef = useRef(0);
  // Hydrate l'état initial depuis sessionStorage. Sans ça, après un reload, isAdmin=false
  // pendant la fenêtre où /me est en vol → le sidebar (et tout filtrage par permission) se
  // construit sur une vue tronquée du compte. On préfère partir de la dernière vérité connue
  // et corriger via /me ensuite.
  const persistedUticod = sessionStorage.getItem('uticod');
  const persistedUtiadm = sessionStorage.getItem('utiadm');
  const [authReady, setAuthReady] = useState(false);
  const [authData, setAuthData] = useState({
    soccod: sessionStorage.getItem('soccod'),
    sitcod: sessionStorage.getItem('sitcod'),
    soclib: sessionStorage.getItem('soclib'),
    userName: sessionStorage.getItem('userName') || null,
    uticod: persistedUticod,
    utiadm: persistedUtiadm,
    roleName: null as string | null,
    // Si utiadm='1' était persisté, on présume admin tant que /me n'a pas confirmé. Cela évite
    // que le sidebar bascule en mode "minimal" pendant la requête de refresh.
    isAdmin: persistedUtiadm === '1',
    isEmp: false,
    isManager: false,
    sercod: null as string | null,
    isTrialing: false,
    trialEndsAt: null as string | null,
    trialDaysRemaining: null as number | null,
    planCode: null as string | null,
    planLimits: null as { maxEmployees: number | null; maxSocietes: number | null; maxSites: number | null } | null,
    permissions: [] as RolePermission[],
  });

  const refreshAuth = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setAuthReady(false);

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
        isTrialing: Boolean(response.data.isTrialing),
        trialEndsAt: response.data.trialEndsAt ?? null,
        trialDaysRemaining: response.data.trialDaysRemaining ?? null,
        planCode: response.data.planCode ?? null,
        planLimits: response.data.planLimits ?? null,
      }));

      // Persist société/site/userName dans sessionStorage : le dashboard et les autres pages
      // les lisent directement depuis sessionStorage pour éviter de re-fetcher à chaque navigation.
      // Indispensable pour que le post-signup → /dashboard fonctionne sans repasser par /login.
      if (response.data.soccod) sessionStorage.setItem('soccod', response.data.soccod);
      if (response.data.sitcod) sessionStorage.setItem('sitcod', response.data.sitcod);
      if (response.data.soclib) sessionStorage.setItem('soclib', response.data.soclib);
      if (response.data.utilib) sessionStorage.setItem('userName', response.data.utilib);
      if (response.data.uticod) sessionStorage.setItem('uticod', response.data.uticod);
      // utiadm persisté pour hydratation rapide au reload (cf. initial state ci-dessus).
      if (response.data.utiadm != null) sessionStorage.setItem('utiadm', String(response.data.utiadm));
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
        planCode: null,
        planLimits: null,
        permissions: [],
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

  const setAuth = (data: Partial<AuthContextType>) => {
    setAuthData((prev) => ({ ...prev, ...data }));

    Object.entries(data).forEach(([key, value]) => {
      if (!persistedKeys.has(key)) return;

      if (typeof value === 'string' && value !== null) {
        sessionStorage.setItem(key, value);
      } else if (value == null) {
        sessionStorage.removeItem(key);
      }
    });
  };

  const clearAuth = () => {
    requestIdRef.current += 1;
    sessionStorage.removeItem('soccod');
    sessionStorage.removeItem('soclib');
    sessionStorage.removeItem('sitcod');
    sessionStorage.removeItem('userName');

    setAuthReady(true);
    setAuthData({
      soccod: null,
      soclib: null,
      sitcod: null,
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
      planCode: null,
      planLimits: null,
      permissions: [],
    });
  };

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

  return (
    <AuthContext.Provider value={{ ...authData, authReady, hasPermission, setAuthData: setAuth, refreshAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);