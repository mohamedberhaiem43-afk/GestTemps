import { useQuery } from "@tanstack/react-query";
import ProfileService from "../../services/ProfileService/ProfileService";

const useGetProfile = () => {
  const uticod = localStorage.getItem('Uticod');

  return useQuery({
    queryKey: ["profile", uticod],
    queryFn: () => ProfileService.getWithParams(`get-profile/${uticod}`),
    enabled: !!uticod,
  });
};

export default useGetProfile;
