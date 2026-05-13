import { useMutation } from "@tanstack/react-query";
import FilialeService from "../../services/FilialeService/FilialeService";

export default function useDeleteSite()  {
    const soccod = sessionStorage.getItem('soccod');
  
    return useMutation({
      mutationKey: ["site", soccod],
      mutationFn: ({ sitcod }: { sitcod: string }) => FilialeService.delete(`${sitcod}/${soccod}`)
    });
  };
  