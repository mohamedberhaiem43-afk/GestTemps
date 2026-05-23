import apiInstance from '../../API/apiInstance';

export interface RetentionPolicy {
  auditLogDays: number;
  presenceAnonymizeDays: number;
  presenceDeleteDays: number;
  refreshTokenDaysAfterExpiry: number;
  knownDeviceInactiveDays: number;
  pushTokenInactiveDays: number;
  ragChatLogDays: number;
  updatedAt: string;
  updatedBy: string | null;
}

export interface RetentionBounds {
  min: number;
  max: number;
}

export interface RetentionBoundsSet {
  auditLog: RetentionBounds;
  presenceAnonymize: RetentionBounds;
  presenceDelete: RetentionBounds;
  refreshToken: RetentionBounds;
  knownDevice: RetentionBounds;
  pushToken: RetentionBounds;
  ragChatLog: RetentionBounds;
}

export interface RetentionPolicyResponse {
  policy: RetentionPolicy;
  bounds: RetentionBoundsSet;
}

const BASE = '/admin/retention-policy';

export const RetentionPolicyApi = {
  get: async (): Promise<RetentionPolicyResponse> => {
    const res = await apiInstance.get(BASE);
    return res.data;
  },
  update: async (policy: Omit<RetentionPolicy, 'updatedAt' | 'updatedBy'>): Promise<RetentionPolicy> => {
    const res = await apiInstance.put(BASE, policy);
    return res.data;
  },
};
