import { useMutation, useQueryClient } from "react-query";
import GetQualification from "../../services/QualificationService/GetQualification";

const useDeleteQualification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ soccod, quacod }: { soccod: string; quacod: string }) =>
      GetQualification.delete(`/${soccod}/${quacod}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qualifs"] });
    },
  });
};

export default useDeleteQualification;