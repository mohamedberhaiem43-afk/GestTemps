import { useMutation } from "react-query";
import FonctionService from "../../services/FonctionService/FonctionService";

export default function useDeleteFonction() {
  const soccod = sessionStorage.getItem('soccod');

  return useMutation(({ foncod }: { foncod: string }) =>
    FonctionService.delete(`${soccod}/${foncod}`)
  );
}
