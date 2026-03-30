import { useQuery } from "react-query";
import ProfileService from "../../services/ProfileService/ProfileService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetProfile = () => {
  const { soccod, uticod } = useAuth();
  return useQuery({
    queryKey: ["profile", soccod, uticod],
    queryFn: () => ProfileService.getWithParams(`get-profile/${soccod}/${uticod}`),
    enabled: !!soccod && !!uticod,
  });
};

export default useGetProfile;
