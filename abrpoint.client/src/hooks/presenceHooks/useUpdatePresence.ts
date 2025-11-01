import { useMutation } from "react-query";
import PresenceService from "../../services/PersenceService/PresenceService";

const useUpdatePresence = () => {
    return useMutation(
        async ({ soccod, empcod, predat, presence }: { soccod: string; empcod: string; predat: string; presence: any }) => {
            return await PresenceService.put(soccod, empcod, predat, presence);
        }
    );
};

export default useUpdatePresence;
