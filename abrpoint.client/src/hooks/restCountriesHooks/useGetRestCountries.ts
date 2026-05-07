import { useQuery } from 'react-query';
import GetRestCountries from '../../services/RestCountriesService/GetRestCountries';
import { RestCountry } from '../../models/RestCountry';

const useGetRestCountries = () =>
  useQuery<RestCountry[]>({
    queryKey: ['restCountries'],
    queryFn: GetRestCountries.getAll,
    staleTime: 1000 * 60 * 60,
    cacheTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  });

export default useGetRestCountries;
