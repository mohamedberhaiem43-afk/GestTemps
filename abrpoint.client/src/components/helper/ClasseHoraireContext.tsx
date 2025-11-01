import React, { createContext, useContext, useState } from 'react';
import { PosteHoraire } from '../../models/PosteHoraire';

interface ClasseHoraireContextType {
  selectedClasseHoraire: PosteHoraire | null;
  frequence: string;
  setFrequence: any;
  selectedPoste: any;
  setSelectedPoste: (codposte:string) => void;
  setSelectedClasseHoraire: (ClasseHoraire: PosteHoraire | null) => void;
}

const ClasseHoraireContext = createContext<ClasseHoraireContextType | undefined>(undefined);
export const useClasseHoraireContext = () => {
  const context = useContext(ClasseHoraireContext);
  if (!context) {
    throw new Error('useClasseHoraireContext must be used within a ClasseHoraireProvider');
  }
  return context;
};

export const ClasseHoraireProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [selectedClasseHoraire, setSelectedClasseHoraire] = useState<PosteHoraire | null>(null);
  const [frequence, setFrequence] = useState<string>('N');
  const [selectedPoste, setSelectedPoste] = useState<string>('');

return (
    <ClasseHoraireContext.Provider value={{
      selectedClasseHoraire,
      setSelectedClasseHoraire,
      frequence,
      setFrequence,
      selectedPoste,
      setSelectedPoste
    }}>
      {children}
    </ClasseHoraireContext.Provider>
  );
};