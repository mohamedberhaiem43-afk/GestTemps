import { createContext, useState, ReactNode } from "react";
import { Poste } from "../../../models/Poste";

interface PosteContextType {
  selectedPoste?: Poste;
  setSelectedPoste: (poste?: Poste) => void;
  resetPoste: () => void;
}

export const PosteContext = createContext<PosteContextType | undefined>(undefined);

export const PosteProvider = ({ children }: { children: ReactNode }) => {
  const [selectedPoste, setSelectedPoste] = useState<Poste | undefined>(undefined);

  const resetPoste = () => {
    setSelectedPoste(undefined);
  };

  return (
    <PosteContext.Provider value={{ selectedPoste, setSelectedPoste, resetPoste }}>
      {children}
    </PosteContext.Provider>
  );
};
