import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiService from '../services/api';
import { disableBiometricLogin } from '../services/biometric';
import { clearRegisteredToken } from '../services/push';

interface UserInfo {
  uticod: string;
  utilib: string;
  utiadm: string;
  utirole?: string;
  sercod?: string;
  utiimg?: string;
  isEmp: boolean;
  soccod?: string;
  sitcod?: string;
  soclib?: string;
  socimg?: string;
  sitcods?: string[];
}

interface AuthContextType {
  user: UserInfo | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isEmployee: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await apiService.getStoredToken();
      if (token) {
        const userData = await apiService.getCurrentUser();
        // Map the /me response to UserInfo format
        setUser({
          uticod: userData.uticod,
          utilib: userData.utilib,
          utiadm: userData.utiadm,
          utirole: userData.utirole,
          sercod: userData.sercod,
          utiimg: userData.utiimg,
          isEmp: userData.isEmp,
          soccod: userData.soccod || userData.empInfo?.soccod,
          sitcod: userData.sitcod || userData.empInfo?.sitcod,
          soclib: userData.soclib,
          socimg: userData.socimg,
          sitcods: userData.sitcods,
        });
      }
    } catch (error) {
      console.log('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string, tenantSlug?: string) => {
    const data = await apiService.login(email, password, tenantSlug);
    setUser(data.user);
  };

  const logout = async () => {
    await apiService.logout();
    // Sécurité : on retire les credentials biométriques pour ne pas qu'un autre porteur du
    // téléphone reconnecte le compte précédent. L'utilisateur les ré-active au prochain login.
    try { await disableBiometricLogin(); } catch { /* noop */ }
    // Force la ré-inscription du push token au prochain login (sinon on garde l'ancien
    // dans SecureStore et le serveur ne sait pas que ce device est désormais lié à un autre user).
    try { await clearRegisteredToken(); } catch { /* noop */ }
    setUser(null);
  };

  const isAdmin = user?.utiadm === '1' || user?.utiadm === 'True';
  const isManager = !isAdmin && !!user?.utirole && user.utirole !== '';
  const isEmployee = user?.isEmp === true;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        isAdmin,
        isManager,
        isEmployee,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
