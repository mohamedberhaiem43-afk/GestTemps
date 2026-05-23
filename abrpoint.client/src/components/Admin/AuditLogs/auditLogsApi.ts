import apiInstance from '../../API/apiInstance';

export interface AuditLogRow {
  id: number;
  dateAction: string;
  uticod: string | null;
  userDisplay: string | null;
  action: string | null;
  tableName: string | null;
  ipAddress: string | null;
}

export interface AuditLogPage {
  total: number;
  items: AuditLogRow[];
}

export interface AuditLogFilters {
  from?: string;
  to?: string;
  uticod?: string;
  action?: string;
  table?: string;
  ip?: string;
  search?: string;
  skip?: number;
  take?: number;
}

const BASE = '/admin/audit-logs';

export const AuditLogsApi = {
  list: async (filters: AuditLogFilters): Promise<AuditLogPage> => {
    const params: Record<string, string | number> = {};
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.uticod) params.uticod = filters.uticod;
    if (filters.action) params.action = filters.action;
    if (filters.table) params.table = filters.table;
    if (filters.ip) params.ip = filters.ip;
    if (filters.search) params.search = filters.search;
    params.skip = filters.skip ?? 0;
    params.take = filters.take ?? 25;
    const res = await apiInstance.get(BASE, { params });
    return res.data;
  },
  facets: async (): Promise<{ actions: string[]; tables: string[] }> => {
    const res = await apiInstance.get(`${BASE}/facets`);
    return res.data;
  },
};
