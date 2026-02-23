import { useMutation, useQueryClient } from "react-query";
import { Qualification } from "../../models/Qualification";
import GetQualification from "../../services/QualificationService/GetQualification";

const useUpdateQualification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Qualification) =>
      GetQualification.putObject(`${data.soccod}/${data.quacod}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qualifs"] });
    },
  });
};

export default useUpdateQualification;