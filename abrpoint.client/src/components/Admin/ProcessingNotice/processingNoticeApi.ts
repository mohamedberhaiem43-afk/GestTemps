import apiInstance from '../../API/apiInstance';

export interface ProcessingNotice {
  title: string;
  body: string;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
}

export interface CurrentNoticeResponse {
  notice: ProcessingNotice;
  requiresAcknowledgment: boolean;
  lastAcknowledgedAt: string | null;
}

export const ProcessingNoticeApi = {
  getForAdmin: async (): Promise<ProcessingNotice> => {
    const res = await apiInstance.get('/admin/processing-notice');
    return res.data;
  },
  update: async (input: { title: string; body: string }): Promise<ProcessingNotice> => {
    const res = await apiInstance.put('/admin/processing-notice', input);
    return res.data;
  },
  getCurrent: async (): Promise<CurrentNoticeResponse> => {
    const res = await apiInstance.get('/processing-notice/current');
    return res.data;
  },
  acknowledge: async (): Promise<void> => {
    await apiInstance.post('/me/consent/acknowledge');
  },
};
