import React, { createContext, useContext, useState } from 'react';
import { Parametre } from '../../models/Parametre';

interface ParamSocContextType {
  parametres: Parametre | null;
  setParametres: (Allaitement: Parametre | null) => void;
}

const ParamSocContext = createContext<ParamSocContextType | undefined>(undefined);

export const useParamSocContext = () => {
  const context = useContext(ParamSocContext);
  if (!context) {
    throw new Error('useParamSocContext must be used within a ParametresProvider');
  }
  return context;
};

export const ParametresProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [parametres, setParametres] = useState<Parametre | null>(null);

  return (
    <ParamSocContext.Provider value={{ parametres, setParametres }}>
      {children}
    </ParamSocContext.Provider>
  );
};