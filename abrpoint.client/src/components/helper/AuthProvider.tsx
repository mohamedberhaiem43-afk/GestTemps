import axios from "axios";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface AuthContextType {
  soccod: string | null;
  soclib: string | null;
  sitcod: string | null;
  userName: string | null;
  uticod: string | null;
  utiadm: string | null;
  isEmp: boolean;
  authReady: boolean;
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
  authReady: false,
  setAuthData: () => {},
  refreshAuth: async () => {},
  clearAuth: () => {},
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
        userName: response.data.utilib ?? prev.userName ?? null,
      }));
    } catch {
      if (requestId !== requestIdRef.current) return;

      setAuthData((prev) => ({
        ...prev,
        uticod: null,
        utiadm: null,
        isEmp: false,
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
    });
  };

  return (
    <AuthContext.Provider value={{ ...authData, authReady, setAuthData: setAuth, refreshAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
