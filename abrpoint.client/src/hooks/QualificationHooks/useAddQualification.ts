import { useMutation, useQueryClient } from "react-query";
import { Qualification } from "../../models/Qualification";
import GetQualification from "../../services/QualificationService/GetQualification";

const useAddQualification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Qualification) => GetQualification.post(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qualifs"] });
    },
  });
};

export default useAddQualification;