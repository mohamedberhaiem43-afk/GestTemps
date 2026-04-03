import { Parametre } from "./Parametre";

// In AffichageProps.ts
export default interface AffichageProps {
  parametre?: Partial<Parametre>; // Made optional and partial
  onChange: (data: Partial<Parametre>) => void;
}