import { useMutation } from "@tanstack/react-query";
import { UpdatePoidroit } from "../../models/Poidroit";
import UpdatePointdroitService from "../../services/PointeuseService/UpdatePointdroitService";

const useUpdatePointdroit = () => {
  return useMutation({
    mutationKey: ["pointdroit-update"],
    // Send the full list to your API
    mutationFn: (pointdroits: UpdatePoidroit[]) =>
      UpdatePointdroitService.putWithoutParams(pointdroits),
  });
};

export default useUpdatePointdroit;
