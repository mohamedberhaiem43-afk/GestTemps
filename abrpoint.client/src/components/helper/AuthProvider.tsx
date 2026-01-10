import { createContext, useContext, useState } from 'react';

interface AuthContextType {
  soccod: string | null;
  soclib: string | null;
  sitcod: string | null;
  authToken: string ;
  userName: string | null;
  setAuthData: (data: Partial<AuthContextType>) => void;
}

const AuthContext = createContext<AuthContextType>({
  soccod: null,
  soclib: null,
  sitcod: null,
  authToken: '',
  userName: null,
  setAuthData: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [authData, setAuthData] = useState({
    soccod: sessionStorage.getItem('soccod'),
    authToken:'',
    sitcod: sessionStorage.getItem('sitcod'),
    soclib: sessionStorage.getItem('soclib'),
    userName: sessionStorage.getItem('userName') || null,
  });

  const setAuth = (data: Partial<AuthContextType>) => {
    const updated = { ...authData, ...data };
    setAuthData(updated);
    Object.entries(data).forEach(([key, value]) => {
    if (typeof value === 'string' && value !== null) {
        sessionStorage.setItem(key, value);
    }
    });
  };

  return (
    <AuthContext.Provider value={{ ...authData, setAuthData: setAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
