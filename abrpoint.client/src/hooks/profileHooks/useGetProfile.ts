import { useQuery } from "@tanstack/react-query";
import ProfileService from "../../services/ProfileService/ProfileService";
import { useAuth } from "../../components/helper/AuthProvider";

const useGetProfile = () => {
  const uticod = localStorage.getItem('Uticod');
  const { soccod } = useAuth();
  return useQuery({
    queryKey: ["profile", uticod],
    queryFn: () => ProfileService.getWithParams(`get-profile/${soccod}/${uticod}`),
    enabled: !!uticod,
  });
};

export default useGetProfile;
