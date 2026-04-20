import axios from "axios";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { RolePermission } from "../../models/Role";

interface AuthContextType {
  soccod: string | null;
  soclib: string | null;
  sitcod: string | null;
  userName: string | null;
  uticod: string | null;
  utiadm: string | null;
  isEmp: boolean;
  isManager: boolean;
  sercod: string | null;
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
  isEmp: false,
  isManager: false,
  sercod: null,
  authReady: false,
  permissions: [],
  hasPermission: () => false,
  setAuthData: () => { },
  refreshAuth: async () => { },
  clearAuth: () => { },
});

const persistedKeys = new Set(["soccod", "soclib", "sitcod", "userName"]);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const requestIdRef = useRef(0);
  const [authReady, setAuthReady] = useState(false);
  const [authData, setAuthData] = useState({
    soccod: sessionStorage.getItem('soccod'),
    sitcod: sessionStorage.getItem('sitcod'),
    soclib: sessionStorage.getItem('soclib'),
    userName: sessionStorage.getItem('userName') || null,
    uticod: null as string | null,
    utiadm: null as string | null,
    isEmp: false,
    isManager: false,
    sercod: null as string | null,
    permissions: [] as RolePermission[],
  });

  const refreshAuth = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setAuthReady(false);

    try {
      const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/Utilisateurs/me`, {
        withCredentials: true,
      });

      if (requestId !== requestIdRef.current) return;

      setAuthData((prev) => ({
        ...prev,
        uticod: response.data.uticod ?? null,
        utiadm: response.data.utiadm ?? null,
        isEmp: Boolean(response.data.isEmp),
        sercod: response.data.sercod ?? null,
        userName: response.data.utilib ?? prev.userName ?? null,
        permissions: response.data.permissions ?? [],
      }));
    } catch {
      if (requestId !== requestIdRef.current) return;

      setAuthData((prev) => ({
        ...prev,
        uticod: null,
        utiadm: null,
        isEmp: false,
        isManager: false,
        sercod: null,
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
      isEmp: false,
      isManager: false,
      sercod: null,
      permissions: [],
    });
  };

  const hasPermission = useCallback((module: string, action: 'consult' | 'add' | 'modify' | 'delete') => {
    if (authData.utiadm === '1' || authData.isManager) return true;
    const perm = authData.permissions.find(p => p.rpModule === module);
    if (!perm) return false;

    switch (action) {
      case 'consult': return perm.rpConsult === '1';
      case 'add': return perm.rpAdd === '1';
      case 'modify': return perm.rpModify === '1';
      case 'delete': return perm.rpDelete === '1';
      default: return false;
    }
  }, [authData.permissions, authData.utiadm, authData.isManager]);

  return (
    <AuthContext.Provider value={{ ...authData, authReady, hasPermission, setAuthData: setAuth, refreshAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);