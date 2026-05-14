import { useMutation } from "@tanstack/react-query";
import CalendriersService from "../../services/CalendrierService/CalendriersService";

interface AddCalendrierParams {
  soccod: string;
  annee: string;
  caltype: string;
}

const useAddCalendrier = () => {
  return useMutation({
    mutationFn: ({ soccod, annee, caltype }: AddCalendrierParams) =>
      CalendriersService.postWithParams(`add-calendrier/${soccod}/${annee}/${caltype}`, {}),
  });
};

export default useAddCalendrier;
