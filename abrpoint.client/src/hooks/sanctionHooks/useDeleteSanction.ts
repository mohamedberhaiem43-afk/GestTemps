import { useMutation } from "@tanstack/react-query";
import SanctionService from "../../services/SanctionService/SanctionService";

const useDeleteSanction = () => {
    return useMutation({
        mutationKey: ["sanctions"],
        mutationFn: async ({ soccod, concod }: { soccod: string; concod: string | undefined }) => {
            if (!concod) {
                throw new Error("concod is required");
            }
            return await SanctionService.delete(soccod, concod);
        }
    });
};

export default useDeleteSanction;