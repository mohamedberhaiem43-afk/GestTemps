import { useQuery } from "react-query";
import PointageEntryService from "../../services/PointeuseService/PointageEntryService";
export interface LogEntry {
  employe_code: string;
  user_name:string
  time: string;
}

export interface LogsResponse {
  data: LogEntry[];
  message: string;
}

export default function useGetPointage() {
  return useQuery<LogsResponse>({
    queryKey: ["pointages"],
    queryFn: () => PointageEntryService.getWithParams("get-pointages"),
  });
}
